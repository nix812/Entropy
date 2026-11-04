// ===================== ENTROPY — SYNTH AUDIO =====================
// Engine modeled on the Elemental Clash SFX kit: osc / fm / noise / kick voices
// routed through reverb, compression and distortion. Everything is synthesized.
const SFX = (() => {
  let ctx = null, master, sfxBus, musBus, limiter, noiseBuf, noiseLo;
  let sfxVol = 0.8, musVol = 0.45, mono = false;
  // v5.5.3 Mono Audio (Settings): the master gain sums left and right into one channel (the speakers rule: (L + R) / 2), then the
  // output plays it in both ears, so nothing panned to one side is lost with a single earbud
  // v5.5.4: both output paths are built once and switched by gain. Changing channelCount on a live node (5.5.3) is the kind of thing
  // Safari handles worse than Chrome, so nothing about the channel layout changes while sound plays.
  let monoMix = null;
  function buildOut(src, dest) {
    const st = ctx.createGain(); st.gain.value = mono ? 0 : 1; src.connect(st); st.connect(dest);
    const up = ctx.createGain(); up.channelCount = 2; up.channelCountMode = 'explicit'; up.channelInterpretation = 'speakers'; // a mono signal arrives as L = R
    const sp = ctx.createChannelSplitter(2), hl = ctx.createGain(), hr = ctx.createGain(), sum = ctx.createGain(), mg = ctx.createChannelMerger(2), mo = ctx.createGain();
    hl.gain.value = 0.5; hr.gain.value = 0.5; mo.gain.value = mono ? 1 : 0;
    src.connect(up); up.connect(sp); sp.connect(hl, 0); sp.connect(hr, 1); hl.connect(sum); hr.connect(sum); sum.connect(mg, 0, 0); sum.connect(mg, 0, 1); mg.connect(mo); mo.connect(dest);
    monoMix = { st, mo };
  }
  function applyMono() { if (!monoMix || !ctx) return; const t = ctx.currentTime; monoMix.st.gain.setTargetAtTime(mono ? 0 : 1, t, 0.02); monoMix.mo.gain.setTargetAtTime(mono ? 1 : 0, t, 0.02); }
  // v5.5.4 iOS: an audio-route change (an AirPod in or out, a call, Siri) can leave the context 'interrupted', not 'suspended'.
  // Anything but 'running' gets a resume: on every tap, when the page comes back, and shortly after the state changes.
  function wake() { if (!ctx || offline || ctx.state === 'running' || ctx.state === 'closed') return; try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  let lastErr = null, errN = 0;
  function noteErr(e, where) { errN++; lastErr = { msg: String((e && e.message) || e).slice(0, 120), where, at: Date.now() }; try { console.error('[Entropy audio]', where, e); } catch (x) {} }
  const revCache = {};
  const last = {};
  let recent = [];
  const now = () => ctx.currentTime;

  function init() {
    if (ctx) { wake(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // master: a brickwall limiter just under 0 dBFS. The SFX glue compressor (in buildBuses) does the gentle work.
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 1; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.12;
    master = ctx.createGain(); master.gain.value = 0.95;
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol;
    musBus = ctx.createGain(); musBus.gain.value = musVol;
    sfxBus.connect(limiter); limiter.connect(master); buildOut(master, ctx.destination);
    makeNoise(); buildBuses(); hookMusic();
    ctx.onstatechange = () => { if (ctx.state !== 'running' && !document.hidden) setTimeout(wake, 300); };
    // iOS: play one silent buffer inside the unlocking gesture
    try { const sb = ctx.createBufferSource(); sb.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); sb.connect(ctx.destination); sb.start(0); } catch (e) {}
    try { Music.start(); } catch (e) { noteErr(e, 'start'); }
  }
  // v4.6: one soundtrack, the generative composer (Drift, below). The menu and battle scenes only steer its choices.
  function setTrack(t) { Music.setScene(t === 'game' ? 'game' : 'menu'); }
  function setSoundtrack() {}
  const synthOut = () => musBus;
  // iOS only starts audio inside a user gesture: resume on every tap until it runs
  for (const ev of ['touchend', 'click', 'pointerup', 'keydown']) document.addEventListener(ev, wake, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!ctx || offline) return; if (document.hidden) { try { ctx.suspend && ctx.suspend(); } catch (e) {} } else wake(); });
  function setVolumes(s, m) {
    sfxVol = s; musVol = m;
    if (sfxBus) sfxBus.gain.setTargetAtTime(s, now(), 0.05);
    if (musBus) musBus.gain.setTargetAtTime(m, now(), 0.05);
  }
  // ================= v4.5.1 SFX ENGINE =================
  // Retro voices (NES-style pulse duties, triangle, noise, FM bells, a bit-crush stage) mixed like a modern game:
  //  - every sound is layered: a bright transient (noise, >1 kHz) + a body (synth with pitch and filter drop) + an optional
  //    sub for heavy hits; tails come from two shared reverbs (a short room and a long hall), never baked in
  //  - variation on every play: pitch ±(per sound, about a semitone), filter and level jitter, random noise offsets
  //  - stereo: sounds sit where they happen on screen; off-screen sounds are quieter and duller
  //  - buses: ui / weapons / impacts / events, glued by a gentle compressor, then a brickwall limiter. Big events duck the
  //    weapons, impacts and music for a moment so they read
  //  - density: when many towers fire at once each shot gets quieter (1/sqrt of the voices in flight) and every sound has
  //    its own minimum interval and polyphony cap, so a full board stays clear instead of turning into noise
  //  - frequency lanes by tower size: light guns sit high, heavy ones low (the Sanctum 2 approach)
  let busUI, busW, busH, busE, glue, room, hall, crushIn, duckW, duckH, duckM;
  let tBase = null, offline = false, locate = null;
  const active = new Map(), lastT = {};
  let inFlight = 0, beamV = null, dangerT = 0, streak = 0, streakT = 0;
  const T = () => (tBase !== null ? tBase : ctx.currentTime);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const semi = s => Math.pow(2, s / 12);
  function impulse(decay, bright) {
    const k = decay.toFixed(1) + ':' + bright;
    if (revCache[k]) return revCache[k];
    const len = Math.floor(ctx.sampleRate * decay), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) { const x = Math.random() * 2 - 1; lp += (x - lp) * bright; d[i] = lp * Math.pow(1 - i / len, 3) * (i < 40 ? i / 40 : 1); }
    }
    return (revCache[k] = b);
  }
  function makeReverb(wet, _pre, decay, out) { // kept for the procedural music
    const input = ctx.createGain(), dry = ctx.createGain(), wetG = ctx.createGain(), conv = ctx.createConvolver();
    conv.buffer = impulse(decay || 2, 0.5);
    dry.gain.value = 1 - wet * 0.5; wetG.gain.value = wet;
    input.connect(dry); input.connect(conv); conv.connect(wetG);
    const dest = out || sfxBus; dry.connect(dest); wetG.connect(dest);
    return { input };
  }
  // NES-style pulse waves (12.5%, 25%) built from their Fourier series
  const waves = {};
  function pulseWave(duty) {
    if (waves[duty]) return waves[duty];
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * (1 - k / n * 0.4);
    return (waves[duty] = ctx.createPeriodicWave(re, im));
  }
  function buildBuses() {
    glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 10; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.16;
    glue.connect(sfxBus);
    const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
    busUI = g(0.9); busW = g(0.75); busH = g(0.7); busE = g(1);
    duckW = g(1); duckH = g(1); duckM = g(1);
    busUI.connect(glue); busW.connect(duckW); duckW.connect(glue); busH.connect(duckH); duckH.connect(glue); busE.connect(glue);
    // shared tails: a tight room for gunfire, a long dark hall for events
    const mk = (decay, bright, level) => { const inp = ctx.createGain(), conv = ctx.createConvolver(), hp = ctx.createBiquadFilter(), out = g(level);
      conv.buffer = impulse(decay, bright); hp.type = 'highpass'; hp.frequency.value = 180; inp.connect(hp); hp.connect(conv); conv.connect(out); out.connect(glue); return inp; };
    room = mk(0.7, 0.55, 0.5); hall = mk(2.8, 0.3, 0.55);
    // bit-crush stage: an 8-level staircase shaper for retro grit
    crushIn = ctx.createWaveShaper(); const n = 1024, cv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; cv[i] = Math.round(x * 7) / 7; }
    crushIn.curve = cv; crushIn.connect(busW);
  }
  // re-route music through a duck stage
  function hookMusic() { musBus.disconnect(); musBus.connect(duckM); duckM.connect(limiter); }

  // ---------- per-event chain: gain -> stereo pan (+ off-screen dulling) -> bus, with sends ----------
  function chain(bus, o) {
    const t = T(), g = ctx.createGain(); g.gain.value = o.vol;
    let head = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); head = p; }
    if (o.dull) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; head.connect(f); head = f; }
    head.connect(bus);
    if (o.room) { const s = ctx.createGain(); s.gain.value = o.room; head.connect(s); s.connect(room); }
    if (o.hall) { const s = ctx.createGain(); s.gain.value = o.hall; head.connect(s); s.connect(hall); }
    return { g, t, end: t, p: o.pitch || 1 };
  }
  function fin(c, dur) { c.end = Math.max(c.end, c.t + dur); }
  function envG(g, t, a, d, peak, curve) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.0015, a));
    if (curve === 'lin') g.gain.linearRampToValueAtTime(0.0001, t + a + d);
    else g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // tone: a pitched voice. wave: 'sine' | 'triangle' | 'square' | 'sawtooth' | 0.125 | 0.25 (pulse duty)
  function tone(c, o) {
    const t = c.t + (o.at || 0), os = ctx.createOscillator(), g = ctx.createGain(), p = c.p * (o.fix ? 1 : 1);
    if (typeof o.w === 'number') os.setPeriodicWave(pulseWave(o.w)); else os.type = o.w || 'square';
    os.frequency.setValueAtTime(o.f0 * p, t);
    if (o.f1) os.frequency.exponentialRampToValueAtTime(Math.max(15, o.f1 * p), t + (o.slide || o.d));
    if (o.vib) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = o.vib[0]; lg.gain.value = o.vib[1] * o.f0 * p; lfo.connect(lg); lg.connect(os.frequency); lfo.start(t); lfo.stop(t + (o.a || 0.002) + o.d + 0.05); }
    let src = os;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 0.8; f.frequency.setValueAtTime(o.lp, t); if (o.lp1) f.frequency.exponentialRampToValueAtTime(o.lp1, t + o.d); os.connect(f); src = f; }
    envG(g, t, o.a || 0.002, o.d, o.v, o.curve);
    src.connect(g); g.connect(o.crush ? crushIn : c.g);
    if (o.crush) { /* crushed layers bypass the per-event pan; keep them quiet */ }
    os.start(t); os.stop(t + (o.a || 0.002) + o.d + 0.05);
    fin(c, (o.at || 0) + (o.a || 0.002) + o.d);
  }
  // FM: metallic and glassy timbres (bells, zaps)
  function fmv(c, o) {
    const t = c.t + (o.at || 0), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), p = c.p;
    car.type = o.cw || 'sine'; mod.type = o.mw || 'sine';
    car.frequency.setValueAtTime(o.f0 * p, t); mod.frequency.setValueAtTime(o.f0 * p * o.r, t);
    if (o.f1) { car.frequency.exponentialRampToValueAtTime(Math.max(15, o.f1 * p), t + o.d); mod.frequency.exponentialRampToValueAtTime(Math.max(15, o.f1 * p * o.r), t + o.d); }
    mg.gain.setValueAtTime(o.f0 * p * o.i, t); mg.gain.exponentialRampToValueAtTime(Math.max(0.01, o.f0 * p * (o.i1 !== undefined ? o.i1 : o.i * 0.1)), t + o.d);
    mod.connect(mg); mg.connect(car.frequency);
    envG(g, t, o.a || 0.002, o.d, o.v, o.curve);
    car.connect(g); g.connect(c.g);
    car.start(t); mod.start(t); car.stop(t + (o.a || 0.002) + o.d + 0.05); mod.stop(t + (o.a || 0.002) + o.d + 0.05);
    fin(c, (o.at || 0) + (o.a || 0.002) + o.d);
  }
  // noise: transients, whooshes, crunch. ft: filter type; f0 -> f1 sweep
  function nz(c, o) {
    const t = c.t + (o.at || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = o.lofi ? noiseLo : noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    f.type = o.ft || 'bandpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t + o.d);
    envG(g, t, o.a || 0.001, o.d, o.v, o.curve);
    src.connect(f); f.connect(g); g.connect(c.g);
    src.start(t, Math.random() * 1.8); src.stop(t + (o.a || 0.001) + o.d + 0.05);
    fin(c, (o.at || 0) + (o.a || 0.001) + o.d);
  }
  // sub: a sine thump that falls in pitch (felt more than heard). Heavy hits only.
  function sub(c, f0, f1, d, v, at) { tone(c, { w: 'sine', f0, f1, d, v, a: 0.003, at }); }
  // click: a 1-2 ms transient that gives anything a crisp front
  function click(c, v, at, hp) { nz(c, { ft: 'highpass', f0: hp || 3000, d: 0.012, v, at, q: 0.7 }); }

  // ---------- voice management ----------
  // per sound: min interval (s), polyphony cap, bus, priority. Returns false when the play should be skipped.
  function allow(name, gap, poly) {
    if (offline) return true;
    const t = performance.now(), L = lastT[name] || 0;
    if (t - L < gap * 1000) return false;
    const n = active.get(name) || 0;
    if (poly && n >= poly) return false;
    lastT[name] = t; return true;
  }
  function trackV(name, c) {
    if (offline) return;
    active.set(name, (active.get(name) || 0) + 1); inFlight++;
    const ms = Math.max(30, (c.end - ctx.currentTime) * 1000 + 30);
    setTimeout(() => { active.set(name, Math.max(0, (active.get(name) || 1) - 1)); inFlight = Math.max(0, inFlight - 1); }, ms);
  }
  const density = () => 1 / Math.sqrt(1 + inFlight * 0.18);
  // where a sound happens: pan from screen x, quieter and duller off-screen
  function place(arg) {
    const x = arg && (arg.cx !== undefined ? arg.cx : arg.x), y = arg && (arg.cy !== undefined ? arg.cy : arg.y);
    if (x === undefined || !locate) return { pan: 0, k: 1, dull: false };
    const L = locate(x, y); if (!L) return { pan: 0, k: 1, dull: false };
    return { pan: Math.max(-0.75, Math.min(0.75, L.px * 0.75)), k: L.on ? 1 : 0.45, dull: !L.on };
  }
  // 6.2 tower fire and impacts follow the camera (Nic: "closer to the center the louder"): volume and a gentle pan from the
  // source's distance to the screen centre, in units of the half-view (1 = the screen edge), so zooming changes it too.
  // Full within 0.6, easing down to PROX_FLOOR by 2.2 (well off screen) and never silent; off screen is also dulled.
  // Worked out once per sound (no per-frame work); a far, quiet sound plays at most every 0.25 s per sound name, so a busy
  // battle off screen costs a fraction of the voices it used to.
  const PROX_FLOOR = 0.2, PROX_IN = 0.6, PROX_OUT = 2.2;
  let curP = null;
  function prox(arg) {
    const x = arg && (arg.cx !== undefined ? arg.cx : arg.x), y = arg && (arg.cy !== undefined ? arg.cy : arg.y);
    if (x === undefined || !locate) return null;
    const L = locate(x, y); if (!L) return null;
    const ny = L.py === undefined ? 0 : L.py, r = Math.sqrt(L.px * L.px + ny * ny), u = Math.min(1, Math.max(0, (r - PROX_IN) / (PROX_OUT - PROX_IN)));
    const k = 1 - (1 - PROX_FLOOR) * u * u * (3 - 2 * u);
    return { pan: Math.max(-0.6, Math.min(0.6, L.px * 0.5)), k, dull: !L.on, far: u >= 0.85 };
  }
  function duck(db, att, hold, rel, mus) {
    if (!duckW) return;
    const t = T(), v = Math.pow(10, db / 20);
    for (const n of mus ? [duckW, duckH, duckM] : [duckW, duckH]) {
      n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(n.gain.value, t);
      n.gain.linearRampToValueAtTime(v, t + att); n.gain.setValueAtTime(v, t + att + hold); n.gain.linearRampToValueAtTime(1, t + att + hold + rel);
    }
  }
  // loudness trims (dB), set from offline renders so each role lands in its tier (loudest 50 ms, dBFS):
  // UI -28 · rapid weapons -28 to -31 · single-shot weapons -24 · hits -36 · deaths -30 (heavy -24) · combos -22 ·
  // player actions -22 · notices -20 to -24 · big events -12. Measured with test/sfxrender.py.
  const TRIM = { ui: 20, deny: 12, rail: -2.3, pulse: -1, missile: -2, flame: 1, mortar: -3.5, grav: -9, hit: 13, hitcrit: -2, hitshield: 2,
    build: -3, upgrade: 4, reroll: 15, sell: 12, cash: 4, wave: -2, call: 11, milestone: 6, freeze: 2, net: 15, boom: -2, blink: 3, storm: 7, levelup: 2, unbreak: 4,
    converge: 4, crack: 1, stasis: 5, strikecharge: 3, overclock: 12, quack: 5, nuke: -1.5, // 6.2 the Nuke: the loudest big event, by a dB
    // v5.8 tower character (measured with sfxrender.py; spec variants sit level with their base sound, grav trimmed 3 dB into its tier)
    shot2: 4.4, rail1: -1.8, rail2: -2, pulse1: -2.1, pulse2: 1.1, missile1: 0.3, missile2: -0.2, coil: 1.7, coil1: 1.1, coil2: -3.7, ignite: 5,
    mortar1: -2, mortar2: -1.1, grav1: -9.1, grav2: -8.5, hitK: 9.5, hitR: 2.3, hitC: 7.7, hitF: 3.4, hitV: 10.1, hitA: 10.9,
    boomT: -2, boomT2: -1.8, pop: 0.5, empboom: -2.7, empboom1: -2.6, lure: 2.8, lure2: 0.7, net1: -3.3, lock: 14.7, lock2: 14.7, forge: 1.2, forge1: 2.4, pylon: 11.7,
    saw: 5.5, flashover: -6.5, rime: 1, aegis: 8.5, aegisblock: -3.5, joker: 10, // 6.4 (sfxrender: saw -26, Flashover -24, Aegis -30, Wildcard -28, a stop -22 dB)
    comboSHATTER: -2.5, comboOVERLOAD: -5, 'comboTHERMAL SHOCK': -3, comboSUPERCONDUCT: 3, comboCOLLAPSE: -7 };
  const dB = v => Math.pow(10, v / 20);
  // start a sound: bus, base volume, pitch jitter (semitones), placement and sends
  function ev(name, bus, vol, o, arg) {
    o = o || {};
    const wh = bus === busW || bus === busH, P = (wh && (curP || prox(arg))) || place(arg), jit = o.jit === undefined ? 0.6 : o.jit; // 6.2: weapons and impacts follow the camera
    const dens = wh ? density() : 1;
    const c = chain(bus, { vol: vol * dB((TRIM[o.tn || name] || 0) + (o.trim || 0)) * P.k * dens * rnd(0.9, 1.05), pan: o.pan !== undefined ? o.pan : P.pan, dull: P.dull, room: o.room, hall: o.hall, pitch: (o.pitch || 1) * semi(rnd(-jit, jit)) });
    c.name = name; return c;
  }
  let played = 0;
  function done(c) { played++; trackV(c.name, c); }

  let gatBar = 1;
  // Ascended towers sound a little heavier (+1 dB, then +0.5 dB per Ascend after the first)
  const ascT = t => t && t.asc ? 0.5 + 0.5 * Math.min(4, t.asc) : 0;
  // the Pulse Blaster's element flavours (shared by the single shot and each Twin Cannons tap)
  function shotBody(c, el) {
    click(c, 0.35, 0, 4500);
    if (el === 'T') { nz(c, { f0: 1600, f1: 500, q: 1.4, d: 0.07, v: 0.4 }); tone(c, { w: 0.25, f0: 520, f1: 180, d: 0.06, v: 0.22, lp: 3000 }); }
    else if (el === 'C') { fmv(c, { f0: 1900, f1: 1300, r: 3.5, i: 1.2, d: 0.07, v: 0.22 }); nz(c, { ft: 'highpass', f0: 6000, d: 0.03, v: 0.2 }); }
    else if (el === 'A') { fmv(c, { f0: 900, f1: 300, r: 7.1, i: 4, d: 0.05, v: 0.22, cw: 'square' }); nz(c, { ft: 'highpass', f0: 7000, d: 0.03, v: 0.3 }); }
    else if (el === 'V') { fmv(c, { f0: 300, f1: 110, r: 0.5, i: 3, d: 0.08, v: 0.32 }); }
    else { tone(c, { w: 0.25, f0: 1250, f1: 380, d: 0.05, v: 0.24, lp: 5200, lp1: 1800 }); nz(c, { f0: 2400, f1: 1200, q: 1.6, d: 0.04, v: 0.3 }); }
  }

  // ---------- the sound set ----------
  const WEAP = {
    // Pulse Blaster: light, bright, high lane. A 25% pulse chirp over a noise snap. Kinetic by default; element flavours below.
    shot(t) {
      const el = t && t.s ? t.s.el : 'K', fast = t && t.spec === 1, twin = t && t.spec === 2;
      if (!allow('shot', fast ? 0.045 : 0.06, 6)) return;
      // v5.8 tower character: the Gatling's drum alternates barrels a semitone up and down; Twin Cannons fire two taps panned apart
      if (fast) gatBar = -gatBar;
      if (twin) { const P0 = place(t).pan; for (const [k, at] of [[-1, 0], [1, 0.045]]) { const c = ev('shot', busW, 0.36, { room: 0.12, jit: 0.6, tn: 'shot2', pan: Math.max(-0.9, Math.min(0.9, P0 + k * 0.15)), trim: ({ K: 5, T: 5, C: 0, A: 0, V: -2 }[el] || 0) + ascT(t) }, t); c.t += at; shotBody(c, el); done(c); } return; }
      const c = ev('shot', busW, fast ? 0.32 : 0.42, { room: 0.12, jit: fast ? 0.3 : 1, pitch: fast ? semi(gatBar) * semi(3) : 1, trim: ({ K: 5, T: 5, C: 0, A: 0, V: -2 }[el] || 0) + (fast ? 2 : 0) + ascT(t) }, t);
      if (fast && el === 'K') { click(c, 0.3, 0, 6000); tone(c, { w: 0.125, f0: 1500, f1: 700, d: 0.03, v: 0.2, lp: 6000 }); nz(c, { ft: 'highpass', f0: 4000, d: 0.02, v: 0.22 }); done(c); return; }
      shotBody(c, el);
      done(c);
    },
    // Rail Lance: the sharpest gun. Crack + FM sweep down + metallic ring + room tail; mid-high lane.
    // v5.8: a sub thump for weight. Gauss Spire rings out in the hall; Splinter Rail cracks with a bright sweep and three clicks
    rail(t) {
      if (!allow('rail', 0.08, 4)) return;
      const sp = t && t.spec || 0;
      const c = ev('rail', busW, 0.6, { room: 0.3, jit: 0.5, hall: sp === 1 ? 0.3 : 0, tn: sp ? 'rail' + sp : 'rail', trim: ascT(t) }, t);
      click(c, 0.6, 0, 5000);
      fmv(c, { f0: 2200, f1: 90, r: 9.03, i: 7, i1: 0.3, d: 0.14, v: 0.32 });
      tone(c, { w: 'sawtooth', f0: 660, f1: 110, d: 0.11, v: 0.16, lp: 4000, lp1: 500 });
      sub(c, 120, 42, 0.12, 0.4);
      if (sp === 1) fmv(c, { f0: 1480, r: 1.41, i: 1.6, i1: 0.2, d: 0.6, v: 0.12, at: 0.01 });
      else if (sp === 2) { nz(c, { ft: 'highpass', f0: 2500, f1: 9000, d: 0.12, v: 0.3 }); for (let k = 0; k < 3; k++) click(c, 0.4, 0.03 + k * 0.028, 5000); }
      else fmv(c, { f0: 1480, r: 2.76, i: 0.8, d: 0.22, v: 0.06, at: 0.01 });
      done(c);
    },
    // Cryo pulse: a glassy bell and a frosty hiss. High and soft (it fires constantly).
    // v5.8: Glacier Core rings a lower, longer bell; Shatter Field adds tiny glass tinks
    pulse(t) {
      if (!allow('pulse', 0.14, 3)) return;
      const sp = t && t.spec || 0;
      const c = ev('pulse', busW, 0.42, { room: 0.35, jit: 1.5, tn: sp ? 'pulse' + sp : 'pulse', trim: ascT(t) }, t);
      if (sp === 1) { fmv(c, { f0: 1397, r: 3.01, i: 1.6, i1: 0.05, d: 0.5, v: 0.17 }); fmv(c, { f0: 2093, r: 1.5, i: 0.5, d: 0.35, v: 0.06, at: 0.03 }); nz(c, { ft: 'highpass', f0: 5000, d: 0.3, v: 0.14, a: 0.03 }); }
      else if (sp === 2) { fmv(c, { f0: 2093, r: 3.01, i: 1.4, i1: 0.05, d: 0.24, v: 0.14 }); nz(c, { ft: 'highpass', f0: 7000, d: 0.12, v: 0.14, a: 0.01 }); for (let k = 0; k < 2; k++) fmv(c, { f0: rnd(3500, 5200), r: 3.1, i: 0.8, d: 0.04, v: 0.06, at: 0.04 + k * 0.035 + rnd(0, 0.02) }); }
      else { fmv(c, { f0: 2093, r: 3.01, i: 1.4, i1: 0.05, d: 0.28, v: 0.16 }); fmv(c, { f0: 3136, r: 1.5, i: 0.6, d: 0.2, v: 0.07, at: 0.015 }); nz(c, { ft: 'highpass', f0: 7000, d: 0.16, v: 0.16, a: 0.01 }); }
      done(c);
    },
    // Swarm Missile: launch thunk + rising rocket whoosh. Mid lane.
    missile(t) {
      if (!allow('missile', 0.09, 4)) return;
      const sp = t && t.spec || 0; // v5.8: Cluster Pods launch higher and tighter, Napalm Payload lower and heavier
      const c = ev('missile', busW, 0.5, { room: 0.18, tn: sp ? 'missile' + sp : 'missile', pitch: sp === 1 ? semi(3) : sp === 2 ? semi(-3) : 1, trim: ascT(t) }, t);
      sub(c, 160, 70, 0.07, 0.35);
      nz(c, { f0: 700, f1: 2400, q: 1.2, d: 0.22, v: 0.3, a: 0.015 });
      nz(c, { ft: 'lowpass', f0: 900, d: 0.05, v: 0.3, lofi: 1 });
      done(c);
    },
    // Arc Coil: a crackling FM zap with a bit-crushed buzz. Upper-mid lane.
    zap(t) {
      if (!allow('zap', 0.07, 4)) return;
      const c = ev('zap', busW, 0.42, { room: 0.15, jit: 2 }, t);
      nz(c, { ft: 'highpass', f0: 5500, d: 0.05, v: 0.45, q: 0.5 });
      fmv(c, { f0: rnd(700, 1100), f1: 160, r: 6.13, i: 5, d: 0.09, v: 0.22, cw: 'square' });
      tone(c, { w: 0.125, f0: 220, f1: 110, d: 0.07, v: 0.08, crush: 1 });
      done(c);
    },
    // v5.8 Arc Coil: its own crackling bolt (zap stays for thunder and abilities). Tesla Crown crackles once per hop;
    // Overvolt is thicker: a crushed layer and a sub
    coil(t) {
      if (!allow('coil', 0.07, 4)) return;
      const sp = t && t.spec || 0;
      const c = ev('coil', busW, 0.42, { room: 0.15, jit: 2, tn: sp ? 'coil' + sp : 'coil', trim: ascT(t) }, t);
      nz(c, { ft: 'highpass', f0: 5000, d: 0.06, v: 0.4, q: 0.5, lofi: 1 });
      fmv(c, { f0: rnd(600, 900), f1: 140, r: 5.03, i: 6, d: 0.11, v: 0.2, cw: 'square' });
      if (sp === 1) { const n = Math.min(6, (t.s && t.s.chain) || 6); for (let k = 0; k < n; k++) click(c, 0.35, 0.02 + k * 0.022, 3500 + k * 400); }
      else if (sp === 2) { tone(c, { w: 'sawtooth', f0: 110, f1: 70, d: 0.16, v: 0.12, crush: 1 }); sub(c, 90, 40, 0.14, 0.4); }
      else tone(c, { w: 0.125, f0: 247, f1: 123, d: 0.08, v: 0.08, crush: 1 });
      done(c);
    },
    // Flame Projector: the roar is one continuous voice (SFX.flames, driven from UI.tick); each shot is silent here
    flame() {},
    // a short ignition chirp when a projector starts firing
    ignite(t) {
      if (!allow('ignite', 0.12, 2)) return;
      const sp = t && t.spec || 0;
      const c = ev('ignite', busW, 0.42, { room: 0.1, jit: 1, pitch: sp === 2 ? semi(4) : sp === 1 ? semi(-2) : 1 }, t);
      click(c, 0.3, 0, 2500);
      nz(c, { f0: 400, f1: 1400, q: 1.2, d: 0.09, v: 0.35, a: 0.01 });
      nz(c, { ft: 'highpass', f0: 3500, d: 0.06, v: 0.15, lofi: 1 });
      done(c);
    },
    // EMP Mortar: a heavy tube thump on launch. Low lane.
    mortar(t) {
      if (!allow('mortar', 0.1, 3)) return;
      const sp = t && t.spec || 0; // v5.8: Ion Barrage = three thumps 70 ms apart; Blackout Shell a deeper tube
      const c = ev('mortar', busW, 0.55, { room: 0.25, tn: sp ? 'mortar' + sp : 'mortar', pitch: sp === 1 ? semi(-3) : 1, trim: ascT(t) }, t);
      if (sp === 2) { for (let k = 0; k < 3; k++) { sub(c, 120 - k * 6, 48, 0.1, 0.5, k * 0.07); click(c, 0.22, k * 0.07, 2500); } nz(c, { ft: 'lowpass', f0: 1200, f1: 300, d: 0.24, v: 0.3, lofi: 1 }); }
      else { sub(c, 110, 45, 0.14, 0.55); nz(c, { ft: 'lowpass', f0: 1200, f1: 300, d: 0.1, v: 0.35, lofi: 1 }); click(c, 0.25, 0, 2500); }
      done(c);
    },
    // Gravity Well: a sub drop under a down-bending FM moan. Lowest lane.
    // v5.8: Singularity sucks upward before the drop; Tidal Lock drops longer with a vibrato
    grav(t) {
      if (!allow('grav', 0.2, 2)) return;
      const sp = t && t.spec || 0;
      const c = ev('grav', busW, 0.55, { hall: 0.25, tn: sp ? 'grav' + sp : 'grav', trim: ascT(t) }, t);
      if (sp === 1) { nz(c, { f0: 300, f1: 2400, q: 2, d: 0.14, v: 0.25, a: 0.12, curve: 'lin' }); tone(c, { w: 'sine', f0: 110, f1: 330, d: 0.14, v: 0.12, a: 0.1 }); sub(c, 90, 24, 0.5, 0.55, 0.15); fmv(c, { f0: 220, f1: 45, r: 0.5, i: 3, d: 0.45, v: 0.16, mw: 'triangle', at: 0.15 }); }
      else if (sp === 2) { tone(c, { w: 'sine', f0: 90, f1: 26, d: 0.8, v: 0.5, a: 0.003, vib: [5, 0.04] }); fmv(c, { f0: 196, f1: 49, r: 0.5, i: 3, d: 0.75, v: 0.15, mw: 'triangle' }); }
      else { sub(c, 90, 28, 0.5, 0.5); fmv(c, { f0: 220, f1: 55, r: 0.5, i: 3, d: 0.45, v: 0.16, mw: 'triangle' }); }
      done(c);
    },
    // ---------- 6.4 capstone tier towers (tower64): each in its own lane, gated like the rest ----------
    // Buzzsaw: a metal whirr that rises as the blade leaves, a ring off the disc, a launch click
    saw(t) {
      if (!allow('saw', 0.1, 3)) return;
      const sp = t && t.spec || 0, c = ev('saw', busW, 0.45, { room: 0.18, jit: 0.8, pitch: sp === 1 ? semi(-4) : 1, trim: ascT(t) }, t);
      click(c, 0.4, 0, 4000);
      nz(c, { f0: 1400, f1: 4200, q: 3, d: 0.22, v: 0.3, a: 0.02 });
      fmv(c, { f0: 1760, f1: 1500, r: 2.76, i: 1.2, d: 0.18, v: 0.1, at: 0.02 });
      if (sp === 2) nz(c, { f0: 1600, f1: 4600, q: 3, d: 0.2, v: 0.22, a: 0.02, at: 0.06 });
      done(c);
    },
    // Flashover: a low whoomp; every explosion it sets off adds crackle (up to three)
    flashover(t, n) {
      if (!allow('flashover', 0.2, 2)) return;
      const c = ev('flashover', busW, 0.55, { room: 0.25, jit: 0.6, trim: ascT(t) }, t);
      sub(c, 110, 40, 0.22, 0.5);
      nz(c, { ft: 'lowpass', f0: 1800, f1: 300, d: 0.28, v: 0.4, lofi: 1, a: 0.01 });
      for (let k = 0; k < Math.min(3, n || 0); k++) nz(c, { ft: 'highpass', f0: 3000, d: 0.05, v: 0.22, at: 0.05 + k * 0.05 + rnd(0, 0.02), lofi: 1 });
      done(c);
    },
    // Surge Spire: a bright snapping arc; a charged bolt is higher and tighter, so a burst rattles
    surge(t) {
      if (!allow('surge', 0.06, 4)) return;
      const hot = t && t.surgeT !== undefined && G && G.time - t.surgeT < 0.05, c = ev('surge', busW, 0.4, { room: 0.12, jit: 1.5, pitch: hot ? semi(5) : 1, trim: ascT(t) }, t);
      nz(c, { ft: 'highpass', f0: 6000, d: 0.04, v: 0.4, q: 0.5 });
      fmv(c, { f0: rnd(900, 1300), f1: 220, r: 4.03, i: 5, d: hot ? 0.06 : 0.1, v: 0.2, cw: 'square' });
      if (!hot) tone(c, { w: 0.125, f0: 330, f1: 165, d: 0.06, v: 0.07, crush: 1 });
      done(c);
    },
    // Rimewall: the wall going up, a glassy rising bell over a frosty hiss
    rime(t) {
      if (!allow('rime', 0.3, 2)) return;
      const c = ev('rime', busW, 0.45, { room: 0.35, jit: 0.5, trim: ascT(t) }, t);
      fmv(c, { f0: 1175, f1: 2349, r: 3.01, i: 1.4, d: 0.3, v: 0.14 });
      nz(c, { ft: 'highpass', f0: 5000, f1: 8000, d: 0.25, v: 0.18, a: 0.04 });
      click(c, 0.3, 0.02, 3000);
      done(c);
    },
    // Entangler: a low void thrum with a slow wobble as the threads snap on
    tangle(t) {
      if (!allow('tangle', 0.25, 2)) return;
      const c = ev('tangle', busW, 0.45, { hall: 0.2, jit: 0.5, trim: ascT(t) }, t);
      fmv(c, { f0: 147, f1: 196, r: 0.5, i: 3, d: 0.35, v: 0.16, mw: 'triangle' });
      tone(c, { w: 'sine', f0: 587, f1: 440, d: 0.22, v: 0.08, vib: [7, 0.03] });
      done(c);
    },
    // Gatekeeper: a light twin tap
    aegis(t) {
      if (!allow('aegis', 0.08, 3)) return;
      const c = ev('aegis', busW, 0.32, { room: 0.12, jit: 0.8, trim: ascT(t) }, t);
      click(c, 0.3, 0, 5000); click(c, 0.25, 0.035, 5000);
      tone(c, { w: 0.25, f0: 1480, f1: 740, d: 0.04, v: 0.14, lp: 5000 });
      done(c);
    },
    // Wildcard: a slot-machine ding (two random notes); a Jackpot plays a bell run
    joker(t, jack) {
      if (!allow('joker', 0.1, 3)) return;
      const c = ev('joker', busW, 0.38, { room: 0.2, jit: 0, trim: (jack ? 3 : 0) + ascT(t) }, t);
      click(c, 0.25, 0, 4000);
      const n0 = 76 + Math.floor(rnd(0, 7));
      if (jack) arp(c, [n0, n0 + 4, n0 + 7, n0 + 12], 0.05, { v: 0.1, d: 0.12, bell: 1 });
      else { tone(c, { w: 0.25, f0: note(n0), d: 0.05, v: 0.1, lp: 5000 }); tone(c, { w: 0.25, f0: note(n0 + 5), d: 0.06, v: 0.09, lp: 5000, at: 0.05 }); }
      done(c);
    },
    // Core Battery: a plasma shell. Bright square chirp up, small sub, so it reads as "ours"
    coreshot(t) {
      if (!allow('coreshot', 0.12, 2)) return;
      const c = ev('coreshot', busW, 0.42, { room: 0.25, jit: 0.4 }, t || G && G.core);
      tone(c, { w: 0.25, f0: 330, f1: 990, slide: 0.06, d: 0.1, v: 0.16, lp: 4000 });
      sub(c, 120, 60, 0.08, 0.3);
      done(c);
    },
  };
  // impacts: tiny, gated hard. Crits get a bright tink; blunted hits on armour a dull clank; shields a glassy ping.
  // v5.8: every tower family has its own impact and its own voice budget, so rapid Lens, Flame and Cryo hits can't starve the rest.
  // Missile, Mortar and Gravity Well hits are covered by their own blast or pull sound.
  const HIT_FAM = { pulse: 'K', rail: 'R', cryo: 'C', flame: 'F', lens: 'V', coil: 'A', missile: null, emp: null, grav: null,
    saw: 'R', flashover: null, surge: 'A', rime: 'C', tangle: 'V', aegis: 'K', joker: 'N' }; // 6.4: Flashover's blasts carry their own sound
  const HITS = {
    N: [0.035, 5, 0.22, c => nz(c, { f0: rnd(1500, 2600), q: 2.2, d: 0.03, v: 0.4 })],
    K: [0.04, 4, 0.22, c => { click(c, 0.25, 0, 5000); tone(c, { w: 0.25, f0: 1900, f1: 950, d: 0.025, v: 0.16, lp: 6000 }); }],
    R: [0.05, 3, 0.25, c => { click(c, 0.3, 0, 4000); fmv(c, { f0: 1250, r: 2.76, i: 1.4, d: 0.06, v: 0.14 }); }],
    C: [0.09, 2, 0.2, c => fmv(c, { f0: rnd(3300, 3900), r: 3.01, i: 0.7, d: 0.045, v: 0.12 })],
    F: [0.12, 2, 0.2, c => nz(c, { ft: 'highpass', f0: 3800, d: 0.06, v: 0.3, lofi: 1, a: 0.008 })],
    V: [0.1, 2, 0.2, c => nz(c, { f0: rnd(2600, 3400), q: 4, d: 0.03, v: 0.45 })],
    A: [0.05, 3, 0.22, c => { tone(c, { w: 0.125, f0: 520, f1: 260, d: 0.035, v: 0.14 }); click(c, 0.2, 0, 6000); }],
  };
  const HIT = {
    hit(e, src) {
      const ty = src && src.type, f = !ty ? 'N' : ty in HIT_FAM ? HIT_FAM[ty] : 'N';
      if (!f) return;
      const H = HITS[f]; if (!allow('hit' + f, H[0], H[1])) return;
      const c = ev(f === 'N' ? 'hit' : 'hit' + f, busH, H[2], { jit: 2 }, e); H[3](c); done(c);
    },
    hitcrit(e) { if (!allow('hitcrit', 0.06, 3)) return; const c = ev('hitcrit', busH, 0.45, { room: 0.2, jit: 1 }, e); click(c, 0.4, 0, 6000); fmv(c, { f0: 2637, r: 2.01, i: 1, d: 0.09, v: 0.16 }); done(c); },
    hitarmor(e) { if (!allow('hitarmor', 0.07, 3)) return; const c = ev('hitarmor', busH, 0.3, { jit: 1.5 }, e); fmv(c, { f0: 420, r: 1.41, i: 2.5, d: 0.07, v: 0.22, cw: 'triangle' }); nz(c, { ft: 'lowpass', f0: 1400, d: 0.03, v: 0.2 }); done(c); },
    hitshield(e) { if (!allow('hitshield', 0.07, 3)) return; const c = ev('hitshield', busH, 0.3, { room: 0.2, jit: 1 }, e); fmv(c, { f0: 1760, f1: 1500, r: 1.5, i: 0.8, d: 0.08, v: 0.14 }); done(c); },
  };
  // deaths by body type, with a kill-streak pitch climb (rapid kills step up a semitone each, up to +7)
  const DIE = {
    small(c) { nz(c, { f0: 2600, f1: 900, q: 2, d: 0.06, v: 0.4 }); tone(c, { w: 0.125, f0: 880, f1: 1760, d: 0.05, v: 0.08 }); },
    bug(c) { click(c, 0.3, 0, 3000); nz(c, { f0: 1300, f1: 400, q: 1.6, d: 0.09, v: 0.5, lofi: 1 }); tone(c, { w: 0.25, f0: 300, f1: 90, d: 0.07, v: 0.14 }); },
    heavy(c) { sub(c, 120, 40, 0.2, 0.45); nz(c, { ft: 'lowpass', f0: 1800, f1: 200, d: 0.22, v: 0.5, lofi: 1 }); fmv(c, { f0: 180, r: 1.41, i: 3, d: 0.18, v: 0.14, cw: 'triangle' }); },
    air(c) { nz(c, { f0: 3000, f1: 700, q: 1, d: 0.12, v: 0.4 }); tone(c, { w: 'triangle', f0: 1100, f1: 300, d: 0.1, v: 0.12 }); },
    splat(c) { nz(c, { ft: 'lowpass', f0: 900, f1: 250, q: 3, d: 0.12, v: 0.55 }); tone(c, { w: 'sine', f0: 400, f1: 120, d: 0.1, v: 0.2 }); },
    ghost(c) { fmv(c, { f0: 880, f1: 220, r: 1.5, i: 2, d: 0.22, v: 0.14 }); nz(c, { ft: 'highpass', f0: 4000, f1: 1200, d: 0.18, v: 0.15, a: 0.02 }); },
    heal(c) { fmv(c, { f0: 1319, f1: 660, r: 2, i: 0.8, d: 0.16, v: 0.13 }); nz(c, { f0: 1600, f1: 600, q: 1.5, d: 0.07, v: 0.3 }); },
    glass(c) { click(c, 0.4, 0, 5000); fmv(c, { f0: 2349, r: 2.76, i: 1.6, d: 0.16, v: 0.13 }); fmv(c, { f0: 3136, r: 3.5, i: 1, d: 0.12, v: 0.08, at: 0.02 }); nz(c, { ft: 'highpass', f0: 5000, d: 0.12, v: 0.2 }); },
  };
  const DIE_KIND = { swarmer: 'small', drone: 'bug', tank: 'heavy', flyer: 'air', splitter: 'splat', phantom: 'ghost', medic: 'heal', shielder: 'glass', voidling: 'air', pirate: 'heavy' };
  function die(e) {
    if (!allow('die', 0.03, 6)) return;
    const now2 = performance.now(); if (now2 - streakT < 450) streak = Math.min(7, streak + 1); else streak = 0; streakT = now2;
    const kind = e && e.meat ? 'splat' : e && e.mite ? 'small' : DIE_KIND[e && e.type] || 'bug';
    const c = ev('die', busH, kind === 'heavy' ? 0.55 : 0.4, { room: 0.12, jit: 0.8, pitch: semi(streak), trim: { small: 10, bug: 2, heavy: -5.5, air: 3, splat: 1, ghost: 0, heal: 4, glass: 0 }[kind] }, e);
    DIE[kind](c); done(c);
  }
  const COMBO = {
    SHATTER(c) { click(c, 0.5, 0, 5000); fmv(c, { f0: 3520, f1: 1200, r: 2.76, i: 2.5, d: 0.2, v: 0.2 }); nz(c, { ft: 'highpass', f0: 4500, f1: 2500, d: 0.22, v: 0.35 }); for (let k = 0; k < 4; k++) fmv(c, { f0: rnd(2500, 4800), r: 3.1, i: 1, d: 0.08, v: 0.06, at: 0.03 + k * 0.025 }); },
    OVERLOAD(c) { sub(c, 90, 40, 0.2, 0.5); nz(c, { f0: 2200, f1: 500, q: 1, d: 0.25, v: 0.45, lofi: 1 }); fmv(c, { f0: 600, f1: 150, r: 6.13, i: 6, d: 0.2, v: 0.15, cw: 'square' }); },
    'THERMAL SHOCK'(c) { nz(c, { ft: 'highpass', f0: 3000, f1: 600, d: 0.3, v: 0.4 }); fmv(c, { f0: 1500, f1: 300, r: 1.5, i: 2, d: 0.25, v: 0.12 }); },
    SUPERCONDUCT(c) { fmv(c, { f0: 1047, f1: 2093, r: 4, i: 2, d: 0.22, v: 0.15 }); fmv(c, { f0: 1568, f1: 3136, r: 2, i: 1, d: 0.18, v: 0.1, at: 0.04 }); },
    COLLAPSE(c) { sub(c, 220, 30, 0.45, 0.45); fmv(c, { f0: 400, f1: 25, r: 5.01, i: 6, i1: 0.5, d: 0.45, v: 0.18, mw: 'sawtooth' }); },
  };
  // UI: one family. Short (< 120 ms), soft, pitched: up for confirm, down for deny.
  const UIS = {
    ui() { const c = ev('ui', busUI, 0.3, { jit: 0.3, pan: 0 }); tone(c, { w: 0.25, f0: 1568, d: 0.025, v: 0.12, lp: 6000 }); tone(c, { w: 0.25, f0: 2093, d: 0.03, v: 0.09, at: 0.022, lp: 6000 }); done(c); },
    deny() { const c = ev('deny', busUI, 0.35, { jit: 0, pan: 0 }); tone(c, { w: 0.125, f0: 233, d: 0.06, v: 0.2, lp: 2000 }); tone(c, { w: 0.125, f0: 175, d: 0.09, v: 0.2, at: 0.065, lp: 2000 }); done(c); },
  };
  // musical events use a shared scale (A minor pentatonic, matching the soundtrack's home key)
  const note = m => 440 * Math.pow(2, (m - 69) / 12);
  function arp(c, ms, step, o) { ms.forEach((m, i) => { const at = (o.at || 0) + i * step; tone(c, { w: o.w || 0.25, f0: note(m), d: o.d || 0.12, v: o.v || 0.12, at, lp: o.lp || 5000 }); if (o.bell) fmv(c, { f0: note(m + 12), r: 2, i: 0.6, d: (o.d || 0.12) * 1.6, v: (o.v || 0.12) * 0.5, at }); }); }
  const EVT = {
    build(t) { const c = ev('build', busE, 0.6, { room: 0.3 }, t); sub(c, 140, 60, 0.1, 0.45); nz(c, { ft: 'lowpass', f0: 2000, f1: 300, d: 0.09, v: 0.4, lofi: 1 }); click(c, 0.3, 0.07, 4000); arp(c, [76, 83], 0.05, { at: 0.06, v: 0.1, d: 0.08 }); done(c); },
    upgrade(t) { const lv = t && t.lvl ? Math.min(6, t.lvl) : 1; const c = ev('upgrade', busE, 0.55, { room: 0.4, jit: 0 }, t); arp(c, [69, 72, 76, 81].map(m => m + lv), 0.045, { v: 0.11, d: 0.11, bell: 1 }); nz(c, { ft: 'highpass', f0: 3000, f1: 8000, d: 0.18, v: 0.12, a: 0.05 }); done(c); },
    reroll(t) { const c = ev('reroll', busE, 0.5, { room: 0.3, jit: 0 }, t); for (let i = 0; i < 6; i++) tone(c, { w: 0.125, f0: note(72 + Math.floor(rnd(0, 12))), d: 0.035, v: 0.1, at: i * 0.035 }); tone(c, { w: 0.25, f0: note(81), d: 0.12, v: 0.12, at: 0.22 }); done(c); },
    sell(t) { const c = ev('sell', busE, 0.55, { room: 0.3, jit: 0 }, t); arp(c, [84, 79, 76], 0.05, { v: 0.1, d: 0.09, bell: 1 }); nz(c, { ft: 'lowpass', f0: 1500, f1: 400, d: 0.08, v: 0.2, at: 0.12 }); done(c); },
    cash() { const c = ev('cash', busE, 0.6, { room: 0.35, jit: 0, pan: 0 }); arp(c, [83, 88, 91, 95], 0.04, { v: 0.1, d: 0.08, bell: 1 }); nz(c, { ft: 'highpass', f0: 5000, d: 0.25, v: 0.12, at: 0.05 }); done(c); },
    wave(w) { const c = ev('wave', busE, 0.6, { hall: 0.35, jit: 0, pan: 0 }); arp(c, [57, 64, 69], 0.08, { w: 'sawtooth', v: 0.08, d: 0.22, lp: 1800 }); sub(c, 80, 55, 0.3, 0.3); done(c); },
    call() { const c = ev('call', busE, 0.55, { room: 0.3, jit: 0, pan: 0 }); tone(c, { w: 0.25, f0: 220, f1: 1760, slide: 0.18, d: 0.22, v: 0.12, lp: 5000 }); click(c, 0.3, 0.18, 5000); done(c); },
    milestone() { const c = ev('milestone', busE, 0.6, { hall: 0.35, jit: 0, pan: 0 }); arp(c, [69, 72, 76, 81], 0.07, { v: 0.11, d: 0.2, bell: 1 }); done(c); },
    levelup() { duck(-5, 0.03, 0.4, 0.8, true); const c = ev('levelup', busE, 0.65, { hall: 0.45, jit: 0, pan: 0 }); arp(c, [69, 72, 76, 79, 81, 84], 0.07, { v: 0.11, d: 0.3, bell: 1 }); tone(c, { w: 'triangle', f0: note(45), d: 0.8, v: 0.18, at: 0.35 }); done(c); },
    // 6.3 (zone63): arriving in a zone: a soft rising whoosh, then two bell notes pitched per zone
    zone(id) { const r = { drift: 0, hive: 3, iron: -2, skies: 5, ghost: -4, salvage: 2, tempest: -5, demo: -3, choir: 4, oddball: 7 }[id] || 0; const c = ev('zone', busE, 0.5, { hall: 0.5, jit: 0, pan: 0, trim: 5 }); // +5 dB lands it in the notice tier (sfxrender: about -23 dB)
      nz(c, { f0: 300, f1: 2400, q: 1.2, d: 0.7, v: 0.16, a: 0.35, curve: 'lin' }); arp(c, [69 + r, 76 + r], 0.16, { v: 0.1, d: 0.5, bell: 1, at: 0.3 }); done(c); },
    unbreak() { const c = ev('unbreak', busE, 0.6, { hall: 0.4, jit: 0, pan: 0 }); arp(c, [60, 64, 67, 72], 0.05, { v: 0.12, d: 0.4, bell: 1 }); done(c); },
    freeze(e) { if (!allow('freeze', 0.12, 2)) return; const c = ev('freeze', busH, 0.4, { room: 0.35 }, e); fmv(c, { f0: 2794, f1: 1397, r: 3.5, i: 2, d: 0.18, v: 0.15 }); nz(c, { ft: 'highpass', f0: 6000, f1: 3000, d: 0.15, v: 0.25 }); done(c); },
    net(e, t) { if (!allow('net', 0.1, 2)) return; const sp = t && t.spec || 0; const c = ev('net', busH, 0.4, { room: 0.2, tn: sp === 1 ? 'net1' : 'net' }, e);
      if (sp === 1) { sub(c, 150, 55, 0.14, 0.5); nz(c, { ft: 'lowpass', f0: 900, f1: 200, d: 0.12, v: 0.4, lofi: 1 }); tone(c, { w: 0.25, f0: 700, f1: 260, d: 0.09, v: 0.08 }); }
      else { tone(c, { w: 0.25, f0: 1400, f1: 500, d: 0.1, v: 0.12 }); nz(c, { f0: 2500, f1: 900, q: 3, d: 0.1, v: 0.25 }); }
      done(c); },
    // v5.8: a flier swerves toward a Snare Beacon: a soft rising lure (Long Lure: a radar ping)
    lure(e, t) { if (!allow('lure', 0.25, 2)) return; const sp = t && t.spec || 0; const c = ev('lure', busH, 0.35, { room: 0.3, hall: sp === 2 ? 0.2 : 0, tn: sp === 2 ? 'lure2' : 'lure', jit: 0.5 }, t || e);
      if (sp === 2) { tone(c, { w: 'sine', f0: 1320, d: 0.16, v: 0.12 }); tone(c, { w: 'sine', f0: 1320, d: 0.12, v: 0.05, at: 0.16 }); }
      else { tone(c, { w: 'triangle', f0: 520, f1: 880, d: 0.14, v: 0.12, a: 0.03 }); }
      done(c); },
    // 6.4 Gatekeeper: a leak stopped at the gate, a shield clang and a thump
    aegisblock(t) { if (!allow('aegisblock', 0.15, 2)) return; const c = ev('aegisblock', busE, 0.55, { room: 0.35, jit: 0.3 }, t);
      fmv(c, { f0: 880, f1: 830, r: 1.41, i: 2.2, i1: 0.3, d: 0.35, v: 0.16 }); sub(c, 130, 55, 0.12, 0.45); click(c, 0.35, 0, 3500); done(c); },
    // v5.8: a Void Lens locks onto a new target
    lock(t) { if (!allow('lock', 0.08, 2)) return; const c = ev('lock', busW, 0.3, { jit: 0.3, tn: t && t.spec === 2 ? 'lock2' : 'lock' }, t); tone(c, { w: 0.25, f0: 1320, d: 0.025, v: 0.1, lp: 5000 }); tone(c, { w: 0.25, f0: 1760, d: 0.035, v: 0.1, lp: 5000, at: 0.03 }); done(c); },
    // v5.8: Credit Forge payout: one bell per forge, staggered so several forges arpeggiate
    forge(f, i) { i = i || 0; if (i > 7) return; const sp = f && f.spec || 0; const c = ev('forge', busE, 0.5, { room: 0.35, jit: 0, tn: sp === 1 ? 'forge1' : 'forge' }, f);
      c.t += i * 0.07; const m = [76, 79, 83, 88, 91, 95, 100, 103][i] + (sp === 1 ? 0 : -5);
      tone(c, { w: 'sine', f0: note(m), d: 0.25, v: 0.12 }); fmv(c, { f0: note(m + 12), r: 3.5, i: 0.8, d: 0.12, v: 0.05 }); click(c, 0.15, 0, 6000); done(c); },
    // v5.8: a Relay Pylon links a new tower
    pylon(t) { if (!allow('pylon', 0.3, 2)) return; const sp = t && t.spec || 0; const c = ev('pylon', busE, 0.4, { room: 0.3, jit: 0 }, t); arp(c, sp === 2 ? [84, 91] : sp === 1 ? [76, 83] : [79, 86], 0.05, { v: 0.08, d: 0.08 }); done(c); },
    // v5.8 Swarm Missile impact (was the shared 'boom'): a sub, a crunchy blast and a crackle. Napalm Payload adds a rising whoomph
    boomT(p) { if (!allow('boomT', 0.06, 4)) return; const nap = p && p.src && p.src.s && p.src.s.napalm; const c = ev('boomT', busH, 0.55, { room: 0.25, tn: nap ? 'boomT2' : 'boomT' }, p);
      sub(c, 110, 40, 0.18, 0.5); nz(c, { ft: 'lowpass', f0: 2800, f1: 260, d: 0.2, v: 0.45, lofi: 1 }); click(c, 0.25, 0, 2000);
      if (nap) nz(c, { f0: 250, f1: 1100, q: 1.1, d: 0.3, v: 0.35, a: 0.08, curve: 'lin' }); else nz(c, { ft: 'highpass', f0: 3000, d: 0.1, v: 0.12, lofi: 1, at: 0.03 });
      done(c); },
    // v5.8 Cluster Pods bomblets: a cheap little pop
    pop(p) { if (!allow('pop', 0.05, 3)) return; const c = ev('pop', busH, 0.4, { room: 0.12, jit: 2 }, p); click(c, 0.3, 0, 2500); nz(c, { f0: 1800, f1: 500, q: 1.2, d: 0.06, v: 0.4, lofi: 1 }); sub(c, 150, 70, 0.05, 0.25); done(c); },
    // v5.8 EMP Mortar impact: a sub, a noise sweep, a square FM chirp and a crushed buzz. Blackout Shell leaves a 0.4 s buzz tail
    empboom(p) { if (!allow('empboom', 0.06, 3)) return; const sp = p && p.src && p.src.spec || 0; const c = ev('empboom', busH, 0.55, { room: 0.3, tn: sp === 1 ? 'empboom1' : 'empboom' }, p);
      sub(c, 95, 32, 0.22, 0.55); nz(c, { f0: 3500, f1: 250, q: 2, d: 0.22, v: 0.35 }); fmv(c, { f0: 140, f1: 55, r: 7.07, i: 5, d: 0.2, v: 0.14, cw: 'square' });
      tone(c, { w: 0.125, f0: sp === 1 ? 60 : 880, f1: sp === 1 ? 55 : 110, d: sp === 1 ? 0.45 : 0.18, v: sp === 1 ? 0.1 : 0.06, crush: 1, curve: sp === 1 ? 'lin' : undefined });
      done(c); },
    boom(p) { if (!allow('boom', 0.06, 4)) return; const c = ev('boom', busH, 0.55, { room: 0.25 }, p); sub(c, 100, 38, 0.18, 0.5); nz(c, { ft: 'lowpass', f0: 2500, f1: 250, d: 0.2, v: 0.45, lofi: 1 }); click(c, 0.25, 0, 2000); done(c); },
    emp(e) { if (!allow('emp', 0.2, 2)) return; const c = ev('emp', busE, 0.55, { room: 0.3 }, e); nz(c, { f0: 3000, f1: 300, q: 3, d: 0.3, v: 0.35 }); fmv(c, { f0: 110, f1: 55, r: 7.07, i: 4, d: 0.3, v: 0.15, cw: 'square' }); tone(c, { w: 0.125, f0: 880, f1: 110, d: 0.25, v: 0.06, crush: 1 }); done(c); },
    blink(e) { if (!allow('blink', 0.15, 2)) return; const c = ev('blink', busE, 0.45, { room: 0.4 }, e); fmv(c, { f0: 880, f1: 220, r: 3, i: 2.5, i1: 0.05, d: 0.22, v: 0.15 }); tone(c, { w: 0.125, f0: 1760, f1: 3520, d: 0.08, v: 0.05 }); done(c); },
    leak(e) { if (!allow('leak', 0.1, 3)) return; duck(-4, 0.01, 0.05, 0.3); const c = ev('leak', busE, 0.7, { room: 0.3 }, e); sub(c, 150, 50, 0.15, 0.55); nz(c, { ft: 'lowpass', f0: 1500, f1: 300, d: 0.12, v: 0.45, lofi: 1 }); tone(c, { w: 0.125, f0: 466, f1: 233, d: 0.14, v: 0.12, crush: 1 }); done(c); },
    bigleak(e) { duck(-9, 0.01, 0.3, 0.9, true); const c = ev('bigleak', busE, 0.85, { hall: 0.5 }, e); sub(c, 90, 25, 0.6, 0.7); nz(c, { ft: 'lowpass', f0: 1800, f1: 80, d: 0.6, v: 0.6, lofi: 1 }); tone(c, { w: 'sawtooth', f0: 233, f1: 58, d: 0.5, v: 0.14, lp: 1500 }); click(c, 0.5, 0, 1500); done(c); },
    crack(e) { const c = ev('crack', busE, 0.7, { hall: 0.35 }, e); click(c, 0.6, 0, 3000); sub(c, 110, 35, 0.3, 0.5); nz(c, { ft: 'lowpass', f0: 3000, f1: 300, d: 0.4, v: 0.5, lofi: 1 }); fmv(c, { f0: 300, r: 1.41, i: 4, d: 0.35, v: 0.12, cw: 'triangle' }); done(c); },
    storm(s) { const c = ev('storm', busE, 0.45, { hall: 0.5 }, s); nz(c, { f0: 400, f1: 1600, q: 2, d: 0.9, v: 0.25, a: 0.25, curve: 'lin' }); fmv(c, { f0: 330, f1: 660, r: 2, i: 0.6, d: 0.8, v: 0.06, a: 0.15 }); done(c); },
    converge() { duck(-4, 0.1, 0.4, 0.8); const c = ev('converge', busE, 0.6, { hall: 0.5, pan: 0 }); fmv(c, { f0: 220, f1: 880, r: 3, i: 2, d: 0.8, v: 0.15, a: 0.1 }); nz(c, { ft: 'highpass', f0: 1500, f1: 5000, d: 0.7, v: 0.2, a: 0.2 }); done(c); },
    maelstrom() { duck(-7, 0.05, 1, 1.2, true); const c = ev('maelstrom', busE, 0.8, { hall: 0.6, pan: 0 }); sub(c, 30, 55, 1.8, 0.5); sub(c, 70, 25, 0.5, 0.5); fmv(c, { f0: 80, f1: 40, r: 4, i: 5, i1: 0.5, d: 1.4, v: 0.2 }); fmv(c, { f0: 220, f1: 880, r: 3, i: 2, d: 0.8, v: 0.1, at: 0.4 }); done(c); },
    implode() { duck(-6, 0.05, 0.5, 1, true); const c = ev('implode', busE, 0.8, { hall: 0.6, pan: 0 }); fmv(c, { f0: 400, f1: 12, r: 5, i: 6, i1: 0.8, d: 0.8, v: 0.25, mw: 'sawtooth' }); nz(c, { ft: 'lowpass', f0: 1500, f1: 40, d: 0.6, v: 0.4 }); sub(c, 70, 25, 0.4, 0.5, 0.3); done(c); },
    lane() { duck(-5, 0.03, 0.4, 0.8, true); const c = ev('lane', busE, 0.75, { hall: 0.5, pan: 0 }); fmv(c, { f0: 110, f1: 220, r: 7.01, i: 4, d: 0.6, v: 0.16, mw: 'sawtooth' }); sub(c, 60, 30, 0.4, 0.5); nz(c, { f0: 300, f1: 2000, q: 1.5, d: 0.5, v: 0.2, a: 0.2 }); done(c); },
    strikecharge() { const c = ev('strikecharge', busE, 0.55, { hall: 0.3, pan: 0 }); tone(c, { w: 0.25, f0: 220, f1: 1760, slide: 0.55, d: 0.6, v: 0.09, lp: 3000, lp1: 8000 }); nz(c, { ft: 'highpass', f0: 2000, f1: 8000, d: 0.55, v: 0.15, a: 0.3 }); done(c); },
    strike(p) { duck(-6, 0.005, 0.2, 0.6, true); const c = ev('strike', busE, 0.9, { hall: 0.45 }, p); click(c, 0.8, 0, 2500); sub(c, 120, 30, 0.45, 0.8); nz(c, { ft: 'lowpass', f0: 5000, f1: 120, d: 0.6, v: 0.6, lofi: 1 }); fmv(c, { f0: 1200, f1: 40, r: 10, i: 8, i1: 0.2, d: 0.15, v: 0.25 }); done(c); },
    nova() { duck(-8, 0.02, 0.6, 1.2, true); const c = ev('nova', busE, 0.9, { hall: 0.6, pan: 0 }); sub(c, 80, 25, 1.2, 0.7); fmv(c, { f0: 300, f1: 60, r: 3, i: 4, d: 1, v: 0.2 }); nz(c, { ft: 'lowpass', f0: 3000, f1: 100, d: 1, v: 0.45 }); arp(c, [81, 76, 69, 64], 0.08, { w: 'sawtooth', v: 0.06, d: 0.4, lp: 3000, at: 0.05 }); done(c); },
    // 6.2 the Nuke: a crack and a bright blast, two long falling subs, a rumble that rolls on for three seconds and a second,
    // lower roar as the shockwave lands. Deeper and longer than any other sound; music and weapons duck under it
    nuke() { duck(-13, 0.01, 1.6, 2.4, true); const c = ev('nuke', busE, 0.95, { hall: 0.8, pan: 0, jit: 0 });
      click(c, 0.9, 0, 1500); nz(c, { ft: 'lowpass', f0: 7000, f1: 260, d: 0.55, v: 0.6, lofi: 1 });
      sub(c, 72, 17, 2.8, 0.95); sub(c, 46, 20, 3.3, 0.55, 0.12);
      nz(c, { ft: 'lowpass', f0: 1100, f1: 55, q: 0.7, d: 3.3, v: 0.5, a: 0.06 });
      fmv(c, { f0: 88, f1: 26, r: 1.41, i: 5, i1: 0.4, d: 2.5, v: 0.16, at: 0.04, mw: 'sawtooth' });
      nz(c, { ft: 'lowpass', f0: 420, f1: 70, q: 0.8, d: 2.3, v: 0.4, a: 0.25, at: 0.55, lofi: 1 }); done(c); },
    stasis() { duck(-5, 0.05, 0.5, 1, true); const c = ev('stasis', busE, 0.7, { hall: 0.55, pan: 0 }); fmv(c, { f0: 880, f1: 2640, r: 2, i: 0.5, d: 0.6, v: 0.14 }); fmv(c, { f0: 4186, f1: 220, r: 3.5, i: 1.2, d: 0.5, v: 0.08 }); nz(c, { ft: 'highpass', f0: 7000, d: 0.5, v: 0.15, a: 0.05 }); done(c); },
    // v5.1 Sensor Sweep: a sonar ping and a rising sweep
    scan() { const c = ev('scan', busE, 0.6, { hall: 0.55, pan: 0 }); tone(c, { w: 'sine', f0: 1568, f1: 1568, d: 0.5, v: 0.12, a: 0.003 }); tone(c, { w: 'sine', f0: 1568, f1: 1560, d: 0.35, v: 0.05, at: 0.32 }); nz(c, { f0: 600, f1: 4000, q: 3, d: 0.6, v: 0.12, a: 0.25, curve: 'lin' }); done(c); },
    pirate(p) { if (!allow('pirate', 2)) return; const c = ev('pirate', busE, 0.6, { room: 0.4 }, p); arp(c, [62, 67, 71, 74], 0.09, { w: 0.25, v: 0.08, d: 0.14, lp: 3000 }); tone(c, { w: 'sawtooth', f0: 98, f1: 104, d: 0.5, v: 0.07, lp: 800, a: 0.04 }); done(c); },
    overclock() { const c = ev('overclock', busE, 0.7, { room: 0.4, pan: 0 }); tone(c, { w: 'sawtooth', f0: 110, f1: 440, d: 0.5, v: 0.12, lp: 600, lp1: 4000, crush: 1 }); arp(c, [69, 76, 81, 88], 0.06, { v: 0.08, d: 0.1 }); done(c); },
    boss() { if (!allow('boss', 1)) return; duck(-9, 0.05, 1.4, 1.5, true); const c = ev('boss', busE, 0.9, { hall: 0.6, pan: 0 }); sub(c, 55, 30, 1.2, 0.7); tone(c, { w: 'sawtooth', f0: 55, f1: 58, d: 1.6, v: 0.12, lp: 300, lp1: 1600, a: 0.3 }); tone(c, { w: 'sawtooth', f0: 82.4, f1: 87, d: 1.6, v: 0.1, lp: 300, lp1: 1600, a: 0.3 }); fmv(c, { f0: 110, f1: 55, r: 4, i: 5, i1: 0.5, d: 1.4, v: 0.14 }); nz(c, { ft: 'lowpass', f0: 700, f1: 150, d: 1.2, v: 0.3 }); done(c); },
    bossdie(e) { duck(-9, 0.02, 0.8, 1.4, true); const c = ev('bossdie', busE, 0.9, { hall: 0.6 }, e); click(c, 0.6, 0, 2000); sub(c, 90, 22, 1, 0.7); nz(c, { ft: 'lowpass', f0: 4000, f1: 120, d: 1, v: 0.55, lofi: 1 }); arp(c, [69, 72, 76, 81, 84, 88], 0.06, { v: 0.1, d: 0.35, bell: 1, at: 0.25 }); done(c); },
    gameover() { duck(-12, 0.1, 2, 2, true); const c = ev('gameover', busE, 0.9, { hall: 0.7, pan: 0 }); fmv(c, { f0: 400, f1: 18, r: 5, i: 6, i1: 0.8, d: 1.8, v: 0.25, mw: 'sawtooth' }); sub(c, 55, 18, 1.8, 0.6); arp(c, [69, 65, 62, 57], 0.3, { w: 'triangle', v: 0.14, d: 0.6 }); done(c); },
    // the oddballs keep their jokes, rebuilt with the new voices
    quack(e) { if (!allow('quack', 0.3)) return; const c = ev('quack', busE, 0.7, { room: 0.3, jit: 1 }, e); for (const at of [0, 0.15]) { fmv(c, { f0: 540, f1: 330, r: 1.01, i: 3, d: 0.12, v: 0.2, cw: 'sawtooth', at }); nz(c, { f0: 1200, q: 4, d: 0.1, v: 0.15, at }); } done(c); },
    meow(e) { if (!allow('meow', 0.4)) return; const c = ev('meow', busE, 0.6, { room: 0.35, jit: 1 }, e); fmv(c, { f0: 620, f1: 980, r: 2, i: 1.2, d: 0.16, v: 0.16, vib: [9, 0.02] }); fmv(c, { f0: 980, f1: 470, r: 2, i: 1.2, d: 0.32, v: 0.15, at: 0.15 }); done(c); },
    whale(e) { if (!allow('whale', 1)) return; const c = ev('whale', busE, 0.6, { hall: 0.8 }, e); tone(c, { w: 'sine', f0: 180, f1: 260, d: 1.2, v: 0.16, a: 0.3, vib: [4, 0.015] }); tone(c, { w: 'sine', f0: 260, f1: 140, d: 1.1, v: 0.12, a: 0.2, at: 1.1, vib: [5, 0.02] }); done(c); },
    blorp(e) { if (!allow('blorp', 0.2)) return; const c = ev('blorp', busE, 0.6, { room: 0.3, jit: 2 }, e); tone(c, { w: 'sine', f0: 440, f1: 70, d: 0.18, v: 0.3 }); nz(c, { ft: 'lowpass', f0: 700, q: 6, f1: 200, d: 0.12, v: 0.25 }); done(c); },
  };
  function play(name, arg, arg2) {
    if (!ctx || (!offline && ctx.state !== 'running') || !busW) return;
    if (WEAP[name] || HIT[name] || name === 'die') { // 6.2: placed once by camera distance; a far one is thinned out before it builds anything
      const P = prox(arg); if (P && P.far && !allow(name + '~far', 0.25, 1)) return;
      curP = P; try { return WEAP[name] ? WEAP[name](arg, arg2) : HIT[name] ? HIT[name](arg, arg2) : die(arg); } finally { curP = null; } }
    if (name === 'bosswarn') return EVT.boss(arg);
    if (name === 'combo') { const n = typeof arg === 'string' ? arg : arg && arg.n; if (!COMBO[n] || !allow('combo' + n, 0.12, 2)) return; const c = ev('combo' + n, busE, 0.6, { room: 0.3 }, typeof arg === 'object' ? arg : null); COMBO[n](c); done(c); return; }
    if (name === 'ui' || name === 'deny') { if (!allow(name, name === 'ui' ? 0.03 : 0.1)) return; return UIS[name](); }
    if (EVT[name]) return EVT[name](arg, arg2);
  }
  // Void Lens: one shared beam hum. Its level follows how many beams are firing; its pitch climbs as they ramp up.
  // v5.8: eh / pr = share of firing Lenses that are Event Horizon (a sub octave under the hum) or Prism Split (a wider chorus)
  let beamOn = 0, beamOff = 0;
  // 6.2: pk = the firing Lenses' average camera-distance gain (prox), so the hum fades when the beams are off screen
  function beams(n, ramp, eh, pr, pk) {
    if (!ctx || (!offline && ctx.state !== 'running') || !busW) return;
    if (!beamV) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(), o4 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      const g3 = ctx.createGain(), g4 = ctx.createGain();
      o1.type = 'sawtooth'; o2.setPeriodicWave(pulseWave(0.25)); o3.type = 'sine'; o4.type = 'sawtooth'; o1.frequency.value = 110; o2.frequency.value = 110.6; o3.frequency.value = 55; o4.frequency.value = 109;
      f.type = 'lowpass'; f.Q.value = 3; f.frequency.value = 600;
      lfo.frequency.value = 7; lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency);
      g.gain.value = 0; g3.gain.value = 0; g4.gain.value = 0; o1.connect(f); o2.connect(f); o4.connect(g4); g4.connect(f); f.connect(g); o3.connect(g3); g3.connect(g); g.connect(busW);
      o1.start(); o2.start(); o3.start(); o4.start(); lfo.start(); beamV = { o1, o2, o3, o4, g3, g4, f, g };
    }
    const t = T(), k = Math.min(1, ramp || 0), on = n > 0;
    // 6.0.1: quieter (it is a constant drone, so the glue compressor pulled everything else down under it), and it settles to 65%
    // after 2.5 s of steady firing; a fresh burst after a second of silence swells back to full
    if (on) { if (!beamOn || t - beamOff > 1) beamOn = t; beamOff = t; } else if (beamOn && t - beamOff > 1) beamOn = 0;
    const settle = on && beamOn && t - beamOn > 2.5 ? 0.65 : 1;
    beamV.g.gain.setTargetAtTime(on ? Math.min(0.055, 0.022 + 0.012 * Math.log2(1 + n)) * settle * (pk === undefined ? 1 : pk) : 0, t, on ? (settle < 1 ? 0.8 : 0.05) : 0.12);
    const f0 = 98 * semi(k * 12), w = 0.005 + 0.012 * (pr || 0);
    beamV.o1.frequency.setTargetAtTime(f0, t, 0.1); beamV.o2.frequency.setTargetAtTime(f0 * (1 + w), t, 0.1); beamV.o4.frequency.setTargetAtTime(f0 * (1 - w), t, 0.1);
    beamV.o3.frequency.setTargetAtTime(f0 / 2, t, 0.1);
    beamV.g3.gain.setTargetAtTime(1.4 * (eh || 0), t, 0.15); beamV.g4.gain.setTargetAtTime(0.8 * (pr || 0), t, 0.15);
    beamV.f.frequency.setTargetAtTime(450 + 1500 * k, t, 0.1); // 6.0.1: a little less bright at full ramp
  }
  // v5.8 Flame Projector: one continuous roar for every projector that is firing (n), like the Lens hum. A noise band around
  // 600 Hz with an 11 Hz flutter and a lo-fi crackle; Inferno (inf share) adds a low rumble, Plasma Torch (pl share) a crushed 110 Hz buzz
  let flameV = null;
  function flames(n, inf, pl) {
    if (!ctx || (!offline && ctx.state !== 'running') || !busW) return;
    if (!flameV) {
      if (!n) return;
      const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), fl = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
      src.buffer = noiseBuf; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.8;
      lfo.frequency.value = 11; lg.gain.value = 0.35; fl.gain.value = 0.65; lfo.connect(lg); lg.connect(fl.gain);
      const cr = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), cg = ctx.createGain(), clfo = ctx.createOscillator(), clg = ctx.createGain();
      cr.buffer = noiseLo; cr.loop = true; cr.playbackRate.value = 0.7; hp.type = 'highpass'; hp.frequency.value = 3200; cg.gain.value = 0.12; clfo.type = 'square'; clfo.frequency.value = 17; clg.gain.value = 0.12; clfo.connect(clg); clg.connect(cg.gain);
      const rb = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), rg = ctx.createGain();
      rb.buffer = noiseBuf; rb.loop = true; lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 1.5; rg.gain.value = 0;
      const bz = ctx.createOscillator(), bg = ctx.createGain(); bz.type = 'square'; bz.frequency.value = 110; bg.gain.value = 0;
      g.gain.value = 0;
      src.connect(bp); bp.connect(fl); fl.connect(g); cr.connect(hp); hp.connect(cg); cg.connect(g); rb.connect(lp); lp.connect(rg); rg.connect(g); bz.connect(bg); bg.connect(crushIn);
      g.connect(busW);
      for (const o of [src, cr, rb, lfo, clfo, bz]) o.start(T(), 0);
      flameV = { g, rg, bg, bp };
    }
    const t = T(), on = n > 0;
    const lvl = on ? Math.min(0.3, (0.08 + 0.045 * Math.log2(1 + n)) * 1.5) : 0;
    flameV.g.gain.setTargetAtTime(lvl, t, on ? 0.04 : 0.1);
    flameV.rg.gain.setTargetAtTime(on ? 1.6 * (inf || 0) : 0, t, 0.1);
    flameV.bg.gain.setTargetAtTime(on ? 0.03 * (pl || 0) * Math.min(1, 0.5 + 0.25 * n) : 0, t, on ? 0.05 : 0.1);
    flameV.bp.frequency.setTargetAtTime(600 * (pl ? 1 + 0.4 * pl : 1) * (inf ? 1 - 0.2 * inf : 1), t, 0.2);
  }
  // low core: a soft double heartbeat whose rate climbs as the hull falls (k = 0 healthy … 1 critical)
  function danger(k, dt) {
    if (!ctx || ctx.state !== 'running' || !busE || k <= 0) { dangerT = 0; return; }
    dangerT -= dt; if (dangerT > 0) return;
    dangerT = 1.1 - 0.5 * k;
    const c = ev('heart', busE, 0.25 + 0.3 * k, { jit: 0, pan: 0 }); sub(c, 70, 45, 0.12, 0.5); sub(c, 62, 40, 0.14, 0.4, 0.2); done(c);
  }
  // offline rendering for tests: play(name) into an OfflineAudioContext at time t
  function offlineCtx(oc) { ctx = oc; offline = true; tBase = 0; beamV = null; flameV = null; buildMasterOffline(); }
  function buildMasterOffline() {
    limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
    master = ctx.createGain(); master.gain.value = 1; sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; musBus = ctx.createGain(); musBus.gain.value = musVol;
    sfxBus.connect(limiter); limiter.connect(master); buildOut(master, ctx.destination);
    makeNoise(); buildBuses(); hookMusic();
  }
  function makeNoise() {
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // lo-fi noise: sample-and-hold every 6 samples, NES-style grit
    noiseLo = ctx.createBuffer(1, len, ctx.sampleRate); const e = noiseLo.getChannelData(0); let v = 0;
    for (let i = 0; i < len; i++) { if (i % 6 === 0) v = Math.random() * 2 - 1; e[i] = v; }
  }

  // ================= v4.8 DRIFT STUDIO II: ten true genres =================
  // A generative composer built from genre research (docs/music-research.md): each genre is a recipe of
  //  - tempo range and swing (MPC convention; microtiming only for the human genres: lo-fi, trip hop, dub, breaks)
  //  - drum MAPS in the style of Mutable Instruments Grids: a level 0-9 per step per voice. A step fires when its level beats
  //    the voice's density (set by Energy and the section), so thinning and filling stay idiomatic (backbone first, ghosts last)
  //  - curated chord loops (Roman numerals in the genre's modes), an extension depth and a voicing rule: jazz (rootless, common
  //    tones, stepwise top voice), plane (one shape moved in parallel, Detroit and deep house), pad (closest inversions), open
  //    (ambient fifths and add9), triad (skank and chip)
  //  - a bass line generator, a keys rhythm, a pad, an arp and a lead with its own rhythm grammar and scale
  //  - an arrangement form over four 8-bar phrases (intro, groove, breakdown with a snare roll and riser, drop; or A A' B A''; or
  //    a dub version with drop-outs and echo throws) and its own mix: reverb size, echo time, sidechain pump, tape, tone
  // Each piece = genre + flavour (picked by Energy) + seed. Everything after the flavour comes from mulberry32(seed), so a saved
  // piece replays exactly. Energy sets the density and layers; Follow is how far the battle pushes Energy up and down.
  const Music = (() => {
    let timer = null, nextT = 0, battle = 0.15, targetB = 0.15, scene = 'menu', mood = 'calm', running = false;
    let mIn = null, scG = null, toneLP = null, comp = null, outAn = null, wowD = null, wowG = null, crushWS = null, crushMix = null, cleanMix = null;
    let revA = null, revB = null, revAG = null, revBG = null, revUse = 0, revSend = null, revRet = null, gateConv = null, gateG = null;
    let echoIn = null, echoL = null, echoR = null, echoFb = null, echoRet = null, vinylG = null, hissG = null;
    const CH = {}, AN = {}; let L = {};
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    let R = Math.random;
    const pick = a => a[Math.floor(R() * a.length)], chance = p => R() < p, rr = (a, b) => a + R() * (b - a);
    const wpick = (a, w) => { let t = 0; for (const x of w) t += x; let r = R() * t; for (let i = 0; i < a.length; i++) { r -= w[i]; if (r <= 0) return a[i]; } return a[0]; };
    const NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
    const MODES = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
      mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], phrydom: [0, 1, 4, 5, 7, 8, 10] }; // 6.3: phrygian dominant (boss themes only)
    const MODE_NAME = { ionian: 'major', dorian: 'dorian', phrygian: 'phrygian', lydian: 'lydian', mixolydian: 'mixolydian', aeolian: 'minor', harmonic: 'harmonic minor', phrydom: 'phrygian dominant' };
    // v5.5.8 musician's pass: a triad's quality on a degree of a mode; a loop fits a mode when it lands on no diminished or
    // augmented triad it did not ask for (the audit found 30 such combinations, e.g. Lydian I-iv°, Dorian i-vi°, minor i-ii°)
    function triadQ(mode, d) { const sc = MODES[mode] || MODES.aeolian, dd = ((d % 7) + 7) % 7, t = (sc[(dd + 2) % 7] - sc[dd] + 12) % 12, f = (sc[(dd + 4) % 7] - sc[dd] + 12) % 12; return t === 3 && f === 6 ? 'dim' : t === 4 && f === 8 ? 'aug' : t === 3 ? 'm' : 'M'; }
    const loopOK = (L0, mode) => L0.degs.every((d, i) => (L0.q && L0.q[i]) || !/dim|aug/.test(triadQ(mode, d)));
    const PENT = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
    // a chord loop: degrees (0 = i/I) in the mode, optional per-chord quality override ('M' major triad, 'm' minor, '7' dominant 7,
    // 's2'/'s4' sus) and bars per chord. Loops come from the research: Axis (i-VI-III-VII), Nightcall, Kerri Chandler, ii-V-I...
    const C = (degs, q, bars) => ({ degs, q: q || [], bars: bars || 1 });

    // ---------------- the ten genres ----------------
    // drum voice keys: K kick, S snare, C clap, H closed hat, O open hat, R rim, D ride, P shaker/perc. Maps are 16 or 32 chars.
    const GENRES = {
      ambient: { trim: 0.55, name: 'Ambient', col: '#8fd8ff', bpm: [60, 72, 90], swing: 0.5, human: 0, form: 'flow', keyR: [48, 55],
        blurb: 'Drifting pads, bells on loops that never line up, no beat',
        flavours: {
          drift: { name: 'Drift', hard: 0, modes: ['lydian', 'ionian', 'mixolydian'], loops: [C([0, 1], [], 4), C([0, 3, 0, 4], [], 2), C([0], [], 8), C([0, 5, 3, 0], [], 2)] },
          glass: { name: 'Glass', hard: 0.3, ftrim: 0.85, modes: ['ionian', 'lydian', 'dorian'], arp: { kind: 'glass', rate: 4, oct: 2, lv: 0.2 }, loops: [C([0, 3], [], 2), C([5, 3, 0, 4], [], 2), C([0, 4, 5, 3], [], 2)] },
          void: { name: 'Deep Space', hard: 0.45, ftrim: 1.0, modes: ['phrygian', 'aeolian'], pad: { kind: 'dark', lv: 0 }, bass: { kind: 'sub', line: 'long', lv: 0 }, lead: { kind: 'theremin', grammar: 'long', scale: 'mode', lv: 0.3, oct: 72 }, loops: [C([0, 1], [], 4), C([0], [], 8), C([0, 6, 5, 6], [], 2)] }, // 6.3
          nocturne: { name: 'Nocturne', hard: 0.15, ftrim: 0.72, modes: ['aeolian', 'dorian'], keys: { kind: 'piano', rhythm: 'broken', lv: 0 }, loops: [C([0, 5, 2, 6], [], 2), C([0, 3, 0, 4], [], 2), C([0, 6, 5, 6], [], 2)] },
        },
        ext: 4, voicing: 'open', drums: { K: '3000000000000000', P: '2002002002002000' }, kit: 'soft',
        bass: { kind: 'sub', line: 'long', lv: 0.15 }, pad: { kind: 'warm', lv: 0 }, keys: null, arp: null,
        lead: { kind: 'bell', grammar: 'drone', scale: 'pentmajor', lv: 0.25, oct: 79 }, mix: { rev: 1.05, revS: 5.5, echo: 0.35, div: 1.5, fb: 0.45, side: 0, tone: 12000, tape: 0.15, crackle: 0, pump: 0 } },
      lofi: { trim: 1.1, name: 'Lo-fi Hip Hop', short: 'Lo-fi', col: '#ffb877', bpm: [70, 80, 90], swing: 0.58, human: 12, form: 'song', keyR: [45, 52],
        blurb: 'Dusty swung drums, jazz chords on a warm Rhodes, tape wobble and crackle',
        flavours: {
          jazzhop: { name: 'Jazzhop', hard: 0.5, modes: ['ionian', 'dorian'], loops: [C([1, 4, 0, 0], ['m', '7']), C([1, 4, 0, 3]), C([0, 5]), C([3, 2, 5, 5]), C([1, 4, 0, 5])] },
          boombap: { name: 'Boom Bap', ftrim: 0.78, hard: 0.75, modes: ['aeolian', 'dorian'], bpmX: 1.08, swing: 0.6, keys: { kind: 'piano', rhythm: 'comp', lv: 0 }, drums: { K: '90000000090000009000000009009000', S: '0000900000009000', H: '7070707070707070' }, loops: [C([0, 5], [], 2), C([0, 3, 5, 4], ['m7', 'm7', 'M7', 'm7']), C([0, 0, 5, 5], ['m', 'm7', 'M7', '6'])] }, // 6.3
          bedroom: { name: 'Bedroom', ftrim: 1.1, hard: 0.1, modes: ['ionian', 'lydian'], bpmX: 0.9, kit: 'soft', lead: { kind: 'glass', grammar: 'sparse', scale: 'pentmajor', lv: 0.45, oct: 79 }, loops: [C([0, 1], [], 2), C([0, 4, 5, 3]), C([3, 4, 0, 5])] }, // 6.3
          rainy: { name: 'Rainy Day', hard: 0.25, modes: ['aeolian'], keys: { kind: 'piano', rhythm: 'lofi', lv: 0 }, loops: [C([3, 0, 3, 0], [], 1), C([0, 5, 4, 4], ['m', 'M', '7', '7']), C([0, 3], [], 2), C([5, 4, 0, 0])] },
        },
        ext: 5, voicing: 'jazz', kit: 'dusty',
        drums: { K: '90000000060000039000000000600000', S: '0000900000009002', H: '7052705070527050', O: '00000000000000000000000000000040', P: '3232323232323232' },
        fill: 'drop', bass: { kind: 'upright', line: 'lofi', lv: 0.2 }, pad: null, keys: { kind: 'rhodes', rhythm: 'lofi', lv: 0 }, arp: null,
        lead: { kind: 'flute', grammar: 'sparse', scale: 'pent', lv: 0.5, oct: 72 }, mix: { rev: 0.35, revS: 1.6, echo: 0.2, div: 0.75, fb: 0.3, side: 0.25, tone: 8000, tape: 0.7, crackle: 0.7, pump: 0.15 } },
      downtempo: { trim: 0.92, name: 'Trip Hop', col: '#c58cff', bpm: [76, 88, 100], swing: 0.55, human: 10, form: 'song', keyR: [45, 50],
        blurb: 'Slow heavy breaks, dark minor strings, dub bass and a theremin-like lead',
        flavours: {
          triphop: { name: 'Trip Hop', hard: 0.6, modes: ['aeolian', 'harmonic', 'phrygian'], halftime: 1, loops: [C([0, 5], [], 2), C([0, 1], [], 2), C([0, 0, 0, 0], ['m', 'mM7', 'm7', 'm6']), C([0, 5, 4], ['m', 'M', '7'], 2), C([0, 3, 6, 2])] },
          cinematic: { name: 'Cinematic', ftrim: 0.83, hard: 0.5, modes: ['harmonic', 'aeolian'], bpmX: 0.92, keys: { kind: 'piano', rhythm: 'broken', lv: 0 }, lead: { kind: 'glass', grammar: 'long', scale: 'mode', lv: 0.5, oct: 79 }, loops: [C([0, 5, 3, 4], ['m', 'M', 'm', '7']), C([0, 3, 4, 0], ['m', 'm', '7', 'm']), C([0, 3], [], 2)] }, // 6.3
          noir: { name: 'Noir', ftrim: 1.13, hard: 0.4, modes: ['dorian', 'aeolian'], swing: 0.6, kit: 'dusty', bass: { kind: 'upright', line: 'walk' }, keys: { kind: 'rhodes', rhythm: 'comp', lv: 0 }, pad: null, lead: { kind: 'melodica', grammar: 'call', scale: 'mode', lv: 0.5, oct: 72 }, drums: { K: '9000000000900000', S: '0000900000009000', H: '6006600660066006', D: '4040404040404040' }, loops: [C([0, 3], ['m7', '7'], 2), C([1, 4, 0, 0], ['m7', '7', 'm7', 'm7']), C([0, 6], ['m7', '7'], 2)] }, // 6.3
          chillout: { name: 'Chillout', hard: 0.3, modes: ['dorian', 'aeolian'], loops: [C([0, 3, 6, 2]), C([0, 6, 5, 6]), C([0, 3], [], 2)], keys: { kind: 'rhodes', rhythm: 'comp', lv: 0 } },
        },
        ext: 4, voicing: 'pad', kit: 'break',
        drums: { K: '9000000605000000', S: '0000900203009000', H: '6040604060406040', P: '0000000000000030' },
        fill: 'drop', bass: { kind: 'dub', line: 'dubby', lv: 0.2 }, pad: { kind: 'strings', lv: 0 }, keys: { kind: 'rhodes', rhythm: 'comp', lv: 0.3 }, arp: null,
        lead: { kind: 'theremin', grammar: 'long', scale: 'mode', lv: 0.55, oct: 74 }, mix: { rev: 0.5, revS: 2.2, echo: 0.3, div: 0.75, fb: 0.4, side: 0.15, tone: 9000, tape: 0.45, crackle: 0.45, pump: 0.15 } },
      synthwave: { trim: 1.25, name: 'Synthwave', col: '#ff5fa8', bpm: [88, 104, 128], swing: 0.5, human: 0, form: 'dance', keyR: [45, 52],
        blurb: 'Gated-reverb snares, 8th-note saw bass, Juno arps and a big 80s lead',
        flavours: {
          outrun: { name: 'Outrun', hard: 0.6, modes: ['aeolian'], drums: { K: '9000900090009000' }, loops: [C([0, 5, 2, 6]), C([0, 6, 5, 3], ['m', '6', 'M', 'm']), C([0, 5, 6, 5], ['m', 'M7', 'M', 'M7']), C([5, 6, 4, 5], ['M', 'M', 'm', 'M'])] },
          dreamwave: { name: 'Dreamwave', hard: 0.3, modes: ['ionian', 'aeolian'], bpmX: 0.92, drums: { K: '9000000090600000' }, loops: [C([0, 5, 2, 4]), C([0, 5, 3, 4]), C([5, 3, 0, 4])] },
          chase: { name: 'Chase', hard: 0.8, modes: ['aeolian', 'dorian'], bpmX: 1.12, bass: { kind: 'sawoct', line: 'gallop' }, lead: { kind: 'pulse', grammar: 'riff' }, drums: { K: '9000900090009000', S: '0000900000009000', H: '4444444444444444' }, loops: [C([0, 6, 5, 6]), C([0, 5, 6, 0]), C([0, 3, 6, 4], ['m', 'M', 'M', 'M'])] }, // 6.3
          darksynth: { name: 'Darksynth', hard: 0.95, modes: ['phrygian', 'harmonic'], bpmX: 1.15, drive: 1, drums: { K: '9000900090009006' }, loops: [C([0, 1, 3, 4], ['m', 'M', 'm', 'M']), C([0, 1], [], 2), C([0, 5, 1, 4], ['m', 'M', 'M', 'M'])] },
        },
        ext: 3, voicing: 'pad', kit: 'linn',
        drums: { K: '9000600090006000', S: '0000900000009000', H: '7454045474540454', O: '0000000000000005' },
        fill: 'toms', bass: { kind: 'sawoct', line: 'octave', lv: 0.15 }, pad: { kind: 'juno', lv: 0 }, keys: null, arp: { kind: 'juno', rate: 16, oct: 2, lv: 0.35 },
        lead: { kind: 'saw', grammar: 'anthem', scale: 'mode', lv: 0.55, oct: 72 }, mix: { rev: 0.6, revS: 2.6, echo: 0.3, div: 0.75, fb: 0.35, side: 0.45, tone: 14000, tape: 0.15, crackle: 0, pump: 0.45 } },
      house: { trim: 1.3, name: 'House', col: '#ffd84a', bpm: [118, 124, 128], swing: 0.55, human: 0, form: 'dance', keyR: [43, 50],
        blurb: 'Four to the floor, offbeat hats, minor-9 stabs or piano and an organ bass',
        flavours: {
          deep: { name: 'Deep House', hard: 0.4, modes: ['aeolian', 'dorian'], bpmX: 0.985, keys: { kind: 'stab', rhythm: 'deep', lv: 0 }, bass: { kind: 'sub', line: 'deep' }, voicing: 'plane', ext: 5,
            loops: [C([0, 3], [], 1), C([0, 4, 3]), C([0, 2, 4], ['m7', 'M7', 'm7']), C([5, 4], ['M7', 'm7'], 1), C([0], [], 2)] },
          disco: { name: 'Disco House', hard: 0.7, modes: ['dorian', 'mixolydian'], bpmX: 1.01, swing: 0.52, keys: { kind: 'organ', rhythm: 'disco', lv: 0.2 }, bass: { kind: 'sawoct', line: 'disco' }, filterLoop: 1,
            drums: { H: '4646464646464646', O: '0070007000700070' }, loops: [C([1, 4], ['m7', '7']), C([0, 6, 3], ['M', 'M', 'M']), C([0, 3], ['m7', '7'])] },
          tech: { name: 'Tech House', ftrim: 1.5, hard: 0.8, modes: ['aeolian', 'dorian'], bpmX: 1.01, swing: 0.54, keys: { kind: 'stab', rhythm: 'techno', lv: 0.2 }, pad: null, bass: { kind: 'saw', line: 'rolling' }, lead: { kind: 'bleep', grammar: 'bleep', lv: 0.6 }, voicing: 'plane', drums: { H: '0060006000600060', R: '0000003000000300', P: '3323332333233323' }, loops: [C([0], [], 4), C([0, 6], [], 2), C([0, 0, 3, 3])] }, // 6.3
          piano: { name: 'Piano House', hard: 0.6, modes: ['ionian', 'mixolydian'], keys: { kind: 'piano', rhythm: 'offbeat', lv: 0 }, bass: { kind: 'organ', line: 'organ' }, voicing: 'triad', ext: 3,
            loops: [C([0, 4, 5, 3]), C([5, 3, 0, 4]), C([0, 6, 3], ['M', 'M', 'M']), C([1, 4, 0, 5], ['m7', '7', 'M7', 'm7'])] },
        },
        ext: 4, voicing: 'jazz', kit: '909',
        drums: { K: '9000900090009000', C: '0000800000008000', H: '3060306030603060', O: '0000005000000050', P: '2324232423242324' },
        fill: 'kickdrop', bass: { kind: 'sub', line: 'deep', lv: 0.1 }, pad: { kind: 'warm', lv: 0.3 }, keys: { kind: 'stab', rhythm: 'deep', lv: 0 }, arp: null,
        lead: { kind: 'piano', grammar: 'riff', scale: 'pent', lv: 0.7, oct: 72 }, mix: { rev: 0.35, revS: 1.8, echo: 0.35, div: 0.75, fb: 0.35, side: 0.5, tone: 15000, tape: 0.1, crackle: 0, pump: 0.5 } },
      techno: { trim: 1.4, name: 'Techno', col: '#6ae2ff', bpm: [122, 128, 140], swing: 0.5, human: 0, form: 'dance', keyR: [41, 48],
        blurb: 'Relentless kick, rims and 909 hats, parallel stabs into long echoes, or a squelching 303',
        flavours: {
          detroit: { name: 'Detroit', hard: 0.5, filterLoop: 1, modes: ['aeolian', 'dorian'], bpmX: 0.97, swing: 0.56, keys: { kind: 'stab', rhythm: 'techno', lv: 0 }, pad: { kind: 'strings', lv: 0.3 }, loops: [C([0], [], 2), C([0, 6]), C([0, 0, 3, 3]), C([0, 2], [], 2)] },
          minimal: { name: 'Dub Techno', hard: 0.35, modes: ['aeolian', 'dorian'], keys: { kind: 'stab', rhythm: 'dubtechno', lv: 0 }, drums: { C: '0000000000000000', H: '0000000000000000', P: '0040040040040000' }, mixO: { echo: 0.65, fb: 0.6, div: 0.75, rev: 0.6, revS: 5 }, loops: [C([0], [], 4), C([0, 6], [], 2)] },
          industrial: { name: 'Industrial', hard: 1, modes: ['phrygian', 'aeolian'], bpmX: 1.06, kit: 'hard', keys: { kind: 'stab', rhythm: 'techno', lv: 0 }, drums: { R: '0000000000000000', X: '0000000600000006', C: '0000700000007000', H: '3333333333333333', D: '0000000000000000' }, loops: [C([0], [], 4), C([0, 1], [], 2)] }, // 6.3
          acid: { name: 'Acid', hard: 0.9, modes: ['aeolian', 'phrygian'], bpmX: 1.04, bass: { kind: 'acid', line: 'acid' }, keys: null, loops: [C([0], [], 4), C([0, 1], [], 2), C([0, 6], [], 2)] },
        },
        ext: 4, voicing: 'plane', kit: '909',
        drums: { K: '9000900090009000', R: '0060000600600060', H: '0000000000000000', O: '0080008000800080', C: '0000300000003000', D: '2222222222222222' },
        fill: 'none', bass: { kind: 'sub', line: 'rumble', lv: 0.1 }, pad: null, keys: { kind: 'stab', rhythm: 'techno', lv: 0 }, arp: null,
        lead: { kind: 'bleep', grammar: 'bleep', scale: 'pent', lv: 0.75, oct: 76 }, mix: { rev: 0.4, revS: 3, echo: 0.4, div: 0.75, fb: 0.45, side: 0.4, tone: 16000, tape: 0.05, crackle: 0, pump: 0.35 } },
      trance: { trim: 0.66, name: 'Trance', col: '#9a8cff', bpm: [128, 138, 142], swing: 0.5, human: 0, form: 'trance', keyR: [42, 49],
        blurb: 'Rolling offbeat bass, gated supersaw chords, a long breakdown and a snare-roll build',
        flavours: {
          uplifting: { name: 'Uplifting', hard: 0.8, ftrim: 0.85, modes: ['aeolian'], loops: [C([0, 5, 2, 6]), C([5, 6, 0, 0]), C([0, 3, 5, 4], ['m', 'm', 'M', 'm']), C([0, 6, 5, 4], ['m', 'M', 'M', 'M'])] },
          psy: { name: 'Psy', ftrim: 2.0, hard: 0.95, modes: ['phrygian', 'harmonic'], bpmX: 1.04, bass: { kind: 'acid', line: 'rolling' }, pad: { kind: 'dark', lv: 0.2 }, keys: null, lead: { kind: 'saw', grammar: 'riff', lv: 0.45 }, arp: { kind: 'pluck', rate: 16, oct: 1, lv: 0.3 }, drums: { O: '0080008000800080', H: '3333333333333333', C: '0000600000006000' }, loops: [C([0], [], 4), C([0, 1], [], 2), C([0, 1, 0, 6])] }, // 6.3
          techtrance: { name: 'Tech Trance', ftrim: 1.9, hard: 0.65, modes: ['aeolian'], bpmX: 0.98, keys: { kind: 'stab', rhythm: 'techno', lv: 0 }, arp: { kind: 'juno', rate: 8, oct: 2, lv: 0.4 }, drums: { R: '0060000600600060', H: '0303030303030303' }, loops: [C([0, 5], [], 2), C([0, 6, 5, 6]), C([0], [], 4)] }, // 6.3
          progressive: { name: 'Progressive', hard: 0.45, ftrim: 1.25, filterLoop: 1, modes: ['aeolian', 'dorian'], bpmX: 0.94, bass: { kind: 'saw', line: 'offbeat' }, keys: { kind: 'pluck', rhythm: 'trancepluck', lv: 0.2 }, loops: [C([0, 5], [], 2), C([0, 5, 2, 6], [], 2), C([0, 3], [], 2)] },
        },
        ext: 3, voicing: 'pad', kit: '909',
        drums: { K: '9000900090009000', O: '0080008000800080', H: '3434343434343434', C: '0000700000007000' },
        fill: 'roll', bass: { kind: 'saw', line: 'rolling', lv: 0.1 }, pad: { kind: 'supersaw', lv: 0 }, keys: { kind: 'gate', rhythm: 'gate', lv: 0.3 }, arp: { kind: 'pluck', rate: 16, oct: 2, lv: 0.55 },
        lead: { kind: 'supersaw', grammar: 'trance', scale: 'mode', lv: 0.5, oct: 72 }, mix: { rev: 0.7, revS: 4, echo: 0.35, div: 0.75, fb: 0.35, side: 0.6, tone: 15000, tape: 0, crackle: 0, pump: 0.65 } },
      dnb: { trim: 0.8, name: 'Drum & Bass', short: 'DnB', col: '#59f0b4', bpm: [165, 174, 178], swing: 0.5, human: 4, form: 'dnb', keyR: [41, 46],
        blurb: 'Two-step breaks at 174 with ghost snares, soulful minor-9 chords, deep sub or a growling Reese',
        flavours: {
          liquid: { name: 'Liquid', hard: 0.5, modes: ['aeolian', 'dorian'], loops: [C([0, 2, 4, 0], ['m9', 'M7', 'm7', 'm9']), C([0, 5, 6, 0]), C([3, 4, 2, 5], ['M7', '7', 'm7', 'm7']), C([0, 3], [], 2)] },
          jungle: { name: 'Jungle', ftrim: 1.45, hard: 0.7, modes: ['dorian', 'aeolian'], swing: 0.53, bass: { kind: 'sub', line: 'long' }, keys: { kind: 'stab', rhythm: 'dubtechno', lv: 0.2 }, pad: { kind: 'strings', lv: 0.2 }, drums: { K: '90000000009000009000000000000000', S: '00009003003090030000900300309020', H: '0060006000600060', D: '0000000000000000', P: '3232323232323232' }, loops: [C([0, 6], [], 2), C([0], [], 4), C([0, 3], ['m7', 'm7'], 2)] }, // 6.3
          neuro: { name: 'Neuro', ftrim: 2.0, hard: 1, modes: ['phrygian', 'aeolian'], bass: { kind: 'wobble', line: 'reese' }, keys: null, pad: { kind: 'dark', lv: 0.2 }, lead: { kind: 'bleep', grammar: 'bleep', lv: 0.5, oct: 76 }, drums: { K: '9000000000900000', S: '0000900000009003', H: '0060006000600060', D: '0000000000000000', P: '0000000000000000' }, loops: [C([0], [], 4), C([0, 1], [], 2)] }, // 6.3
          roller: { name: 'Reese Roller', hard: 0.85, modes: ['aeolian', 'phrygian'], bass: { kind: 'reese', line: 'reese' }, keys: null, pad: { kind: 'dark', lv: 0 },
            drums: { K: '90900000009900009090000000900000', S: '00009003030090030300900303000090' }, loops: [C([0], [], 4), C([0, 5], [], 2), C([0, 1], [], 2)] },
        },
        ext: 5, voicing: 'jazz', kit: 'break',
        drums: { K: '9000000000700000', S: '0000900303009000', H: '0060006000000060', D: '5050505050505050', P: '2222222222222222' },
        fill: 'dnb', bass: { kind: 'sub', line: 'twostep', lv: 0.1 }, pad: { kind: 'warm', lv: 0 }, keys: { kind: 'rhodes', rhythm: 'liquid', lv: 0 }, arp: null,
        lead: { kind: 'bell', grammar: 'sparse', scale: 'pent', lv: 0.55, oct: 79 }, mix: { rev: 0.55, revS: 2.6, echo: 0.3, div: 1, fb: 0.35, side: 0.35, tone: 15000, tape: 0.05, crackle: 0, pump: 0.3 } },
      chiptune: { trim: 1.2, name: 'Chiptune', short: 'Chip', col: '#ffe14d', bpm: [112, 150, 180], swing: 0.5, human: 0, form: 'song', keyR: [48, 55], chip: 1,
        blurb: 'NES pulse leads, triangle bass and kick, noise drums, chords as fast arpeggios',
        flavours: {
          nes: { name: 'NES', hard: 0.75, modes: ['ionian', 'mixolydian', 'aeolian'], loops: [C([0, 5, 3, 4]), C([0, 4, 5, 3]), C([0, 3, 4, 0]), C([5, 6, 0, 0], ['M', 'M', 'M', 'M']), C([0, 5, 6, 0])] },
          gameboy: { name: 'Game Boy', hard: 0.5, ftrim: 1.45, modes: ['dorian', 'aeolian', 'ionian'], bpmX: 0.85, lead: { duty: 0.125 }, bass: { kind: 'wave', line: 'chip' }, loops: [C([0, 6, 5, 6]), C([0, 3, 0, 4]), C([0, 5, 3, 4])] },
          speedrun: { name: 'Speedrun', hard: 0.95, modes: ['aeolian', 'harmonic'], bpmX: 1.12, lead: { duty: 0.125, grammar: 'riff' }, drums: { K: '9000900090009000', S: '0000900000009009', H: '6060606060606060' }, loops: [C([0, 3, 4, 0], ['m', 'm', 'M', 'm']), C([0, 5, 3, 4], ['m', 'M', 'm', 'M']), C([0, 0, 5, 4], ['m', 'm', 'M', 'M'])] }, // 6.3
          saveroom: { name: 'Save Room', hard: 0.15, ftrim: 0.85, modes: ['ionian', 'lydian'], bpmX: 0.62, drums: { K: '9000000000000000', S: '0000000090000000', H: '0000600000006000' }, bass: { kind: 'tri', line: 'long' }, loops: [C([0, 3], [], 2), C([0, 5, 3, 4], [], 2)] },
        },
        ext: 3, voicing: 'triad', kit: 'chip',
        drums: { K: '9000000090700000', S: '0000900000009000', H: '6040604060406040' },
        fill: 'chip', bass: { kind: 'tri', line: 'chip', lv: 0.1 }, pad: null, keys: { kind: 'chiparp', rhythm: 'arp', lv: 0.25 }, arp: null,
        lead: { kind: 'chip', grammar: 'chip', scale: 'mode', lv: 0.35, oct: 74, duty: 0.25 }, mix: { rev: 0, revS: 0.6, echo: 0.15, div: 1, fb: 0.2, side: 0, tone: 7500, tape: 0, crackle: 0, pump: 0 } },
      dub: { trim: 0.84, name: 'Dub', col: '#ff9a3c', bpm: [64, 72, 82], swing: 0.6, human: 8, form: 'dub', keyR: [40, 47],
        blurb: 'One drop on beat three, offbeat skank, a heavy melodic bass, tape echo throws and siren',
        flavours: {
          onedrop: { name: 'One Drop', hard: 0.35, modes: ['aeolian', 'dorian'], drums: { K: '0000000090000000', H: '6050605060506050' }, loops: [C([0, 6], [], 2), C([0, 3], [], 2), C([0, 5, 6, 0])] },
          rockers: { name: 'Rockers', hard: 0.6, modes: ['aeolian', 'mixolydian'], drums: { K: '9000000090000000', H: '5353535353535353' }, loops: [C([0, 3], [], 1), C([0, 6], [], 2), C([0, 3, 4, 0], ['M', 'M', 'M', 'M'])] },
          digital: { name: 'Digital', ftrim: 0.86, hard: 0.7, modes: ['aeolian', 'dorian'], bpmX: 1.1, kit: '909', bass: { kind: 'tri', line: 'dub' }, keys: { kind: 'organ', rhythm: 'skank', lv: 0 }, lead: { kind: 'chip', grammar: 'call', duty: 0.25, lv: 0.45 }, drums: { K: '9000000090000000', S: '0000900000009000', R: '0000000000000000', H: '0303030303030303' }, loops: [C([0, 6], [], 2), C([0, 3, 4, 0], ['m', 'm', 'M', 'm']), C([0], [], 4)] }, // 6.3
          steppers: { name: 'Steppers', hard: 0.85, modes: ['aeolian', 'phrygian'], drums: { K: '9000900090009000' }, loops: [C([0, 6], [], 2), C([0, 1], [], 2), C([0], [], 4)] },
        },
        ext: 3, voicing: 'triad', kit: 'dub',
        drums: { K: '0000000090000000', R: '0000000090000000', H: '5030503050305030', O: '0000000000000050' },
        fill: 'flam', bass: { kind: 'dub', line: 'dub', lv: 0.1 }, pad: null, keys: { kind: 'skank', rhythm: 'skank', lv: 0 }, arp: null,
        lead: { kind: 'melodica', grammar: 'call', scale: 'pent', lv: 0.5, oct: 72 }, mix: { rev: 0.45, revS: 1.8, echo: 0.7, div: 0.75, fb: 0.55, side: 0, tone: 9000, tape: 0.35, crackle: 0.25, pump: 0 } },
    };
    const GENRE_IDS = Object.keys(GENRES);
    // merged recipe for a genre + flavour (flavour keys override; drums and mix merge one level deep)
    function recipe(g, f) {
      const G0 = GENRES[g], F = G0.flavours[f] || {}, o = Object.assign({}, G0, F);
      o.drums = Object.assign({}, G0.drums, F.drums || {});
      o.mix = Object.assign({}, G0.mix, F.mixO || {});
      for (const k of ['bass', 'keys', 'lead', 'pad', 'arp']) if (k in F) o[k] = F[k] === null ? null : Object.assign({}, G0[k] || {}, F[k]);
      return o;
    }
    // ---------------- 6.3 variety: per-song choices inside a genre (v2 pieces only) ----------------
    // Before 6.3 a flavour fixed the drums, the instruments, the tempo and the arrangement; only chords, key and melody were rolled,
    // so songs of one style sounded alike. A v2 piece (spec.v = 2) rolls these too, from the lists below. Old saved tracks have no v
    // and take the old path, so they play exactly as they did. Drum rows: the flavour's own row is one of the choices; a row a
    // flavour writes itself (its identity, like One Drop's kick on three) is kept unless the flavour lists its own choices in VX_F.
    // lines/leads/pads/keys change a role only when the flavour does not set that role itself.
    const VX = {
      ambient: { K: ['3000000030000000', '0000000000000000'], P: ['2000200020002000', '0020002000200020', '0000000000000000'], leads: ['bell', 'glass', 'flute'], grammars: ['drone', 'long', 'sparse'],
        pads: ['warm', 'strings', 'juno'], arps: ['updown', 'up', 'down', 'skip'], tempo: 0.06, fills: ['none'] },
      lofi: { K: ['90000000009000009000000009000600', '90000060000000009000006000090000', '90000000090000009000000000900000'], S: ['0000900000009000', '0000900300009000', '0000900000009030'],
        H: ['7050705070507050', '7000700070007000', '7552755275527552'], ghost: 0.5, lines: ['lofi', 'lofi', 'walk', 'dubby'], leads: ['flute', 'bell', 'piano', 'melodica', 'glass'],
        grammars: ['sparse', 'call', 'riff'], keys: [['rhodes', 'lofi'], ['rhodes', 'comp'], ['piano', 'lofi']], tempo: 0.06, fills: ['drop', 'drop', 'snare', 'none'] },
      downtempo: { K: ['9000000090000000', '9000000600900000', '9000060005000000'], S: ['0000900000009000', '0000900200009020'], H: ['6000600060006000', '6444644464446444', '0060006000600060'],
        ghost: 0.4, lines: ['dubby', 'dubby', 'long', 'dub'], leads: ['theremin', 'bell', 'flute', 'glass', 'melodica'], grammars: ['long', 'sparse', 'call'], pads: ['strings', 'dark', 'warm'],
        tempo: 0.06, fills: ['drop', 'toms', 'none'] },
      synthwave: { H: ['7070707070707070', '4444444444444444', '0707070707070707'], S: ['0000900000009004', '0000900000009090'], O: ['0000000000000000', '0000000700000007'],
        lines: ['octave', 'octave', 'gallop', 'pulse8'], leads: ['saw', 'pulse', 'brass'], grammars: ['anthem', 'riff', 'call'], pads: ['juno', 'warm', 'strings'],
        arps: ['updown', 'up', 'down', 'pinky', 'skip'], arpRates: [16, 8], tempo: 0.06, fills: ['toms', 'snare', 'toms'] },
      house: { H: ['0060006000600060', '3363336333633363', '3060306830603068'], C: ['0000800000008080', '0000800000008002'], P: ['0000200000002000', '2020202020202020', '0302030203020302'],
        R: ['0000000300000300', '0030000000300000'], O: ['0070007000700070', '0000000000000050'], leads: ['piano', 'bell', 'bleep'], grammars: ['riff', 'call', 'bleep'], tempo: 0.025,
        fills: ['kickdrop', 'kickdrop', 'clap', 'none'] },
      techno: { R: ['0006000600060006', '0600060006000600', '0060060000600600'], H: ['0303030303030303', '3333333333333333'], O: ['0080008000800088', '0000008000000080'],
        C: ['0000000000000000', '0000600000006000'], D: ['0000000000000000', '2020202020202020'], lines: ['rumble', 'rumble', 'offbeat'], leads: ['bleep', 'bell', 'glass'],
        grammars: ['bleep', 'riff', 'sparse'], tempo: 0.035, fills: ['none', 'kickdrop', 'none'] },
      trance: { H: ['0303030303030303', '3333333333333333'], C: ['0000700000007007', '0000000000000000'], P: ['0000000000000000', '2222222222222222'], lines: ['rolling', 'rolling', 'offbeat'],
        leads: ['supersaw', 'saw', 'brass'], grammars: ['trance', 'anthem', 'riff'], arps: ['updown', 'up', 'down', 'pinky', 'skip'], arpRates: [16, 8], tempo: 0.025 },
      dnb: { K: ['9000000000900000', '9000000000709000', '9000000090700000'], S: ['0000900000009000', '0000900300009030', '0000900303009003'], H: ['6060606060606060', '0000000000000000'],
        D: ['5555555555555555', '0000000000000000'], lines: ['twostep', 'twostep', 'long'], leads: ['bell', 'glass', 'flute', 'piano'], grammars: ['sparse', 'call', 'riff'], tempo: 0.015 },
      chiptune: { K: ['9000900090009000', '9000000090000000', '9000000900900000'], S: ['0000900000009009', '0000900009009000'], H: ['6060606060606060', '0060006000600060'],
        lines: ['chip', 'chip', 'long', 'octave'], duties: [0.25, 0.125, 0.5], grammars: ['chip', 'riff', 'anthem'], tempo: 0.07, fills: ['chip', 'chip', 'toms'] },
      dub: { H: ['5050505050505050', '0050005000500050', '5353535353535353'], R: ['0000300090000300', '0000000090000030'], O: ['0000000000000000', '0000005000000050'], P: ['0030003000300030'],
        lines: ['dub', 'dub', 'dubby'], leads: ['melodica', 'flute', 'bell'], grammars: ['call', 'sparse', 'riff'], tempo: 0.05, fills: ['flam', 'flam', 'toms'] },
    };
    // per flavour: more chord loops and modes (checked by loopOK like the rest), and choices for roles the flavour sets itself
    const VX_F = {
      'ambient/drift': { loops2: [C([0, 4], [], 4), C([0, 5, 1, 0], [], 2)] },
      'ambient/glass': { loops2: [C([0, 5], [], 4), C([3, 4, 0, 0], [], 2)] },
      'ambient/nocturne': { loops2: [C([0, 3], [], 4), C([0, 5, 3, 4], [], 2)], modes2: ['phrygian'] },
      'lofi/jazzhop': { loops2: [C([0, 3, 1, 4]), C([5, 1, 4, 0])], modes2: ['mixolydian'] },
      'lofi/rainy': { loops2: [C([0, 6, 5, 4], ['m7', '7', 'M7', '7']), C([0, 3], ['m9', 'm7'], 2)] },
      'downtempo/triphop': { loops2: [C([0, 6, 5, 6]), C([0, 3, 5, 4], ['m', 'm', 'M', '7'])] },
      'downtempo/chillout': { loops2: [C([0, 5, 3, 4]), C([0, 1], [], 2)] },
      'synthwave/outrun': { loops2: [C([0, 3, 6, 5], ['m', 'm', 'M', 'M']), C([5, 6, 0, 0], ['M', 'M', 'm', 'm'])] },
      'synthwave/dreamwave': { loops2: [C([3, 4, 5, 0]), C([0, 2, 5, 4])], modes2: ['lydian'] },
      'synthwave/darksynth': { loops2: [C([0, 3], ['m', 'm'], 2)] },
      'house/deep': { loops2: [C([0, 6, 5, 6]), C([0, 6], [], 2)], lines: ['deep', 'deep', 'offbeat'] },
      'house/disco': { loops2: [C([0, 3, 4, 3])], lines: ['disco', 'octave'] },
      'house/piano': { loops2: [C([0, 5, 3, 4]), C([3, 0, 4, 5])], lines: ['organ', 'organ', 'deep'] },
      'techno/detroit': { loops2: [C([0, 5], [], 2), C([0, 3], [], 2)] },
      'techno/minimal': { loops2: [C([0, 3], [], 4)] },
      'techno/acid': { loops2: [C([0, 5, 6, 0])] },
      'trance/uplifting': { loops2: [C([5, 3, 0, 4], ['M', 'm', 'm', 'm']), C([0, 6, 3, 5], ['m', 'M', 'm', 'M'])] },
      'trance/progressive': { loops2: [C([0, 6], [], 2), C([5, 6, 0, 0], [], 1)] },
      'dnb/liquid': { loops2: [C([0, 5, 3, 4]), C([3, 4, 0, 0])] },
      'dnb/roller': { loops2: [C([0, 6], [], 2)] },
      'chiptune/nes': { loops2: [C([0, 3, 5, 4]), C([5, 3, 0, 4])] },
      'chiptune/gameboy': { loops2: [C([0, 5, 6, 0])] },
      'dub/onedrop': { loops2: [C([0, 3, 4, 3], [], 1)] },
      'dub/rockers': { loops2: [C([0, 6], [], 1)] },
      'dub/steppers': { loops2: [C([0, 5], [], 2)] },
    };
    // shapes for the v2 hook: one bar of rhythm per figure (x = a note); the hook's answer bar reuses or swaps it
    const HOOK_R = {
      sparse: ['x.....x.x.......', 'x.......x...x...', '..x...x.....x...', 'x...x.....x.....'],
      long: ['x...........x...', 'x.......x.......', 'x...............', 'x.....x.........'],
      anthem: ['x.....x.....x...', 'x...x...x.x.x...', 'x.x...x...x.....', 'x.....x...x.x...'],
      trance: ['x.xx.x.xx.x.x.x.', 'x..x..x.x..x..x.', 'xx.x.x.xx.x.x.x.', 'x.x.xx.x.x.xx.x.'],
      chip: ['x.x.x...x.x.x...', 'x..xx.x.x..x....', 'xxx.x.x.x...x...', 'x.xxx.x.x.x.x...'],
      call: ['x...x.x.........', 'x.x...x.........', '..x.x...x.......', 'x..x..x.........'],
      riff: ['x..x..x...x..x..', 'x..x..x.x.......', '..x..x..x..x....', 'x...x..x..x.....'],
      bleep: ['x......x........', 'x..x............', '...x......x.....', 'x.........x.....'],
      drone: ['x...............', 'x.......x.......'],
    };
    // ---------------- 6.3 boss themes (Nic: "good boss music for all the bosses: unique, catchy and hard") ----------------
    // Fixed songs on the same engine: handwritten hooks, chords, drums and bass, one per boss. Hooks are semitones above the key's
    // tonic ("st:semi:len[:m]", 32 steps = 2 bars; :m plays that note on the theme's second lead), so a hook keeps its exact notes
    // over every chord. Phrases are 8 bars: Alarm (the entry build) > Hook > Drive > Hook > Break > Final, then back to Hook while
    // the boss lives. Each 2-bar slot of a phrase plays motif L[i]: 0 hook, 1 answer, 2 drive (the hook moved), 3 break (slowed).
    // A boss phase change jumps to Final at the next phrase and lifts the key a semitone.
    const HK = str => str.trim().split(/\s+/).map(t => { const a = t.split(':'); return { st: +a[0], d: +a[1], len: +a[2], k: a[3] || '' }; });
    const BP = str => str.trim().split(/\s+/).map(t => { const a = t.split(':'); return { st: +a[0], iv: +a[1], len: +a[2], acc: a[3] === 'a', slide: a[3] === 's' }; });
    const gallop = () => { let o = ''; for (let s = 0; s < 16; s += 4) o += `${s}:0:0.9 ${s + 2}:0:0.5 ${s + 3}:0:0.5 `; return o; };
    const roll16 = ivs => { let o = ''; for (let s = 0; s < 16; s++) if (ivs[s % ivs.length] !== null) o += `${s}:${ivs[s % ivs.length]}:0.9 `; return o; };
    const BOSS_THEMES = {
      behemoth: { name: 'Behemoth', title: 'Siege Engine', base: ['synthwave', 'darksynth'], bpm: 108, mode: 'phrygian', root: 40, kit: 'hard', trim: 1.59,
        loop: C([0, 0, 1, 6], ['m', 'm', 'M', 'M']), drums: { K: '9000900090009060', S: '0000900000009000', C: '0000600000006000', H: '5353535353535353', O: '0000000000000070' }, fill: 'toms',
        bass: { kind: 'sawoct', pat: gallop() }, keys: { kind: 'power', pat: [0, 3, 6, 10, 12], lv: 0 }, pad: { kind: 'dark', lv: 0.3 }, lead: { kind: 'brass', oct: 64 },
        hook: '0:0:2 3:0:1 4:1:4 12:3:3 16:1:3 20:0:8 30:-2:2', ans: '0:0:2 3:0:1 4:1:4 12:7:4 16:8:6 24:7:2 28:5:4', m2: 5,
        mix: { rev: 0.45, revS: 2.6, echo: 0.2, div: 0.75, fb: 0.3, side: 0.35, tone: 14000, tape: 0.1, crackle: 0, pump: 0.3 } },
      queen: { name: 'Hive Queen', title: 'Royal Swarm', base: ['trance', 'uplifting'], bpm: 138, mode: 'harmonic', root: 47, kit: '909', trim: 0.86,
        loop: C([0, 3, 4, 0], [null, null, '7', null]), drums: { K: '9000900090009000', O: '0080008000800080', H: '3434343434343434', C: '0000700000007000' }, fill: 'roll',
        bass: { kind: 'saw', pat: roll16([null, 0, 0, 0]) }, arp: { kind: 'pluck', rate: 16, oct: 2, lv: 0.25 }, pad: { kind: 'strings', lv: 0 }, keys: null, lead: { kind: 'saw', oct: 71 },
        hook: '0:12:1 1:11:1 2:12:1 3:11:1 4:7:4 8:8:2 10:7:2 12:3:4 16:12:1 17:11:1 18:12:1 19:11:1 20:14:4 24:15:2 26:14:2 28:11:4',
        ans: '0:15:2 2:14:2 4:12:2 6:11:2 8:12:6 16:7:4 20:8:4 24:11:4 28:12:4', m2: -5,
        mix: { rev: 0.55, revS: 3, echo: 0.3, div: 0.75, fb: 0.35, side: 0.55, tone: 15000, tape: 0, crackle: 0, pump: 0.55 } },
      wraith: { name: 'Phase Wraith', title: 'Blink', base: ['dnb', 'roller'], bpm: 160, mode: 'phrydom', root: 42, kit: 'break', trim: 0.52,
        loop: C([0, 0, 1, 0]), drums: { K: '9000000000900000', S: '0000000090000000', H: '6060606060606060', P: '0303030303030303', Z: '0000000000000034' }, fill: 'none',
        bass: { kind: 'reese', len32: 1, pat: '0:0:14 16:1:8 26:0:6' }, keys: { kind: 'stab', pat: [3, 11], how: 'dubtechno', lv: 0.2 }, pad: { kind: 'dark', lv: 0.2 }, lead: { kind: 'theremin', oct: 66 },
        hook: '0:0:6 6:7:2 8:8:6 14:7:2 16:4:8 24:1:4 28:0:4', ans: '0:0:6 6:7:2 8:8:6 14:10:2 16:12:10 28:13:4', m2: 12,
        mix: { rev: 0.6, revS: 4, echo: 0.4, div: 0.75, fb: 0.45, side: 0.2, tone: 12000, tape: 0.2, crackle: 0, pump: 0.2 } },
      overmind: { name: 'Overmind', title: 'Mind Lock', base: ['techno', 'acid'], bpm: 132, mode: 'dorian', root: 45, kit: '909', trim: 1.18,
        loop: C([0, 0, 6, 3]), drums: { K: '9000900090009000', R: '0060000600600060', O: '0080008000800080', C: '0000300000003000', H: '0303030303030303', D: '2222222222222222' }, fill: 'none',
        bass: { kind: 'acid', pat: '0:0:1:a 2:12:1 3:0:1 5:10:1:s 6:0:1 8:7:1:a 10:0:1 11:12:1 13:3:1:s 14:0:1' }, keys: { kind: 'organ', pat: [0, 6], lv: 0.35 }, pad: { kind: 'dark', lv: 0.3 }, lead: { kind: 'bleep', oct: 72 },
        hook: '0:0:3 3:3:3 6:7:3 9:10:3 12:7:3 15:3:3 18:0:3 21:3:3 24:7:3 27:10:3 30:14:2', ans: '0:12:3 3:10:3 6:7:3 9:5:3 12:7:3 15:3:3 18:2:3 21:0:3 24:-2:3 27:0:5', m2: 5,
        mix: { rev: 0.45, revS: 3, echo: 0.45, div: 0.75, fb: 0.5, side: 0.4, tone: 16000, tape: 0.05, crackle: 0, pump: 0.35 } },
      titan: { name: 'Titan', title: 'Colossus March', base: ['synthwave', 'outrun'], bpm: 120, mode: 'harmonic', root: 38, kit: '909', trim: 0.59,
        loop: C([0, 5, 3, 4], [null, null, null, '7']), drums: { K: '9000000090000000', S: '0030903303009330', X: '4000000000000060', H: '5050505050505050' }, fill: 'toms',
        bass: { kind: 'sawoct', pat: '0:0:1.6 2:0:1.6 4:12:1.6 6:0:1.6 8:0:1.6 10:0:1.6 12:12:1.6 14:7:1.6' }, keys: { kind: 'stab', pat: [0, 6, 8], lv: 0 }, pad: { kind: 'strings', lv: 0 }, lead: { kind: 'supersaw', oct: 62 },
        hook: '0:0:3 3:7:1 4:8:4 8:7:3 11:5:1 12:7:4 16:0:3 19:7:1 20:8:3 23:11:1 24:12:8', ans: '0:12:3 3:11:1 4:8:4 8:7:3 11:5:1 12:3:4 16:2:3 19:-1:1 20:0:12', m2: 5,
        mix: { rev: 0.55, revS: 3.2, echo: 0.2, div: 0.75, fb: 0.3, side: 0.3, tone: 13000, tape: 0.05, crackle: 0, pump: 0.3 } },
      cat: { name: 'Leia', title: 'Couch Shredder', base: ['lofi', 'jazzhop'], bpm: 116, mode: 'aeolian', root: 40, kit: 'break', swing: 0.62, human: 6, trim: 1.67,
        loop: C([0, 0, 3, 4], ['m', 'm', 'm', '7']), drums: { K: '9000000900900000', S: '0000900000009000', R: '0030003000300030', H: '6060606060606060', P: '0000300000003000' }, fill: 'snare',
        bass: { kind: 'upright', pat: '0:0:1.5 2:12:1.5 4:0:1.5 6:12:1.5 8:3:1.5 10:15:1.5 12:4:1.5 14:16:1.5' }, keys: { kind: 'stab', pat: [6, 14], lv: 0.3 }, pad: { kind: 'dark', lv: 0.4 },
        lead: { kind: 'pizz', k2: 'meow', oct: 64 },
        hook: '0:0:1 2:3:1 3:4:1 4:7:2 8:6:1 9:7:1 10:12:6:m 16:0:1 18:3:1 19:4:1 20:7:2 24:10:2 26:9:1 27:7:1 28:-5:4:m',
        ans: '0:12:2:m 4:11:1 5:10:1 6:9:1 7:8:1 8:7:4 16:0:1 18:3:1 19:4:1 20:7:1 22:12:1 24:0:6:m', m2: 5, m3: '0:-12:8:m 16:-5:8:m',
        form: { 4: { n: 'Nap', half: 1, under: 1, drums: 0.5, build: 0, L: [3, -1, 3, -1] }, 5: { n: 'Pounce' } },
        mix: { rev: 0.35, revS: 1.8, echo: 0.25, div: 0.75, fb: 0.3, side: 0.2, tone: 11000, tape: 0.25, crackle: 0.15, pump: 0.2 } },
      gloop: { name: 'Gloop', title: 'Leftovers', base: ['dnb', 'neuro'], bpm: 146, mode: 'dorian', root: 43, kit: '909', trim: 1.7,
        loop: C([0, 3, 0, 6]), drums: { K: '9000000000900000', S: '0000000090000000', H: '3030303030303030', O: '0000000000000500', C: '0000000090000000' }, fill: 'none',
        bass: { kind: 'wobble', pat: '0:0:6 6:0:2:a 8:3:4 12:-2:4' }, keys: { kind: 'stab', pat: [6, 14], lv: 0.4 }, pad: null, lead: { kind: 'drop', oct: 67 },
        hook: '0:0:2 2:0:2 4:7:2 6:5:2 8:3:4 12:0:2 14:-2:2 16:12:2 18:12:2 20:19:2 22:17:2 24:15:6', ans: '0:0:2 2:0:2 4:7:2 6:5:2 8:3:4 12:5:2 14:7:2 16:10:4 20:12:12', m2: 12,
        mix: { rev: 0.4, revS: 2.2, echo: 0.3, div: 0.5, fb: 0.3, side: 0.45, tone: 14000, tape: 0.05, crackle: 0, pump: 0.4 } },
      whale: { name: 'Space Whale', title: 'Deep Song', base: ['downtempo', 'triphop'], bpm: 78, mode: 'aeolian', root: 36, kit: 'break', in: 6, trim: 0.83,
        loop: C([0, 6, 5, 6]), drums: { K: '9000000000900000', S: '0000900000009000', H: '3535353535353535', O: '0000000000000060' }, fill: 'toms',
        bass: { kind: 'sawoct', pat: roll16([0, 0, 12, 0]) }, arp: { kind: 'glass', rate: 4, oct: 2, lv: 0.45 }, pad: { kind: 'strings', lv: 0 }, keys: null, lead: { kind: 'whale', oct: 60 },
        hook: '0:0:4 4:7:4 8:12:6 14:10:2 16:7:8 24:3:4 28:5:4', ans: '0:0:4 4:7:4 8:12:6 14:15:2 16:14:8 24:12:8', m2: '0:12:6 6:15:2 8:14:4 12:12:4 16:10:8 24:7:8',
        form: { 4: { half: 1 } },
        mix: { rev: 0.35, revS: 5.2, echo: 0.25, div: 1, fb: 0.35, side: 0.25, tone: 12000, tape: 0.05, crackle: 0, pump: 0.25 } },
      duck: { name: 'Quackzilla', title: 'Rubber Reckoning', base: ['trance', 'uplifting'], bpm: 178, mode: 'mixolydian', root: 43, kit: 'hard', trim: 1.65,
        loop: C([0, 6, 3, 0]), drums: { K: '9000900090009000', O: '0080008000800080', H: '3333333333333333', C: '0000800000008000' }, fill: 'roll',
        bass: { kind: 'saw', pat: '2:0:1.4 6:0:1.4 10:0:1.4 14:0:1.4' }, keys: { kind: 'stab', pat: [2, 6, 10, 14], lv: 0.25 }, pad: { kind: 'juno', lv: 0.4 }, lead: { kind: 'quack', oct: 67 },
        hook: '0:0:2 2:0:2 4:4:2 6:7:4 10:9:2 12:7:4 16:12:2 18:10:2 20:7:2 22:4:2 24:5:2 26:4:2 28:0:4', ans: '0:0:2 2:0:2 4:4:2 6:7:4 10:9:2 12:10:4 16:12:12', m2: 5,
        form: { 2: { n: 'Hop', hop: 1 } },
        mix: { rev: 0.35, revS: 2, echo: 0.2, div: 0.75, fb: 0.25, side: 0.5, tone: 15000, tape: 0, crackle: 0, pump: 0.5 } },
      fsm: { name: 'Flying Spaghetti Monster', title: 'Al Dente', base: ['dub', 'rockers'], bpm: 152, mode: 'harmonic', root: 45, kit: 'break', swing: 0.66, trim: 1.63,
        loop: C([0, 3, 4, 0], [null, null, '7', null]), drums: { K: '9000900090009000', S: '0000700000007000', P: '6060606060606060' }, fill: 'toms',
        bass: { kind: 'upright', pat: '0:0:2 4:7:2 8:0:2 12:7:2' }, keys: { kind: 'organ', pat: [2, 6, 10, 14], lv: 0 }, arp: { kind: 'pluck', rate: 16, oct: 1, lv: 0.35 }, pad: null, lead: { kind: 'melodica', oct: 69 },
        hook: '0:0:2 2:3:2 4:7:2 6:8:2 8:7:2 10:3:2 12:2:2 14:3:2 16:0:2 18:3:2 20:7:2 22:8:2 24:11:2 26:12:6', ans: '0:12:2 2:11:2 4:8:2 6:7:2 8:5:2 10:3:2 12:2:2 14:-1:2 16:0:8', m2: 5,
        mix: { rev: 0.4, revS: 2, echo: 0.15, div: 0.75, fb: 0.2, side: 0.15, tone: 11000, tape: 0.2, crackle: 0.1, pump: 0.15 } },
      worm: { name: 'Wormhole Worm', title: 'Burrow', base: ['dnb', 'roller'], bpm: 174, mode: 'phrygian', root: 41, kit: 'break', trim: 2.06,
        loop: C([0, 1], [], 2), drums: { K: '90000000009000000090000000000000', S: '0000900300009003', H: '0060006000600060', Z: '0000000000000300' }, fill: 'none',
        bass: { kind: 'reese', len32: 1, pat: '0:0:6 6:1:2 8:0:4 12:-2:4 16:0:10 26:3:6' }, keys: null, pad: { kind: 'dark', lv: 0.3 }, lead: { kind: 'growl', oct: 65 },
        hook: '0:0:2 2:1:1 3:0:1 4:-2:2 6:0:2 8:3:2 10:1:6 16:0:2 18:1:1 19:0:1 20:-2:2 22:0:2 24:6:2 26:7:6', ans: '0:0:2 2:1:1 3:0:1 4:-2:2 6:0:2 8:3:2 10:5:2 12:7:2 14:8:2 16:7:8 24:1:4 28:0:4', m2: 12,
        form: { 4: { n: 'Underground', under: 1, drums: 0.5 }, 5: { n: 'Surface' } },
        mix: { rev: 0.5, revS: 2.6, echo: 0.35, div: 1, fb: 0.35, side: 0.35, tone: 15000, tape: 0.05, crackle: 0, pump: 0.3 } },
      auditor: { name: 'The Auditor', title: 'Form 1040-Z', base: ['house', 'deep'], bpm: 126, mode: 'aeolian', root: 36, kit: '909', ding: 1, trim: 1.95,
        loop: C([0, 6, 5, 4], [null, null, null, '7']), drums: { K: '9000000090000000', C: '0000900000009000', Z: '5353535353535353' }, fill: 'none',
        bass: { kind: 'sub', pat: '0:0:7 8:0:7' }, keys: { kind: 'organ', pat: [0], lv: 0.3, dur: 14 }, arp: { kind: 'pluck', rate: 16, oct: 1, lv: 0.2 }, pad: { kind: 'strings', lv: 0.3 }, lead: { kind: 'harpsi', oct: 72 },
        hook: '0:0:2 4:0:2 8:0:2 12:-1:4 16:3:2 18:2:2 20:0:8', ans: '0:0:2 4:0:2 8:0:2 12:-1:4 16:8:2 18:7:2 20:5:4 24:3:4 28:2:4', m2: 7,
        mix: { rev: 0.5, revS: 3.2, echo: 0.15, div: 0.75, fb: 0.2, side: 0.2, tone: 12000, tape: 0.1, crackle: 0, pump: 0.2 } },
      snail: { name: 'The Immortal Snail', title: 'Inevitable', base: ['downtempo', 'triphop'], bpm: 64, mode: 'phrygian', root: 38, kit: 'hard', in: 6, trim: 1.17,
        loop: C([0, 1], [], 2), drums: { K: '9000000000900000', S: '0000000090000000', H: '3030303030303030', D: '5000500050005000' }, fill: 'toms',
        bass: { kind: 'sub', pat: '0:0:8 8:0:6 14:1:2' }, keys: { kind: 'power', pat: [0, 8], lv: 0 }, pad: { kind: 'dark', lv: 0.2 }, lead: { kind: 'dist', oct: 62 },
        hook: '0:0:4 4:0:2 6:3:2 8:6:8 16:5:4 20:3:4 24:1:6 30:0:2', ans: '0:0:4 4:0:2 6:3:2 8:6:4 12:7:4 16:8:4 20:6:4 24:1:8', m2: 12,
        form: { 5: { dr: { K: '9050905090509050' } } },
        mix: { rev: 0.7, revS: 5.2, echo: 0.2, div: 1, fb: 0.3, side: 0.3, tone: 9000, tape: 0.15, crackle: 0, pump: 0.3 } },
    };
    const BOSS_IDS = Object.keys(BOSS_THEMES);
    function bossForm(th) {
      const A = (n, d, o) => Object.assign({ n, d, drums: 1, bass: 1, keys: 1, lead: 1, pad: 1, arp: 1 }, o || {});
      const f = [A('Alarm', -0.1, { L: [-1, -1, -1, -1], build: 1, keys: 0 }), A('Hook', 0, { L: [0, 0, 0, 1], drop: 1 }), A('Drive', 0.05, { L: [2, 2, 0, 1] }), A('Hook', 0.08, { L: [0, 0, 0, 1] }),
        A('Break', -0.3, { L: [3, -1, 3, -1], drums: 0.5, brk: 1, build: 1 }), A('Final', 0.15, { L: [0, 0, 0, 1], up: 12, drop: 1 })];
      for (const k in th.form || {}) f[k] = Object.assign({}, f[k], th.form[k]);
      return f;
    }
    function bossMotifs(th) {
      const hook = HK(th.hook), ans = HK(th.ans);
      const m2 = typeof th.m2 === 'string' ? HK(th.m2) : hook.map(x => Object.assign({}, x, { d: x.d + (th.m2 || 0) }));
      const m3 = th.m3 ? HK(th.m3) : hook.filter(x => x.st < 16).map(x => Object.assign({}, x, { st: x.st * 2, len: x.len * 2 })); // the hook's first bar at half speed
      return [hook, ans, m2, m3];
    }
    const ADJ = ['Velvet', 'Quiet', 'Neon', 'Distant', 'Slow', 'Golden', 'Hollow', 'Paper', 'Silver', 'Midnight', 'Soft', 'Static', 'Lucid', 'Amber', 'Cobalt', 'Drifting', 'Tidal', 'Glass', 'Faded', 'Electric', 'Patient', 'Low', 'Warm', 'Lost', 'Small', 'Gentle', 'Broken', 'Endless', 'Orbital', 'Sleepy', 'Chrome', 'Rain', 'Analog', 'Second', 'Northern', 'Hidden'];
    const NOUN = ['Orbit', 'Harbor', 'Signal', 'Comet', 'Lantern', 'Tide', 'Nebula', 'Circuit', 'Garden', 'Satellite', 'Echo', 'Horizon', 'Engine', 'Reef', 'Window', 'Arcade', 'Moth', 'Wavelength', 'Meadow', 'Relay', 'Aurora', 'Kettle', 'Highway', 'Lighthouse', 'Sunday', 'Pixel', 'Station', 'Current', 'Afterglow', 'Cassette', 'Skyline', 'Ferry', 'Tower', 'Corridor', 'Bloom', 'Transit'];
    // the Studio settings (Default mode ignores everything except the calm genres' tempo scale)
    const DEF_BPM = {}; for (const g of GENRE_IDS) DEF_BPM[g] = GENRES[g].bpm[1];
    const DEF = { custom: false, length: 'standard', genres: ['ambient', 'lofi', 'downtempo'], energy: 0.4, follow: 1, bpm: DEF_BPM, mix: { pads: 1, keys: 1, arp: 1, bass: 1, drums: 1, lead: 1 },
      mute: {}, fx: { reverb: 0.5, echo: 0.5, tone: 0.5, tape: 0.5, pump: 0.5 }, favs: [], favOnly: false, calmBpm: 72, bossThemes: true };
    const CHN = ['pads', 'keys', 'arp', 'bass', 'drums', 'lead'];
    let cfg = JSON.parse(JSON.stringify(DEF));
    const VCUR = 2; // 6.3: the generator version new pieces get (saved tracks without a v are version 1 and keep the old path)
    let bossNow = null, bossPhase = 0, bossRet = null; // 6.3: the boss on the field (UI.tick), its phase, and what to go back to after the fight
    let P = null, lastG = '', lastF = '', bar = 0, s16 = 0, forceNext = null, favIdx = 0, tempoNow = 0, EV = null;
    const pieceLog = [];
    let hist = [], rep = false, paused = false, editing = false, held = false; // held: the composer silenced the radio // v5.5: Back, Repeat, Pause, composer editing (session only)
    const live = () => cfg.custom ? cfg : Object.assign({}, DEF, { calmBpm: cfg.calmBpm, favs: cfg.favs });
    // effective energy: the Energy knob, pushed by the battle as far as Follow allows
    const effE = () => { const c = live(), e = Math.max(0, Math.min(1, c.energy + c.follow * (battle - 0.4) * 0.85)); return P && P.boss ? Math.min(1, 0.55 + 0.45 * e + (P.phSeen || 0) * 0.08) : e; }; // 6.3: a boss theme never drops below 'driving'; Follow still pushes it, and each boss phase adds more
    // FX knobs are relative to the genre: 50% is the genre's own sound, 0% dry, 100% double (or the genre value + 0.5)
    const fxK = (x, def, span) => Math.max(0, x <= 0.5 ? def * x * 2 : def + (x - 0.5) * 2 * span);

    // ---------------- choosing a piece ----------------
    function chooseGenre() {
      const g = live().genres.filter(x => GENRES[x]); if (!g.length) return 'lofi';
      if (!cfg.custom && mood === 'boss') return 'downtempo';
      const pool = g.length > 1 ? g.filter(x => x !== lastG) : g; return pool[Math.floor(Math.random() * pool.length)];
    }
    function chooseFlavour(g) {
      const F = GENRES[g].flavours, ids = Object.keys(F), E = effE(), w = ids.map(id => (id === lastF && ids.length > 1 ? 0.15 : 1) * (0.15 + Math.pow(1 - Math.abs(F[id].hard - E), 2) * 1.6));
      let t = 0; for (const x of w) t += x; let r = Math.random() * t; for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) return ids[i]; } return ids[0];
    }
    function newPiece(force) {
      if (!force && cfg.custom && cfg.favOnly && cfg.favs.length) { force = cfg.favs[favIdx % cfg.favs.length]; favIdx++; }
      if (force && force.boss && BOSS_THEMES[force.boss]) return bossPiece(force);
      let g = force && GENRES[force.genre] ? force.genre : chooseGenre();
      let f = force && GENRES[g].flavours[force.flav] ? force.flav : chooseFlavour(g);
      const seed = force && force.seed !== undefined ? force.seed : (Math.random() * 4294967296) >>> 0;
      R = mulberry32(seed);
      // 6.3: a seeded spec (a kept track, a code, Back, Repeat) keeps the generator it was made with; a new piece gets the current
      // one. Composed songs always use version 1: the composer writes their parts itself.
      const ver = force && force.comp ? 1 : force && force.seed !== undefined ? (force.v | 0) || 1 : VCUR;
      let S = recipe(g, f); const G0 = GENRES[g]; let vv = null;
      if (ver >= 2) { S = Object.assign({}, S); vv = varyRecipe(S, g, f); }
      let mode = pick(S.modes);
      if (!force && mood === 'boss' && (mode === 'ionian' || mode === 'lydian' || mode === 'mixolydian')) mode = 'aeolian';
      let loop = pick(S.loops);
      if (!loopOK(loop, mode)) { // the next loop that fits this mode, else a mode that fits this loop (no extra dice: seeded pieces that were fine stay the same)
        const i0 = S.loops.indexOf(loop), alt = S.loops.map((_, k) => S.loops[(i0 + 1 + k) % S.loops.length]).find(L0 => loopOK(L0, mode));
        if (alt) loop = alt; else { const m2 = S.modes.find(m => loopOK(loop, m)); if (m2) mode = m2; }
      }
      let root = S.keyR[0] + Math.floor(R() * (S.keyR[1] - S.keyR[0] + 1)); let name = pick(ADJ) + ' ' + pick(NOUN);
      if (vv) root = Math.round((S.keyR[0] + S.keyR[1]) / 2) - 5 + vv.keyOff; // v2: any of the 12 keys, centred on the genre's register
      if (force && force.name) name = String(force.name).slice(0, 32); // renamed or composed tracks keep their own name
      lastG = g; lastF = f;
      P = { g, f, S, G0, seed, name, mode, scale: MODES[mode], loop, root, bar: 0,
        swing: S.swing, motifs: null, bassPat: null, keysPat: null, gatePat: pick(['xx.xx.x.xx.xx.x.', 'x.xxx.xxx.xxx.x.', 'xxx.xx.xxx.xx.x.', 'x.x.xx.xx.x.xx.x']),
        acc: [], lastChordV: null, form: makeForm(S.form), stabShape: pick([[0, 3, 7, 10], [0, 3, 7, 10, 14], [0, 3, 10, 14], [0, 7, 10, 15]]), drop: {} };
      P.motifs = [makeMotif(S.lead), makeMotif(S.lead)];
      if (vv) { P.v = 2; P.v2 = 1; P.bpmJ = vv.tempo; P.arpShape = vv.arpShape; P.arpRate = vv.arpRate; P.fv = vv.fv; P.liftBy = vv.liftBy; P.form = makeForm(S.form, null, vv.fv); P.motifs = makeHook(S.lead); }
      P.bassPat = makeBass(S.bass); P.keysPat = makeKeys(S.keys); P.dense = {};
      if (force && force.comp) applyComp(P, force.comp);
      if (force && force.snd) loadSnd(force.snd, g);
      P.bpm = pieceBpm(); P.spb = 60 / P.bpm; tempoNow = 0;
      applyGenreMix(true);
      pieceLog.push({ name, genre: g, flav: f, mode, root, bpm: Math.round(P.bpm), t: +(nextT || 0).toFixed(1), e: +effE().toFixed(2) });
      if (pieceLog.length > 60) pieceLog.shift();
      hist.push(specOf()); if (hist.length > 40) hist.shift();
      bar = force && force.start ? force.start : 0; s16 = 0;
    }
    const specOf = () => { const o = { seed: P.seed, genre: P.g, flav: P.f, name: P.name }; if (P.comp) o.comp = P.comp; if (P.v > 1) o.v = P.v; if (P.boss) o.boss = P.boss; return o; };
    // 6.3 v2: roll the per-song choices into the piece's own copy of the recipe (S). Draw order is fixed, so a seed always gives the same song.
    function varyRecipe(S, g, f) {
      const XF = VX_F[g + '/' + f] || {}, X = Object.assign({}, VX[g] || {}, XF), F = GENRES[g].flavours[f] || {}, FD = F.drums || {};
      S.drums = Object.assign({}, S.drums);
      for (const k of ['K', 'S', 'C', 'H', 'O', 'R', 'D', 'P']) if (X[k] && (!(k in FD) || XF[k])) S.drums[k] = pick([S.drums[k] || ''].concat(X[k]));
      if (X.ghost && S.drums.S && chance(X.ghost)) { // ghost snares: one or two soft hits on the off sixteenths
        const m = S.drums.S.split(''), spots = [3, 6, 7, 10, 11, 14, 15].filter(i => m[i] === '0'), n = 1 + Math.floor(R() * 2);
        for (let i = 0; i < n && spots.length; i++) m[spots.splice(Math.floor(R() * spots.length), 1)[0]] = '3'; S.drums.S = m.join('');
      }
      if (X.fills) S.fill = pick(X.fills);
      const lines = XF.lines || (!('bass' in F) && X.lines); if (lines && S.bass) S.bass = Object.assign({}, S.bass, { line: pick(lines) });
      if (X.leads && S.lead && !(F.lead && F.lead.kind)) S.lead = Object.assign({}, S.lead, { kind: pick(X.leads) });
      if (X.duties && S.lead) S.lead = Object.assign({}, S.lead, { duty: pick(X.duties) });
      if (X.grammars && S.lead && !(F.lead && F.lead.grammar)) S.lead = Object.assign({}, S.lead, { grammar: pick(X.grammars) });
      if (X.pads && S.pad && !('pad' in F)) S.pad = Object.assign({}, S.pad, { kind: pick(X.pads) });
      if (X.keys && S.keys && !('keys' in F)) { const k = pick(X.keys); S.keys = Object.assign({}, S.keys, { kind: k[0], rhythm: k[1] }); }
      if (XF.loops2) S.loops = S.loops.concat(XF.loops2);
      if (XF.modes2) S.modes = S.modes.concat(XF.modes2);
      return { tempo: 1 + (R() * 2 - 1) * (X.tempo || 0.04), arpShape: X.arps ? pick(X.arps) : 'updown', arpRate: X.arpRates ? pick(X.arpRates) : 0, fv: Math.floor(R() * 3), liftBy: pick([1, 2]), keyOff: Math.floor(R() * 12) };
    }
    // 6.3: a boss theme as a piece. It goes through the same scheduler as the radio; P.boss switches on the theme's own lead,
    // looping and phase handling.
    function bossPiece(force) {
      const id = force.boss, th = BOSS_THEMES[id], [g, f] = th.base; R = mulberry32(BOSS_IDS.indexOf(id) * 7919 + 17);
      const S = Object.assign({}, recipe(g, f), { kit: th.kit, swing: th.swing || 0.5, human: th.human || 0, form: 'boss', fill: th.fill || 'toms', ext: 3, voicing: 'triad',
        drums: Object.assign({}, th.drums), bass: Object.assign({ lv: 0, line: 'pat' }, th.bass), keys: th.keys ? Object.assign({ rhythm: 'pat' }, th.keys) : null, pad: th.pad || null,
        arp: th.arp || null, lead: Object.assign({ lv: 0, scale: 'mode' }, th.lead), mix: Object.assign({}, th.mix), halftime: 0, filterLoop: 0 });
      lastG = g; lastF = f;
      P = { g, f, S, G0: GENRES[g], seed: 0, name: th.title, mode: th.mode, scale: MODES[th.mode], loop: th.loop, root: th.root, bar: 0, boss: id, phSeen: 0,
        swing: S.swing, motifs: bossMotifs(th), bassPat: makeBass(S.bass), keysPat: makeKeys(S.keys), gatePat: 'x.x.x.x.x.x.x.x.', acc: [], lastChordV: null, form: bossForm(th),
        stabShape: [0, 3, 7, 10], drop: {}, dense: {}, fixedMel: 1 };
      P.bpm = pieceBpm(); P.spb = 60 / P.bpm; tempoNow = 0;
      applyGenreMix(true);
      pieceLog.push({ name: th.title, genre: 'boss', flav: id, mode: th.mode, root: th.root, bpm: th.bpm, t: +(nextT || 0).toFixed(1), e: +effE().toFixed(2) });
      if (pieceLog.length > 60) pieceLog.shift();
      hist.push(specOf()); if (hist.length > 40) hist.shift();
      bar = force.start !== undefined ? force.start : (th.in || 4); s16 = 0; // enter on the Alarm's build
    }
    // what plays after this piece: a queued pick, the same piece again (Repeat, or the composer looping its draft), or a new one
    const nextSpec = () => forceNext || (editing && P.comp ? Object.assign(specOf(), { start: 8 }) : rep ? specOf() : null);
    function pieceBpm() {
      if (P.comp && P.comp.bpm) return Math.max(50, Math.min(200, +P.comp.bpm));
      if (P.boss) return BOSS_THEMES[P.boss].bpm;
      const c = live(), G0 = GENRES[P.g], base = cfg.custom ? (c.bpm[P.g] || G0.bpm[1]) : G0.bpm[1] * (c.calmBpm || 72) / 72;
      return Math.max(G0.bpm[0] * 0.85, Math.min(G0.bpm[2] * 1.1, base * (P.S.bpmX || 1) * (P.bpmJ || 1))); // bpmJ: a v2 piece's own tempo inside the genre
    }
    // forms: per 8-bar phrase, a density offset and which roles play. 'roll' marks a build bar (the phrase's last bar)
    // ---- arrangements (5.5.9): a piece is a list of 8-bar phrases. 'short' is the original four (about a minute in the fast
    // genres); 'standard' is a radio edit shaped like the genre (intro, grooves, breakdowns and drops, an outro that thins out so
    // one piece winds down into the next); 'long' repeats the body for an extended mix. No dice are drawn here, so a seeded or
    // kept piece keeps its chords, melody and drums at any length.
    function makeForm(kind, len, fv) {
      const A = (n, d, o) => Object.assign({ n, d, drums: 1, bass: 1, keys: 1, lead: 1, pad: 1, arp: 1 }, o || {});
      len = len || cfg.length || 'standard';
      if (fv) return formVariant(makeForm(kind, len), fv); // 6.3 v2 arrangements
      if (len === 'short') {
        if (kind === 'flow') return [A('Intro', -0.15, { lead: 0 }), A('Drift', 0), A('Swell', 0.1), A('Return', -0.05)];
        if (kind === 'song') return [A('Intro', -0.1, { lead: 0.5 }), A('Groove', 0), A('Bridge', -0.15, { motif: 1, drums: 0.6 }), A('Return', 0.08)];
        if (kind === 'dub') return [A('Riddim', 0), A('Riddim', 0, { dropouts: 1 }), A('Dub version', 0, { keys: 0, lead: 0, version: 1, dropouts: 1 }), A('Return', 0.05)];
        if (kind === 'trance') return [A('Intro', -0.2, { lead: 0, pad: 0 }), A('Groove', 0, { lead: 0.5 }), A('Breakdown', -0.6, { drums: 0, bass: 0, arp: 0, brk: 1, build: 1 }), A('Drop', 0.2, { drop: 1 })];
        if (kind === 'dnb') return [A('Intro', -0.15, { lead: 0, drums: 0.5 }), A('Groove', 0), A('Breakdown', -0.4, { drums: 0, bass: 0.5, brk: 1, build: 1 }), A('Drop', 0.15, { drop: 1 })];
        return [A('Intro', -0.2, { lead: 0, keys: 0.5 }), A('Groove', 0), A('Breakdown', -0.35, { drums: 0.3, bass: 0, brk: 1, build: 1 }), A('Drop', 0.15, { drop: 1 })];
      }
      let f;
      if (kind === 'flow') f = [A('Intro', -0.15, { lead: 0 }), A('Drift', 0), A('Swell', 0.1), A('Drift', 0, { motif: 1 }), A('Swell', 0.12), A('Fade', -0.25, { lead: 0, drums: 0.5 })];
      else if (kind === 'song') f = [A('Intro', -0.15, { lead: 0, keys: 0.5 }), A('Verse', -0.05, { lead: 0.5 }), A('Verse', 0), A('Hook', 0.08), A('Bridge', -0.15, { motif: 1, drums: 0.6 }), A('Verse', 0), A('Hook', 0.1),
        A('Outro', -0.25, { lead: 0, drums: 0.6 })];
      else if (kind === 'dub') f = [A('Intro', -0.1, { lead: 0 }), A('Riddim', 0), A('Riddim', 0, { dropouts: 1 }), A('Dub version', 0, { keys: 0, lead: 0, version: 1, dropouts: 1 }), A('Riddim', 0.05),
        A('Dub', 0, { dropouts: 1 }), A('Dub version', 0, { keys: 0, lead: 0, version: 1, dropouts: 1 }), A('Outro', -0.2, { lead: 0, dropouts: 1 })];
      else if (kind === 'trance') f = [A('Intro', -0.3, { lead: 0, pad: 0, arp: 0 }), A('Intro', -0.2, { lead: 0, pad: 0 }), A('Build-in', -0.1, { lead: 0 }), A('Groove', 0, { lead: 0.5 }), A('Groove', 0.05),
        A('Breakdown', -0.6, { drums: 0, bass: 0, arp: 0, brk: 1 }), A('Breakdown · build', -0.5, { drums: 0, bass: 0, brk: 1, build: 1 }), A('Drop', 0.2, { drop: 1 }), A('Drop', 0.2), A('Groove', 0.05),
        A('Breakdown', -0.5, { drums: 0, bass: 0, arp: 0, brk: 1 }), A('Breakdown · build', -0.4, { drums: 0, bass: 0, brk: 1, build: 1 }), A('Drop', 0.25, { drop: 1 }), A('Drop', 0.2), A('Outro', -0.2, { lead: 0, pad: 0 }), A('Outro', -0.35, { lead: 0, pad: 0, arp: 0 })];
      else if (kind === 'dnb') f = [A('Intro', -0.2, { lead: 0, drums: 0.5 }), A('Intro', -0.1, { lead: 0 }), A('Groove', 0), A('Groove', 0.05), A('Breakdown · build', -0.4, { drums: 0, bass: 0.5, brk: 1, build: 1 }),
        A('Drop', 0.15, { drop: 1 }), A('Drop', 0.15), A('Groove', 0), A('Groove', 0.05), A('Breakdown', -0.45, { drums: 0, bass: 0.5, brk: 1 }), A('Breakdown · build', -0.35, { drums: 0, bass: 0.5, brk: 1, build: 1 }),
        A('Drop', 0.2, { drop: 1 }), A('Drop', 0.2), A('Groove', 0.05), A('Outro', -0.2, { lead: 0 }), A('Outro', -0.35, { lead: 0, drums: 0.5 })];
      else f = [A('Intro', -0.25, { lead: 0, keys: 0.5 }), A('Intro', -0.15, { lead: 0 }), A('Groove', 0), A('Groove', 0.05), A('Breakdown · build', -0.35, { drums: 0.3, bass: 0, brk: 1, build: 1 }), A('Drop', 0.15, { drop: 1 }),
        A('Groove', 0.05), A('Groove', 0.05), A('Breakdown · build', -0.3, { drums: 0.3, bass: 0, brk: 1, build: 1 }), A('Drop', 0.2, { drop: 1 }), A('Groove', 0), A('Outro', -0.25, { lead: 0, keys: 0.5 })]; // dance
      if (len === 'long') f = f.slice(0, -1).concat(f.slice(2, -1), f.slice(-1)); // the body twice: an extended mix
      return f;
    }
    // 6.3 v2 arrangement variants (no dice: the variant number comes from the piece's seed). 1: the second groove, drop or hook plays
    // half-time. 2: the last drop or hook lifts the key by one or two semitones, and it stays lifted to the end.
    function formVariant(f, fv) {
      f = f.map(x => Object.assign({}, x));
      const peak = x => /Drop|Hook|Swell|Groove|Riddim/.test(x.n) && !x.brk;
      if (fv === 1) { const pk = f.map((x, k) => peak(x) ? k : -1).filter(k => k >= 0); if (pk.length >= 2) Object.assign(f[pk[1]], { n: f[pk[1]].n + ' · half-time', half: 1 }); }
      if (fv === 2) { let i = -1; f.forEach((x, k) => { if (peak(x) && k < f.length - 1) i = k; }); if (i > 1) f[i] = Object.assign(f[i], { n: f[i].n + ' · key up', lift: 1 }); }
      return f;
    }
    const phAt = b => P.form[Math.min(P.form.length - 1, Math.floor(b / 8))];
    const pieceBars = () => P.form.length * 8;
    // ---------------- harmony ----------------
    function chordAt(barN) {
      const L0 = P.loop, i = Math.floor(barN / L0.bars) % L0.degs.length;
      return { deg: L0.degs[i], q: L0.q[i] || null, i, first: barN % L0.bars === 0 };
    }
    // intervals (semitones above the chord root) for a degree in the mode, with the genre's extension depth or a quality override
    function chordIv(deg, q) {
      const sc = P.scale, ext = P.S.ext || 4, out = [];
      if (q) {
        const T = { M: [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], mM7: [0, 3, 7, 11], s2: [0, 2, 7], s4: [0, 5, 7] }[q];
        if (T) { const t = T.slice(); if (ext >= 5 && t.length === 4 && q !== '6' && q !== 'm6' && q !== 'mM7') t.push(14); return t; }
      }
      const r = sc[((deg % 7) + 7) % 7];
      for (let k = 0; k < ext; k++) { const d = deg + 2 * k, iv = sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7) - r - 12 * Math.floor(deg / 7); if (k >= 4 && iv % 12 === 1) continue; out.push(iv); } // 5.5.8: no ♭9 on the stack (the classic avoid note)
      return out;
    }
    const chordRoot = deg => P.root + P.scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
    // voicings into roughly E3-E5 by the genre's rule
    function voice(deg, q) {
      const iv = chordIv(deg, q), r = chordRoot(deg), how = P.S.voicing, prev = P.lastChordV;
      let v;
      if (how === 'plane') { v = P.stabShape.map(x => r + 12 + x); while (v[0] > 62) v = v.map(x => x - 12); while (v[0] < 52) v = v.map(x => x + 12); }
      else if (how === 'open') { v = [r + 12, r + 19, r + 12 + iv[1] + 12, r + 26]; if (iv.length > 3) v.push(r + 12 + iv[3] + 12); }
      else if (how === 'triad') { v = iv.slice(0, 3).map(x => r + 12 + x); while (v[0] < 60) v = v.map(x => x + 12); while (v[0] > 67) v = v.map(x => x - 12); }
      else {
        // jazz (rootless when bass is present: drop the root, keep 3 7 9) or pad (all chord tones); each tone placed nearest the last chord
        const tones = how === 'jazz' && iv.length >= 4 ? iv.slice(1) : iv.slice(0, Math.max(3, iv.length));
        const ref = prev && prev.length ? prev : [60, 64, 67, 71];
        v = tones.map(x => { const pc = (r + x) % 12; let best = 0, bd = 99; for (let n = 50; n <= 76; n++) if (n % 12 === pc) { const d = Math.min(...ref.map(q2 => Math.abs(q2 - n))) + (n < 52 ? 3 : 0) + (n > 74 ? 3 : 0); if (d < bd) { bd = d; best = n; } } return best; });
        v = [...new Set(v)].sort((a, b) => a - b);
      }
      P.lastChordV = v; return v;
    }
    // ---------------- motifs and lines ----------------
    // a lead motif: 2 bars of 16ths, each note a scale step relative to the chord root (re-fit to every chord), from the genre's
    // rhythm grammar. Phrases play it A A' A B (B = the second motif, or the first with a cadence to the root)
    const GRAMMAR = {
      sparse: { cells: ['x...', '....', 'x.x.', '..x.', '....', 'x..x'], len: [2, 3, 4, 6], step: 0.75 },
      long: { cells: ['x...', '....', '....', 'x.......'.slice(0, 4)], len: [6, 8, 12], step: 0.8 },
      anthem: { cells: ['x...', 'x.x.', '..x.', 'x...'], len: [2, 4, 6], step: 0.65 },
      trance: { cells: ['x.xx', 'x.x.', 'xx.x', '.xx.', 'x.xx'], len: [1, 2], step: 0.55 },
      chip: { cells: ['x.x.', 'xxx.', 'x...', 'x.xx', 'xx.x'], len: [1, 2, 3], step: 0.6 },
      call: { cells: ['x...', '..x.', 'x.x.', '....', '....'], len: [2, 3, 4], step: 0.7 },
      riff: { cells: ['x..x', '..x.', 'x.x.', '...x', 'x...'], len: [1, 2], step: 0.6 },
      bleep: { cells: ['x...', '...x', '..x.', '....', '....'], len: [1, 1, 2], step: 0.5 },
      drone: { cells: ['x...', '....', '....', '....'], len: [8, 12, 16], step: 0.7 },
    };
    function makeMotif(Ld) {
      if (!Ld) return null;
      const Gm = GRAMMAR[Ld.grammar] || GRAMMAR.sparse, notes = [];
      let d = pick([0, 2, 4, 4, 7]);
      for (let b = 0; b < 8; b++) {
        const cell = pick(Gm.cells);
        for (let k = 0; k < 4; k++) if (cell[k] === 'x') {
          const st = b * 4 + k;
          d += chance(Gm.step) ? pick([-1, 1, 1, -1, 2, -2]) : pick([0, 3, -3, 4]);
          d = Math.max(-3, Math.min(9, d));
          notes.push({ st, d, len: pick(Gm.len) });
        }
      }
      if (!notes.length) notes.push({ st: 0, d: 0, len: 4 });
      return notes;
    }
    // 6.3 v2: a hook instead of a random walk. Bar 1 is a call: a rhythm figure from the grammar with a contour (arch, rise, fall,
    // zigzag or pedal). Bar 2 answers it: the same or a sister rhythm, the contour moved, ending on the root or the fifth. The second
    // motif is the contrast (inverted contour, its own rhythm) for bridges and phrase ends. Both are 2 bars, like makeMotif's.
    function makeHook(Ld) {
      if (!Ld) return [null, null];
      const rs = HOOK_R[Ld.grammar] || HOOK_R.sparse, Gm = GRAMMAR[Ld.grammar] || GRAMMAR.sparse, maxL = Math.max(...Gm.len);
      const on = r => r.split('').map((c, i) => c === 'x' ? i : -1).filter(i => i >= 0);
      const shape = pick(['arch', 'rise', 'fall', 'zig', 'pedal']), s0 = pick([0, 2, 4]), leap = pick([2, 3, 4]);
      const step = (k, d) => shape === 'arch' ? d + (k < 2 ? 1 : -1) : shape === 'rise' ? d + (k % 3 === 2 ? 2 : 1) : shape === 'fall' ? d - 1 : shape === 'zig' ? d + (k % 2 ? -1 : 2) : (k % 2 ? s0 : s0 + leap);
      const clampD = d => Math.max(-3, Math.min(9, d));
      const bar1 = (r, d0, off, sh) => { const o = on(r), out = []; let d = d0; o.forEach((st, k) => { const nx = k + 1 < o.length ? o[k + 1] : 16; out.push({ st: st + off, d: clampD(d), len: Math.max(1, Math.min(maxL, nx - st)) }); d = sh(k, d); }); return out; };
      const r1 = pick(rs), r2 = chance(0.6) ? r1 : pick(rs), shift = pick([1, 2, -1, -2]);
      const call = bar1(r1, s0, 0, step), resp = bar1(r2, s0 + shift, 16, step);
      if (resp.length) { const last = resp[resp.length - 1]; last.d = pick([0, 4, 7]); last.len = Math.max(last.len, Math.min(maxL, 16 - (last.st - 16))); }
      const hi = Math.max(...call.map(x => x.d), s0), rc = pick(rs), alt = bar1(rc, hi, 0, (k, d) => d - (shape === 'fall' ? -1 : 1)).concat(bar1(pick(rs), hi - 2, 16, (k, d) => d - 1));
      if (alt.length) alt[alt.length - 1].d = 0;
      return [call.concat(resp), alt.length ? alt : call.concat(resp)];
    }
    function varyHook(m) { // develop the answer bar only, so the call stays recognisable
      const c = m.map(x => ({ ...x })), resp = c.filter(x => x.st >= 16 && x !== c[c.length - 1]); if (!resp.length) return c;
      const x = resp[Math.floor(R() * resp.length)]; x.d += pick([-1, 1, 2]); return c;
    }
    // bass lines: a 16- or 32-step pattern of { st, iv (semitones from chord root), len (16ths), acc, slide }
    function makeBass(B) {
      if (!B) return [];
      const n = (st, iv, len, extra) => Object.assign({ st, iv, len }, extra || {}), out = [];
      switch (B.line) {
        case 'long': out.push(n(0, 0, 16)); if (chance(0.5)) out.push(n(8, pick([0, 7]), 8)); break;
        case 'lofi': out.push(n(0, 0, 6), n(pick([9, 10]), pick([7, 10, 12]), 3)); if (chance(0.6)) out.push(n(14, pick([-1, -2, 1]), 2, { approach: 1 })); break;
        case 'dubby': out.push(n(0, 0, 7), n(10, pick([7, 0]), 4)); if (chance(0.5)) out.push(n(14, 12, 2)); break;
        case 'octave': for (let s = 0; s < 16; s += 2) out.push(n(s, s % 4 === 2 ? 12 : 0, 1.6)); break;
        case 'deep': { const opts = [[2, 6, 8, 10, 14], [3, 6, 10, 14], [2, 7, 10, 14], [0, 3, 6, 10, 13]]; for (const s of pick(opts)) out.push(n(s, pick([0, 0, 0, 10, 7, 12]), 1.5)); break; }
        case 'disco': for (let s = 0; s < 16; s += 2) out.push(n(s, s % 4 === 0 ? 0 : 12, 1.2)); break;
        case 'organ': for (const s of [0, 3, 6, 10, 12, 14]) out.push(n(s, pick([0, 0, 12, 7]), 1.4)); break;
        case 'rumble': for (const s of [2, 6, 10, 14]) out.push(n(s, 0, 1.5)); break;
        case 'acid': for (let s = 0; s < 16; s++) if (chance(s % 4 === 0 ? 0.92 : 0.62)) out.push(n(s, pick([0, 0, 0, 12, 3, 7, 10, 5, -2, 12]), 1, { acc: chance(0.3), slide: chance(0.2) })); break;
        case 'offbeat': for (const s of [2, 6, 10, 14]) out.push(n(s, 0, 1.6)); break;
        case 'rolling': for (let s = 0; s < 16; s++) if (s % 4) out.push(n(s, 0, 0.9)); break;
        case 'twostep': out.push(n(0, 0, 9), n(10, pick([0, 7, -2]), 5)); break;
        case 'reese': out.push(n(0, 0, 14, { slide: 0 }), n(16, pick([0, 3, -2]), 10), n(26, pick([0, 5, 7]), 6, { slide: 1 })); break;
        case 'chip': for (let s = 0; s < 16; s += 2) out.push(n(s, [0, 12, 7, 12][(s / 2) % 4], 1.7)); break;
        case 'dub': { out.push(n(pick([2, 3]), 0, 3)); for (const s of [6, 8, 11, 12, 14]) if (chance(0.55)) out.push(n(s, pick([0, 7, 10, 12, 5, 3]), pick([1.5, 2, 3]))); break; }
        // 6.3 (v2 pieces and boss themes only)
        case 'walk': out.push(n(0, 0, 3.6), n(4, pick([7, 5]), 3.6), n(8, pick([12, 7]), 3.6), n(12, pick([-1, 1, -2]), 3.6, { approach: 1 })); break;
        case 'gallop': for (let s = 0; s < 16; s += 4) out.push(n(s, 0, 0.9), n(s + 2, 0, 0.6), n(s + 3, pick([0, 12]), 0.6)); break;
        case 'pulse8': for (let s = 0; s < 16; s += 2) out.push(n(s, 0, 1.5)); break;
        case 'pat': return typeof B.pat === 'string' ? BP(B.pat) : (B.pat || []).slice();
        default: out.push(n(0, 0, 8));
      }
      return out;
    }
    function makeKeys(K) {
      if (!K) return [];
      const S = s => s.split('').map((c, i) => c === 'x' ? i : -1).filter(i => i >= 0);
      switch (K.rhythm) {
        case 'lofi': return pick([[0, 10], [0, 7, 10], [0, 11], [0, 6, 10, 14]]);
        case 'broken': return [0, 4, 8, 12];
        case 'comp': return pick([[0, 6, 10], [0, 10], [0, 3, 10]]);
        case 'deep': return S(pick(['..x..x....x..x..', 'x..x..x...x..x..', '...x..x...x....x', '..x...x..x..x...']));
        case 'disco': return S(pick(['x..x..x.x..x..x.', '..x..x..x..x..x.', 'x.x..x.x..x.x..x']));
        case 'offbeat': return [2, 6, 10, 14];
        case 'techno': return [pick([3, 6, 10, 14, 11])].concat(chance(0.4) ? [pick([7, 13])] : []);
        case 'dubtechno': return S(pick(['...x......x.....', '..x.....x.....x.', '...x...x....x...']));
        case 'trancepluck': return S('x.x.x.x.x.x.x.x.');
        case 'gate': return S(P.gatePat);
        case 'liquid': return [0, 10];
        case 'skank': return [4, 12];
        case 'arp': return [0, 4, 8, 12];
        case 'pat': return (K.pat || [0]).slice(); // 6.3 boss themes
        default: return [0];
      }
    }

    // ---------------- instruments ----------------
    const evlog = (role, inst, t, n, v) => { if (EV) EV.push([+t.toFixed(4), role, inst, n === null ? null : Math.round(n), +(v || 0).toFixed(2), bar, s16, P ? (P.boss ? 'boss/' + P.boss : P.g + '/' + P.f) : '', P && P.cur ? P.cur.deg : null]); };
    function vca(t, a, d, peak, dest) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); if (d > 0) g.gain.setTargetAtTime(peak * 0.0001, t + a, d / 4); g.connect(dest); return g; }
    function osc(type, f, t, end, dest, det) { const o = ctx.createOscillator(); if (typeof type === 'number') o.setPeriodicWave(pulseWave(type)); else o.type = type; o.frequency.value = f; o.detune.value = (det || 0) + (R() * 6 - 3); o.connect(dest); o.start(t); o.stop(end); return o; }
    function gainN(v, dest) { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
    function lp(f, q, dest, type) { const x = ctx.createBiquadFilter(); x.type = type || 'lowpass'; x.frequency.value = f; x.Q.value = q || 0.7; if (dest) x.connect(dest); return x; }
    function sendFx(node, rev, echo) { if (rev > 0 && revSend) node.connect(gainN(rev, revSend)); if (echo > 0 && echoIn) node.connect(gainN(echo, echoIn)); }
    function noiseSrc(t, dur, lofi) { const s = ctx.createBufferSource(); s.buffer = lofi ? noiseLo : noiseBuf; s.start(t, R() * 1.5); s.stop(t + dur + 0.05); return s; }
    function nhit(t, type, f, q, dur, v, dest, lofi, att) {
      const s = noiseSrc(t, dur, lofi), fl = lp(f, q, null, type), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (att || 0.001)); g.gain.setTargetAtTime(0.0001, t + (att || 0.001), dur / 4);
      s.connect(fl); fl.connect(g); g.connect(dest); return g;
    }
    // ---- drums (kits: dusty, soft, break, linn, 909, chip, dub) ----
    const KITS = {
      dusty: { K: { f0: 120, f1: 52, pd: 0.04, dec: 0.32, click: 0.1 }, S: { tone: 190, n: 1100, dec: 0.18, v: 0.55 }, H: { hp: 6500, dec: 0.045, metal: 0 }, O: { hp: 6000, dec: 0.22 }, lofi: 1 },
      soft: { K: { f0: 90, f1: 48, pd: 0.05, dec: 0.4, click: 0 }, S: { tone: 200, n: 1500, dec: 0.15, v: 0.3 }, H: { hp: 8000, dec: 0.03 }, O: { hp: 7000, dec: 0.2 } },
      break: { K: { f0: 150, f1: 50, pd: 0.035, dec: 0.3, click: 0.25 }, S: { tone: 210, n: 1600, dec: 0.17, v: 0.65 }, H: { hp: 7000, dec: 0.04 }, O: { hp: 6500, dec: 0.25 }, D: { dec: 0.5 }, lofi: 1 },
      linn: { K: { f0: 140, f1: 48, pd: 0.03, dec: 0.36, click: 0.2 }, S: { tone: 185, n: 1800, dec: 0.12, v: 0.7, gated: 1 }, H: { hp: 8000, dec: 0.035, metal: 1 }, O: { hp: 7500, dec: 0.2, metal: 1 }, T: 1 },
      '909': { K: { f0: 220, f1: 50, pd: 0.045, dec: 0.38, click: 0.35 }, S: { tone: 180, n: 2000, dec: 0.16, v: 0.6 }, H: { hp: 9000, dec: 0.04, metal: 1 }, O: { hp: 8500, dec: 0.28, metal: 1 }, D: { dec: 0.7 } },
      dub: { K: { f0: 110, f1: 46, pd: 0.05, dec: 0.45, click: 0.05 }, S: { tone: 230, n: 2500, dec: 0.12, v: 0.4 }, H: { hp: 7500, dec: 0.05 }, O: { hp: 7000, dec: 0.2 }, spring: 1 },
      chip: { chip: 1 },
      hard: { K: { f0: 240, f1: 46, pd: 0.05, dec: 0.4, click: 0.45, drive: 1 }, S: { tone: 190, n: 1800, dec: 0.17, v: 0.75 }, H: { hp: 8500, dec: 0.04, metal: 1 }, O: { hp: 8000, dec: 0.25, metal: 1 } }, // 6.3: distorted kick (Industrial, boss themes)
    };
    const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
    function kick(t, v, K) {
      const o = ctx.createOscillator(), g = ctx.createGain(), dest = L.drums;
      o.frequency.setValueAtTime(K.f0, t); o.frequency.exponentialRampToValueAtTime(K.f1, t + K.pd);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 1.05, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.01, K.dec / 3.5);
      o.connect(g); if (K.drive) { const sh = ctx.createWaveShaper(); sh.curve = driveCurve(); g.connect(gainN(1.8, sh)); sh.connect(gainN(0.55, dest)); } else g.connect(dest); o.start(t); o.stop(t + K.dec * 2 + 0.1);
      if (K.click) nhit(t, 'lowpass', 4000, 0.7, 0.006, v * K.click, dest);
      duck(t);
    }
    function snare(t, v, Sx) {
      const dest = L.drums, g = nhit(t, 'highpass', Sx.n, 0.7, Sx.dec, v * Sx.v, dest, P.S.kit === 'dusty');
      const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(Sx.tone * 1.3, t); o.frequency.exponentialRampToValueAtTime(Sx.tone, t + 0.03);
      og.gain.setValueAtTime(v * 0.5, t); og.gain.setTargetAtTime(0.0001, t, 0.025); o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.2);
      if (Sx.gated && gateConv) { g.connect(gainN(1.6, gateConv)); og.connect(gainN(0.8, gateConv)); gateG.gain.cancelScheduledValues(t); gateG.gain.setValueAtTime(1, t); gateG.gain.setValueAtTime(1, t + 0.17); gateG.gain.linearRampToValueAtTime(0, t + 0.21); }
      sendFx(g, KITS[P.S.kit].spring ? 0.6 : 0.15, KITS[P.S.kit].spring ? 0.25 : 0);
    }
    function clap(t, v) { for (const d of [0, 0.009, 0.019]) nhit(t + d, 'bandpass', 1200, 1.1, d === 0.019 ? 0.16 : 0.012, v * 0.7, L.drums); const g = nhit(t + 0.019, 'bandpass', 1300, 1, 0.2, v * 0.25, L.drums); sendFx(g, 0.3, 0); }
    function hat(t, v, H, open) {
      const dest = L.drums, dec = (open ? (H && H.dec) || 0.22 : (H && H.dec) || 0.04), hp = (H && H.hp) || 7500;
      if (H && H.metal && open) { // metallic six-square cymbal for open hats; closed hats use filtered noise (cheaper, and short enough not to tell)
        const bp = lp(10000, 1, null, 'bandpass'), hpf = lp(hp, 0.7, null, 'highpass'), g = ctx.createGain();
        g.gain.setValueAtTime(v * 0.35, t); g.gain.setTargetAtTime(0.0001, t, dec / 3.5); bp.connect(hpf); hpf.connect(g); g.connect(dest);
        for (const f of METAL) osc('square', f * 1.5, t, t + dec * 2 + 0.05, bp, 0);
      } else nhit(t, 'highpass', hp, 0.7, dec, v * 0.45, dest, KITS[P.S.kit].lofi);
    }
    function ride(t, v) { const g = ctx.createGain(), bp = lp(5200, 0.8, null, 'bandpass'); g.gain.setValueAtTime(v * 0.12, t); g.gain.setTargetAtTime(0.0001, t, 0.15); bp.connect(g); g.connect(L.drums); for (const f of METAL) osc('square', f * 2.2, t, t + 0.7, bp, 0); nhit(t, 'highpass', 9000, 0.7, 0.3, v * 0.08, L.drums); }
    function rim(t, v) { nhit(t, 'bandpass', 3200, 6, 0.04, v * 0.8, L.drums); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 480; g.gain.setValueAtTime(v * 0.45, t); g.gain.setTargetAtTime(0.0001, t, 0.012); o.connect(g); g.connect(L.drums); sendFx(g, KITS[P.S.kit].spring ? 0.7 : 0.2, P.g === 'dub' || P.f === 'minimal' ? 0.5 : 0.15); o.start(t); o.stop(t + 0.08); }
    function shaker(t, v) { nhit(t, 'bandpass', 6500, 1.4, 0.05, v * 0.22, L.drums, 0, 0.012); }
    function tom(t, v, f) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f * 1.4, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); g.gain.setValueAtTime(v * 0.7, t); g.gain.setTargetAtTime(0.0001, t, 0.12); o.connect(g); g.connect(L.drums); sendFx(g, 0.5, 0); o.start(t); o.stop(t + 0.6); }
    function crash(t, v) { const g = nhit(t, 'highpass', 5000, 0.5, 1.6, v * 0.18, L.drums); sendFx(g, 0.4, 0); }
    function chipDrum(t, kind, v) {
      if (kind === 'K') { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.06); g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v * 0.7, t + 0.03); g.gain.linearRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(L.drums); o.start(t); o.stop(t + 0.12); nhit(t, 'lowpass', 1200, 0.5, 0.03, v * 0.4, L.drums, 1); duck(t); }
      else if (kind === 'S') nhit(t, 'lowpass', 5000, 0.5, 0.12, v * 0.75, L.drums, 1);
      else nhit(t, 'highpass', 8000, 0.5, kind === 'O' ? 0.12 : 0.025, v * 0.4, L.drums, 1);
    }
    function drumHit(vk, t, v) {
      evlog('drums', vk, t, null, v);
      const K = KITS[P.S.kit] || KITS['909'];
      if (K.chip) return chipDrum(t, vk === 'K' ? 'K' : vk === 'S' || vk === 'C' ? 'S' : vk === 'O' ? 'O' : 'H', v);
      if (vk === 'K') kick(t, v, K.K); else if (vk === 'S') snare(t, v, K.S); else if (vk === 'C') clap(t, v); else if (vk === 'H') hat(t, v, K.H, 0);
      else if (vk === 'O') hat(t, v, K.O, 1); else if (vk === 'R') rim(t, v); else if (vk === 'D') ride(t, v); else if (vk === 'P') shaker(t, v);
      else if (vk === 'X') anvil(t, v); else if (vk === 'Z') tick(t, v); else if (vk === 'T') tom(t, v, 98); // 6.3 voices (Industrial, boss themes)
    }
    // 6.3: an anvil clang (three inharmonic partials) and a typewriter tick
    function anvil(t, v) { const g = vca(t, 0.001, 0.35, v * 0.16, L.drums); for (const f of [523, 1318, 1977]) osc(f > 1000 ? 'square' : 'triangle', f, t, t + 0.5, f > 1000 ? gainN(0.25, g) : g, 0); nhit(t, 'highpass', 3000, 0.7, 0.03, v * 0.3, L.drums); sendFx(g, 0.35, 0.1); }
    function tick(t, v) { nhit(t, 'bandpass', 4200, 4, 0.012, v * 0.55, L.drums, 0, 0.0008); }
    // ---- sidechain: every kick dips the melodic channels (the pump), depth from the genre and the Pump knob ----
    function duck(t) {
      const d = fxK(live().fx.pump, P.S.mix.side, 0.45); if (!scG || d < 0.02) return;
      const a = Math.min(0.85, d), rel = Math.min(0.4, P.spb * 0.6);
      scG.gain.cancelScheduledValues(t); scG.gain.setValueAtTime(1, t); scG.gain.linearRampToValueAtTime(1 - a, t + 0.006); scG.gain.setTargetAtTime(1, t + 0.03, rel / 2.5);
    }
    // ---- bass ----
    function bassNote(t, n, dur, v, kind, o) {
      o = o || {}; evlog('bass', kind, t, n, v);
      const dest = L.bass, f = mtof(n);
      if (kind === 'acid') {
        const fl = lp(1, 0, null), g = ctx.createGain(), E = effE(), q = 9 + 7 * E, base = 260 + 500 * E, peak = base * Math.pow(2, (o.acc ? 3.2 : 2) + E);
        fl.Q.value = q; fl.frequency.setValueAtTime(peak, t); fl.frequency.setTargetAtTime(base, t, o.acc ? 0.06 : 0.09);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * (o.acc ? 0.75 : 0.5), t + 0.003); g.gain.setTargetAtTime(0.0001, t + dur * (o.slide ? 1.8 : 0.85), 0.025);
        const sh = ctx.createWaveShaper(); sh.curve = driveCurve(); fl.connect(sh); sh.connect(g); g.connect(dest); sendFx(g, 0.1, 0.18);
        const x = osc('sawtooth', f, t, t + dur * 2.2 + 0.1, fl); if (o.slide && o.next) x.frequency.setTargetAtTime(mtof(o.next), t + dur * 0.6, 0.02);
        return;
      }
      if (kind === 'wobble') { // 6.3: a saw pair through a resonant lowpass swept by an LFO at 2 (or, accented, 4) per beat
        const fl = lp(700, 7, vca(t, 0.01, dur, v * 0.5, dest)), lfo = ctx.createOscillator(), lg = gainN(650, fl.frequency); lfo.type = 'triangle'; lfo.frequency.value = (o.acc ? 4 : 2) / P.spb; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.4);
        osc('sawtooth', f, t, t + dur + 0.4, fl, -9); osc('sawtooth', f, t, t + dur + 0.4, fl, 9); osc('sine', f / 2, t, t + dur + 0.4, gainN(0.8, vca(t, 0.01, dur, v * 0.6, dest))); return;
      }
      if (kind === 'reese') { const fl = lp(380 + 300 * effE(), 1.2, vca(t, 0.02, dur, v * 0.55, dest)); const lfo = ctx.createOscillator(), lg = gainN(160, fl.frequency); lfo.frequency.value = 0.3; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.4); osc('sawtooth', f, t, t + dur + 0.4, fl, -14); osc('sawtooth', f, t, t + dur + 0.4, fl, 14); osc('sine', f / 2, t, t + dur + 0.4, gainN(0.9, vca(t, 0.02, dur, v * 0.7, dest))); return; }
      if (kind === 'sawoct' || kind === 'saw') { const fl = lp(1, 5, vca(t, 0.004, dur * 1.2, v * 0.6, dest)); fl.frequency.setValueAtTime(900 + 700 * effE(), t); fl.frequency.setTargetAtTime(240, t, 0.08); osc('sawtooth', f, t, t + dur + 0.3, fl); if (kind === 'sawoct') osc('sawtooth', f * 2, t, t + dur + 0.3, gainN(0.4, fl)); osc('sine', f / (kind === 'sawoct' ? 1 : 2), t, t + dur + 0.3, gainN(0.6, vca(t, 0.004, dur, v * 0.6, dest))); return; }
      if (kind === 'organ') { const fl = lp(1, 0.5, vca(t, 0.003, dur * 0.8, v * 0.55, dest)); fl.frequency.setValueAtTime(2500, t); fl.frequency.setTargetAtTime(320, t, 0.06); osc('triangle', f, t, t + dur + 0.3, fl); osc('square', f * Math.pow(2, 19 / 12), t, t + dur + 0.3, gainN(0.22, fl)); osc('sine', f / 2, t, t + dur + 0.3, gainN(0.7, vca(t, 0.003, dur, v * 0.5, dest))); nhit(t, 'lowpass', 2000, 0.5, 0.01, v * 0.15, dest); return; }
      if (kind === 'tri' || kind === 'wave') { const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.95, t); g.gain.setValueAtTime(v * 0.95, t + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + dur); g.connect(dest); osc(kind === 'wave' ? 0.5 : 'triangle', f, t, t + dur + 0.02, kind === 'wave' ? lp(900, 0.5, g) : g); return; }
      if (kind === 'upright') { const fl = lp(420, 0.8, vca(t, 0.006, dur * 0.7, v * 0.95, dest)); osc('triangle', f, t, t + dur + 0.4, fl); osc('sine', f, t, t + dur + 0.4, fl); nhit(t, 'bandpass', 900, 2, 0.02, v * 0.08, dest); return; }
      if (kind === 'dub') { const fl = lp(240, 0.7, vca(t, 0.025, dur * 0.95, v * 1.15, dest)); osc('sine', f, t, t + dur + 0.5, fl); osc('triangle', f, t, t + dur + 0.5, gainN(0.6, fl)); return; }
      // sub (sine + a touch of 2nd harmonic)
      const g = vca(t, 0.012, dur * 0.95, v * 1.1, dest); osc('sine', f, t, t + dur + 0.4, g); osc('sine', f * 2, t, t + dur + 0.4, gainN(0.12, g));
    }
    let _drive = null; const driveCurve = () => _drive || (_drive = (() => { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); } return c; })());
    // ---- chords and keys ----
    function rhodes(n, t, v, dec) { // DX7 E.PIANO1 style: a 1:1 body pair and a 14:1 tine pair, tremolo-panned
      evlog('keys', 'rhodes', t, n, v);
      const g = vca(t, 0.004, dec, v, L.keys), car = ctx.createOscillator(), m1 = ctx.createOscillator(), mg = ctx.createGain(), m2 = ctx.createOscillator(), mg2 = ctx.createGain(), f = mtof(n);
      car.frequency.value = f; car.detune.value = R() * 8 - 4; m1.frequency.value = f; m2.frequency.value = f * 14;
      const hi = Math.max(0.35, 1 - (n - 60) / 40); mg.gain.setValueAtTime(f * 1.5 * hi * (0.6 + v * 0.6), t); mg.gain.setTargetAtTime(f * 0.3 * hi, t, 0.4);
      mg2.gain.setValueAtTime(f * 2 * hi, t); mg2.gain.setTargetAtTime(0.01, t, 0.015);
      m1.connect(mg); mg.connect(car.frequency); m2.connect(mg2); mg2.connect(car.frequency);
      let out = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(), lfo = ctx.createOscillator(), lg = gainN(0.3, p.pan); lfo.frequency.value = 4; lfo.connect(lg); lfo.start(t); lfo.stop(t + dec + 0.4); car.connect(p); p.connect(g); } else car.connect(g);
      const e = t + dec + 0.4; for (const o of [car, m1, m2]) { o.start(t); o.stop(e); }
      sendFx(g, 0.35, 0.12);
    }
    function piano(n, t, v, dec) { evlog('keys', 'piano', t, n, v); const f = mtof(n), g = vca(t, 0.002, dec, v * 0.9, L.keys), fl = lp(Math.min(9000, f * 9), 0.5, g); fl.frequency.setTargetAtTime(f * 3, t, 0.25); osc('triangle', f, t, t + dec + 0.4, fl, -3); osc('triangle', f, t, t + dec + 0.4, fl, 3); osc('sine', f * 2, t, t + dec + 0.4, gainN(0.3, fl)); nhit(t, 'bandpass', f * 4, 1, 0.015, v * 0.06, g); sendFx(g, 0.35, 0.1); }
    function stab(ns, t, v, how) {
      for (const n of ns) evlog('keys', 'stab', t, n, v);
      const E = effE(), fl = lp(1, how === 'dubtechno' ? 3 : 2.5, null, how === 'dubtechno' ? 'bandpass' : 'lowpass'), g = vca(t, 0.003, how === 'dubtechno' ? 0.25 : 0.32, v, L.keys);
      fl.connect(g);
      if (how === 'dubtechno') { fl.frequency.setValueAtTime(380 + 400 * E, t); }
      else { fl.frequency.setValueAtTime(900 + 2400 * E, t); fl.frequency.setTargetAtTime(500, t, 0.12); }
      for (const n of ns) { osc('sawtooth', mtof(n), t, t + 0.6, fl, -7); osc('sawtooth', mtof(n), t, t + 0.6, fl, 7); osc(0.5, mtof(n), t, t + 0.6, gainN(0.4, fl)); }
      sendFx(g, how === 'dubtechno' ? 0.6 : 0.25, how === 'dubtechno' ? 0.9 : how === 'techno' ? 0.45 : 0.3);
    }
    function organ(ns, t, v, dur) { for (const n of ns) { evlog('keys', 'organ', t, n, v); const g = vca(t, 0.004, dur, v * 0.32, L.keys); for (const [h, a] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.22]]) osc('sine', mtof(n) * h, t, t + dur + 0.3, gainN(a, g)); nhit(t, 'bandpass', mtof(n) * 6, 2, 0.008, v * 0.08, g); sendFx(g, 0.25, 0.2); } }
    function skank(ns, t, v) { for (const n of ns) evlog('keys', 'skank', t, n, v); const fl = lp(1400, 0.8, null, 'bandpass'), g = vca(t, 0.002, 0.12, v * 0.6, L.keys); fl.connect(g); for (const n of ns) { osc(0.25, mtof(n), t, t + 0.2, fl); osc('triangle', mtof(n), t, t + 0.2, fl); } sendFx(g, 0.5, 0.75); }
    function pluck(n, t, v, dest, role) { evlog(role || 'arp', 'pluck', t, n, v); const fl = lp(1, 2.4, vca(t, 0.002, 0.45, v, dest || L.arp)); fl.frequency.setValueAtTime(1200 + 4000 * effE(), t); fl.frequency.setTargetAtTime(420, t, 0.07); osc('sawtooth', mtof(n), t, t + 0.5, fl, 0); }
    function chipNote(n, t, dur, v, duty, dest, role) { evlog(role, 'chip', t, n, v); const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v * 0.75, t + Math.min(dur * 0.5, 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + dur); g.connect(dest); osc(duty, mtof(n), t, t + dur + 0.02, g); }
    // gated supersaw chord: one sustained 3-voice stack per note, chopped by the trance gate pattern
    function gateChord(ns, t, sp16, bars, v) {
      for (const n of ns) evlog('keys', 'gate', t, n, v);
      const g = ctx.createGain(), fl = lp(2400 + 4000 * effE(), 0.8, g), dur = bars * 16 * sp16; g.connect(L.keys); g.gain.setValueAtTime(0, t);
      for (let s = 0; s < bars * 16; s++) if (P.gatePat[s % 16] === 'x') { const a = t + s * sp16; g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(v * 0.5, a + 0.003); g.gain.setValueAtTime(v * 0.5, a + sp16 * 0.6); g.gain.linearRampToValueAtTime(0, a + sp16 * 0.6 + 0.004); }
      for (const n of ns) for (const d of [-14, 0, 14]) osc('sawtooth', mtof(n), t, t + dur + 0.05, fl, d);
      sendFx(g, 0.45, 0.3);
    }
    // ---- pads ----
    function pad(ns, t, dur, v, kind) {
      if (!kind) return; for (const n of ns) evlog('pads', kind, t, n, v);
      const E = effE(), atk = kind === 'warm' || kind === 'strings' ? Math.min(2.2, dur * 0.35) : kind === 'supersaw' ? 0.4 : 0.6, top = kind === 'dark' ? 500 + 500 * E : kind === 'juno' ? 900 + 2000 * E : kind === 'supersaw' ? 3000 + 5000 * E : kind === 'strings' ? 1400 + 1600 * E : 800 + 1400 * E;
      const fl = lp(300, kind === 'juno' ? 1.4 : 0.7), g = ctx.createGain();
      fl.frequency.setValueAtTime(300, t); fl.frequency.linearRampToValueAtTime(top, t + dur * 0.45); fl.frequency.linearRampToValueAtTime(top * 0.6, t + dur + 1.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + atk); g.gain.setValueAtTime(v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + (kind === 'warm' ? 2.2 : 1.2));
      fl.connect(g); g.connect(L.pad);
      const end = t + dur + 2.4;
      for (const n of ns) {
        if (kind === 'supersaw') { for (const d of [-30, -18, -8, 0, 8, 18, 30]) osc('sawtooth', mtof(n), t, end, gainN(d ? 0.5 : 1, fl), d); continue; }
        if (kind === 'strings') { osc('sawtooth', mtof(n), t, end, fl, -9); osc(0.42, mtof(n), t, end, fl, 9); continue; }
        osc('sawtooth', mtof(n), t, end, fl, kind === 'juno' ? -11 : -7); osc('sawtooth', mtof(n), t, end, fl, kind === 'juno' ? 11 : 7);
        if (kind === 'warm') osc('triangle', mtof(n - 12), t, end, fl, 0);
      }
    }
    // ---- leads ----
    function lead(n, t, dur, v, kind, duty) {
      evlog('lead', kind, t, n, v);
      const dest = L.lead, f = mtof(n);
      if (kind === 'bell' || kind === 'glass') { const g = vca(t, 0.003, kind === 'glass' ? 1.6 : 2.8, v, L.spark), car = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(); car.frequency.value = f; m.frequency.value = f * (kind === 'glass' ? 7 : 3.5); mg.gain.setValueAtTime(f * 1.2, t); mg.gain.setTargetAtTime(f * 0.05, t, 0.4); m.connect(mg); mg.connect(car.frequency); car.connect(g); car.start(t); m.start(t); car.stop(t + 3.4); m.stop(t + 3.4); sendFx(g, 0.6, 0.35); return; }
      if (kind === 'piano') return piano(n, t, v, 1.4);
      if (kind === 'bleep') { const g = vca(t, 0.002, 0.22, v * 0.8, dest); osc('sine', f, t, t + 0.3, g); osc(0.125, f * 2, t, t + 0.12, gainN(0.25, g)); sendFx(g, 0.3, 0.6); return; }
      if (BOSS_LEADS[kind]) return BOSS_LEADS[kind](n, f, t, dur, v, dest);
      const fl = lp(kind === 'saw' ? 2600 + 2500 * effE() : kind === 'melodica' ? 1500 : kind === 'flute' ? 2800 : kind === 'chip' ? 8000 : kind === 'theremin' ? 3000 : 5500, kind === 'melodica' ? 1 : 0.7, null, kind === 'melodica' ? 'bandpass' : 'lowpass');
      const g = ctx.createGain(), a = kind === 'chip' ? 0.003 : kind === 'flute' || kind === 'theremin' ? 0.06 : 0.025;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setTargetAtTime(v * (kind === 'chip' ? 0.7 : 0.75), t + a, dur * 0.4); g.gain.setTargetAtTime(0.0001, t + dur, kind === 'chip' ? 0.02 : 0.1);
      fl.connect(g); g.connect(dest);
      sendFx(g, kind === 'chip' ? 0 : kind === 'supersaw' ? 0.5 : 0.35, kind === 'melodica' ? 0.55 : kind === 'chip' ? 0.15 : 0.3);
      const end = t + dur + 0.7;
      const vib = (o, depth, rate, delay) => { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * depth, t + delay); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end); };
      if (kind === 'supersaw') { for (const d of [-16, 0, 16]) osc('sawtooth', f, t, end, fl, d); return; }
      if (kind === 'saw') { vib(osc('sawtooth', f, t, end, fl, -7), 0.007, 5.3, 0.3); vib(osc(0.5, f, t, end, gainN(0.6, fl), 7), 0.007, 5.3, 0.3); return; }
      if (kind === 'melodica') { vib(osc(0.25, f, t, end, fl), 0.004, 5, 0.25); osc('square', f, t, end, gainN(0.5, fl), 6); return; }
      if (kind === 'flute') { vib(osc('sine', f, t, end, fl), 0.006, 5, 0.2); osc('triangle', f * 2, t, end, gainN(0.12, fl)); nhit(t, 'bandpass', f * 2, 2, dur, v * 0.08, g, 0, 0.05); return; }
      if (kind === 'theremin') { const o = osc('sine', f, t, end, fl); if (P._lastLead) { o.frequency.setValueAtTime(mtof(P._lastLead), t); o.frequency.setTargetAtTime(f, t, 0.06); } vib(o, 0.018, 5.5, 0.15); P._lastLead = n; return; }
      if (kind === 'chip') { vib(osc(duty || 0.25, f, t, end, fl), dur > 0.25 ? 0.012 : 0, 6, 0.18); return; }
      vib(osc(0.25, f, t, end, fl), 0.006, 5, 0.25);
    }
    // ---- 6.3 leads for boss themes (and the Brass lead of v2 pieces): each is one to three oscillators ----
    const env = (t, a, dur, v, rel, dest) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setTargetAtTime(v * 0.8, t + a, 0.15); g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur), rel); g.connect(dest); return g; };
    const vibr = (o, f, t, end, depth, rate, delay) => { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * depth, t + delay); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end); };
    const glideFrom = (o, f, t, k) => { if (P._lastLead) { o.frequency.setValueAtTime(mtof(P._lastLead), t); o.frequency.setTargetAtTime(f, t, k); } };
    const BOSS_LEADS = {
      brass(n, f, t, dur, v, dest) { // three detuned saws, a filter that opens on the attack
        const E = effE(), g = env(t, 0.03, dur, v, 0.08, dest), fl = lp(400, 1.1, g), end = t + dur + 0.6;
        fl.frequency.setValueAtTime(400, t); fl.frequency.linearRampToValueAtTime(2200 + 2200 * E, t + 0.06); fl.frequency.setTargetAtTime(1100 + 900 * E, t + 0.08, 0.2);
        for (const d of [-9, 0, 9]) vibr(osc('sawtooth', f, t, end, fl, d), f, t, end, 0.005, 5.2, 0.35); sendFx(g, 0.15, 0.08);
      },
      dist(n, f, t, dur, v, dest) { // saw and square through drive, darkened
        const g = env(t, 0.01, dur, v * 0.7, 0.07, dest), sh = ctx.createWaveShaper(); sh.curve = driveCurve(); const fl = lp(2600, 0.9, g); sh.connect(fl);
        const pre = gainN(2.4, sh), end = t + dur + 0.4; vibr(osc('sawtooth', f, t, end, pre, -6), f, t, end, 0.006, 5.5, 0.25); osc(0.5, f / 2, t, end, gainN(0.5, pre), 6); sendFx(g, 0.12, 0.08);
      },
      growl(n, f, t, dur, v, dest) { // detuned saws through a talking bandpass (the worm)
        const g = env(t, 0.01, dur, v * 1.1, 0.06, dest), fl = lp(500, 4, g, 'bandpass'), end = t + dur + 0.3;
        fl.frequency.setValueAtTime(400, t); fl.frequency.exponentialRampToValueAtTime(1800, t + Math.min(0.12, dur * 0.5)); fl.frequency.exponentialRampToValueAtTime(700, t + dur);
        osc('sawtooth', f, t, end, fl, -12); osc('sawtooth', f, t, end, fl, 12); osc('square', f / 2, t, end, gainN(0.4, fl)); sendFx(g, 0.1, 0.12);
      },
      quack(n, f, t, dur, v, dest) { // a pulse that drops at the end, through a closing formant
        const g = env(t, 0.004, Math.min(dur, 0.22), v * 1.2, 0.04, dest), fl = lp(1500, 3, g, 'bandpass'), end = t + dur + 0.2, o = osc(0.25, f * 1.05, t, end, fl);
        o.frequency.setTargetAtTime(f, t, 0.012); o.frequency.setTargetAtTime(f * 0.82, t + Math.min(dur, 0.22) * 0.7, 0.03);
        fl.frequency.setValueAtTime(1600, t); fl.frequency.exponentialRampToValueAtTime(650, t + 0.14); sendFx(g, 0.2, 0.15);
      },
      meow(n, f, t, dur, v, dest) { // mee-ow: pitch up then down, formant opens then closes
        const g = env(t, 0.04, dur, v * 1.1, 0.12, dest), fl = lp(800, 3.5, g, 'bandpass'), end = t + dur + 0.5, o = osc('sawtooth', f * 0.94, t, end, fl);
        o.frequency.linearRampToValueAtTime(f * 1.03, t + dur * 0.35); o.frequency.linearRampToValueAtTime(f * 0.84, t + dur + 0.1);
        fl.frequency.setValueAtTime(700, t); fl.frequency.linearRampToValueAtTime(1900, t + dur * 0.35); fl.frequency.linearRampToValueAtTime(800, t + dur + 0.1);
        osc('sine', f, t, end, gainN(0.35, g)); sendFx(g, 0.2, 0.1);
      },
      pizz(n, f, t, dur, v, dest) { // plucked strings: triangle and saw, fast decay
        const g = vca(t, 0.002, 0.28, v * 1.2, dest), fl = lp(3200, 0.8, g); fl.frequency.setTargetAtTime(900, t, 0.06);
        osc('triangle', f, t, t + 0.6, fl); osc('sawtooth', f, t, t + 0.6, gainN(0.35, fl), 4); sendFx(g, 0.3, 0.1);
      },
      harpsi(n, f, t, dur, v, dest) { // harpsichord: two pulses an octave apart, bright and short
        const g = vca(t, 0.001, 0.5, v * 0.85, dest), hp = lp(320, 0.7, g, 'highpass'), fl = lp(7000, 0.6, hp);
        osc(0.25, f, t, t + 0.9, fl); osc(0.125, f * 2, t, t + 0.9, gainN(0.45, fl)); sendFx(g, 0.3, 0.05);
      },
      whale(n, f, t, dur, v, dest) { // a long glide between notes, slow vibrato, a big hall
        const g = env(t, 0.14, dur, v * 1.1, 0.25, dest), fl = lp(1900, 0.8, g), end = t + dur + 1.2, o = osc('sine', f, t, end, fl), o2 = osc('triangle', f / 2, t, end, gainN(0.45, fl));
        glideFrom(o, f, t, 0.12); glideFrom(o2, f / 2, t, 0.12); vibr(o, f, t, end, 0.012, 4, 0.4); P._lastLead = n; sendFx(g, 0.25, 0.1);
      },
      drop(n, f, t, dur, v, dest) { // a water drop: the pitch falls onto the note (the gloop)
        const g = vca(t, 0.002, Math.min(0.35, dur), v * 1.25, dest), o = osc('sine', f * 1.6, t, t + 0.6, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        osc('triangle', f * 2, t, t + 0.2, gainN(0.15, g)); sendFx(g, 0.3, 0.3);
      },
    };
    // 6.3: stinger into a boss theme (impact, a falling sub, the tonic on the theme's lead) and the victory sting after a kill
    function bossHit(t, th) {
      evlog('fx', 'stinger', t, null, 1); crash(t, 1.2); kick(t, 1, KITS.hard.K);
      const g = vca(t, 0.005, 1.1, 0.5, L.drums), o = osc('sine', 90, t, t + 1.4, g); o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
      const base = th.root + 12 * Math.round((th.lead.oct - th.root) / 12); lead(base - 12, t, 0.7, 0.8, th.lead.kind); lead(base, t, 0.7, 0.6, th.lead.kind);
    }
    function victory(t, th) {
      evlog('fx', 'victory', t, null, 1); const base = th.root + 12 * Math.round((th.lead.oct - th.root) / 12), k = th.lead.k2 || th.lead.kind;
      [0, 4, 7].forEach((x, i) => lead(base + x, t + i * 0.11, 0.18, 0.8, k));
      lead(base + 12, t + 0.33, 1.3, 0.9, k); pad([base, base + 4, base + 7], t + 0.33, 1.2, 0.9, 'juno'); crash(t + 0.33, 1); kick(t + 0.33, 0.9, KITS['909'].K);
    }
    // ---- one-shots: riser, siren ----
    function riser(t, dur, v) { evlog('fx', 'riser', t, null, v); const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = lp(300, 3, null, 'bandpass'), g = ctx.createGain(); fl.frequency.setValueAtTime(300, t); fl.frequency.exponentialRampToValueAtTime(9000, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.35, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05); s.connect(fl); fl.connect(g); g.connect(L.drums); sendFx(g, 0.5, 0); s.start(t); s.stop(t + dur + 0.1); }
    function siren(t, v) { evlog('fx', 'siren', t, null, v); const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = vca(t, 0.05, 1.2, v * 0.12, L.lead); o.type = 'sine'; o.frequency.value = 600; lfo.type = 'triangle'; lfo.frequency.setValueAtTime(2, t); lfo.frequency.linearRampToValueAtTime(7, t + 1.2); lg.gain.value = 350; lfo.connect(lg); lg.connect(o.frequency); o.connect(g); sendFx(g, 0.5, 1.2); o.start(t); lfo.start(t); o.stop(t + 1.6); lfo.stop(t + 1.6); }

    // ---------------- the music chain ----------------
    function busFor() {
      // channels (faders + meters) -> [sidechain for all but drums] -> mIn -> tape wow (modulated delay) -> crush blend -> tone LP
      // -> glue compressor -> music bus. Sends: two crossfaded reverbs (sized per genre) and a ping-pong echo timed to the beat.
      mIn = ctx.createGain(); mIn.gain.value = 0.62;
      sweepLP = lp(20000, 0.9, mIn); scG = ctx.createGain(); scG.connect(sweepLP);
      wowD = ctx.createDelay(0.05); wowD.delayTime.value = 0.012; const wl = ctx.createOscillator(); wl.frequency.value = 0.7; wowG = ctx.createGain(); wowG.gain.value = 0; wl.connect(wowG); wowG.connect(wowD.delayTime); wl.start();
      const fl = ctx.createOscillator(); fl.frequency.value = 9.5; const flG = gainN(0, wowD.delayTime); fl.connect(flG); fl.start(); P_flG = flG;
      mIn.connect(wowD);
      crushWS = ctx.createWaveShaper(); { const n = 4096, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = Math.round(x * 31) / 31; } crushWS.curve = c; }
      crushMix = gainN(0); cleanMix = gainN(1);
      toneLP = lp(15000, 0.5); toneHS = ctx.createBiquadFilter(); toneHS.type = 'highshelf'; toneHS.frequency.value = 3200; toneHS.gain.value = 0;
      wowD.connect(cleanMix); crushWS.connect(crushMix); cleanMix.connect(toneLP); crushMix.connect(toneLP); // the crusher is only patched in when Tape is high (CPU)
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 2.5; comp.knee.value = 12; comp.attack.value = 0.015; comp.release.value = 0.25;
      outAn = ctx.createAnalyser(); outAn.fftSize = 256; outAn.smoothingTimeConstant = 0.75;
      pauseG = gainN(paused ? 0 : 1, comp); trimG = gainN(1, pauseG); toneLP.connect(toneHS); toneHS.connect(trimG); comp.connect(synthOut()); comp.connect(outAn); // v5.5: pauseG mutes the music (Studio Pause)
      revSend = ctx.createGain(); revRet = gainN(0.5, toneLP);
      revHP = lp(200, 0.7, null, 'highpass'); revSend.connect(revHP); selectRoom(1, ctx.currentTime); // only the active room is fed (CPU)
      if (!offline) [3, 6, 9].forEach((s0, i) => setTimeout(() => { try { ensureRoom(i); } catch (e) {} }, s0 * 1000)); // build the other rooms in quiet moments, not at a song change
      // gated reverb for the synthwave snare: a short bright room cut by a gate opened on each snare
      gateConv = ctx.createGain(); gateCv = ctx.createConvolver(); gateCv.buffer = impulse(2.2, 0.5); gateG = gainN(0); gateCv.connect(gateG); gateG.connect(toneLP); // patched in for gated kits only
      // ping-pong echo
      echoIn = ctx.createGain(); echoL = ctx.createDelay(3); echoR = ctx.createDelay(3); echoFb = gainN(0.35); echoRet = gainN(0.6);
      const ehp = lp(220, 0.7, null, 'highpass'), elp = lp(3500, 0.7);
      echoIn.connect(echoL); echoL.connect(elp); elp.connect(ehp); ehp.connect(echoR); echoR.connect(echoFb); echoFb.connect(echoL);
      const pan = (v) => { if (!ctx.createStereoPanner) return echoRet; const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(echoRet); return p; };
      ehp.connect(pan(-0.6)); echoR.connect(pan(0.6)); echoRet.connect(toneLP); echoRet.connect(gainN(0.2, revSend));
      for (const c of CHN) { CH[c] = ctx.createGain(); CH[c].connect(c === 'drums' ? mIn : scG); AN[c] = ctx.createAnalyser(); AN[c].fftSize = 256; CH[c].connect(AN[c]); }
      const lay = (v, ch) => gainN(v, CH[ch]);
      L = { pad: lay(0.055, 'pads'), bass: lay(0.32, 'bass'), keys: lay(0.085, 'keys'), arp: lay(0.06, 'arp'), spark: lay(0.045, 'lead'), lead: lay(0.06, 'lead'), drums: lay(0.24, 'drums') };
      // vinyl: crackle impulses + hiss
      const len = ctx.sampleRate * 3, vb = ctx.createBuffer(1, len, ctx.sampleRate), d = vb.getChannelData(0);
      for (let i = 0; i < len; i++) { d[i] = 0; if (Math.random() < 0.0004) d[i] = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.6); }
      const cr = ctx.createBufferSource(); cr.buffer = vb; cr.loop = true; vinylG = gainN(0); cr.connect(lp(2500, 0.5, vinylG, 'highpass')); vinylG.connect(toneLP); cr.start();
      const hs = ctx.createBufferSource(); hs.buffer = noiseBuf; hs.loop = true; hissG = gainN(0); hs.connect(lp(5000, 0.4, hissG, 'bandpass')); hissG.connect(toneLP); hs.start();
    }
    const ROOMS = [[2, 0.28], [3.2, 0.25], [5.2, 0.18]], room = []; let roomNow = -1;
    const roomFor = sz => sz <= 2.3 ? 0 : sz <= 3.8 ? 1 : 2;
    function ensureRoom(i) { if (room[i]) return room[i]; const cv = ctx.createConvolver(); cv.buffer = impulse(ROOMS[i][0], ROOMS[i][1]); const g = gainN(0, revRet); cv.connect(g); return (room[i] = { cv, g }); }
    function selectRoom(i, t) {
      if (i === roomNow) return; const r = ensureRoom(i), was = roomNow; roomNow = i;
      try { revHP.connect(r.cv); } catch (e) {} r.g.gain.setTargetAtTime(1, t, 0.4);
      if (was >= 0) { const o = room[was]; o.g.gain.setTargetAtTime(0, t, 0.4); const off = () => { if (roomNow !== was) try { revHP.disconnect(o.cv); } catch (e) {} }; if (offline) off(); else setTimeout(off, 2500); }
    }
    let P_flG = null, sweepLP = null, trimG = null, pauseG = null, toneHS = null, revHP = null, gateCv = null, crushOn = false, gateOn = false;
    function applyGenreMix(newGenre) {
      if (!mIn || !P) return;
      const c = live(), M = P.S.mix, t = ctx.currentTime, k = (x, d, span) => fxK(x, d, span);
      for (const ch of CHN) CH[ch].gain.setTargetAtTime(c.mute && c.mute[ch] ? 0 : (c.mix[ch] === undefined ? 1 : c.mix[ch]), t, 0.05);
      // reverb size per genre: one of three rooms, crossfaded (5.5.7: the old code gave a convolver a new impulse on every song change,
      // the heaviest thing the audio engine does, because it compared against the new piece's own empty key)
      if (newGenre) selectRoom(roomFor(Math.max(0.5, M.revS || 2)), t);
      revRet.gain.setTargetAtTime(k(c.fx.reverb, M.rev, 0.9), t, 0.15);
      const ech = k(c.fx.echo, M.echo, 0.6); echoIn.gain.setTargetAtTime(ech > 0.01 ? 1 : 0, t, 0.1); echoRet.gain.setTargetAtTime(Math.min(1.4, ech), t, 0.1);
      echoFb.gain.setTargetAtTime(Math.min(0.78, (M.fb || 0.35) + (c.fx.echo - 0.5) * 0.35), t, 0.1);
      const dt = Math.min(2.9, P.spb * (M.div || 0.75)); echoL.delayTime.setTargetAtTime(dt, t, 0.05); echoR.delayTime.setTargetAtTime(dt, t, 0.05);
      // tone: the genre's top end, ±2 octaves
      // tone: below 50% the genre's top end closes down to 700 Hz; above 50% it opens fully and a 3.2 kHz shelf adds up to +7 dB of air
      const tx = c.fx.tone; toneLP.frequency.setTargetAtTime(tx <= 0.5 ? 700 * Math.pow(M.tone / 700, tx * 2) : M.tone + (20000 - M.tone) * (tx - 0.5) * 2, t, 0.1);
      toneHS.gain.setTargetAtTime(tx > 0.5 ? (tx - 0.5) * 14 : 0, t, 0.1);
      // tape and vinyl: wow (pitch drift), flutter, 5-bit crush blend, crackle and hiss
      const tape = Math.min(1.4, k(c.fx.tape, M.tape, 0.6)), crk = Math.min(1.4, k(c.fx.tape, M.crackle, 0.5));
      wowG.gain.setTargetAtTime(0.0024 * tape, t, 0.2); P_flG.gain.setTargetAtTime(0.00012 * tape, t, 0.2);
      const wantCrush = tape > 0.75; if (wantCrush !== crushOn) { crushOn = wantCrush; try { if (wantCrush) wowD.connect(crushWS); else wowD.disconnect(crushWS); } catch (e) {} }
      const wantGate = (KITS[P.S.kit] || {}).S && KITS[P.S.kit].S.gated; if (!!wantGate !== gateOn) { gateOn = !!wantGate; try { if (gateOn) gateConv.connect(gateCv); else gateConv.disconnect(gateCv); } catch (e) {} }
      crushMix.gain.setTargetAtTime(Math.max(0, tape - 0.75) * 0.6, t, 0.2); cleanMix.gain.setTargetAtTime(1 - Math.max(0, tape - 0.75) * 0.35, t, 0.2);
      vinylG.gain.setTargetAtTime(crk * 0.28, t, 0.2); hissG.gain.setTargetAtTime(crk * 0.012, t, 0.2);
      trimG.gain.setTargetAtTime(P.boss ? BOSS_THEMES[P.boss].trim || 1 : (GENRES[P.g].trim || 1) * (GENRES[P.g].flavours[P.f].ftrim || 1), t, 0.3);
    }
    // a voice's density from effective energy and the phrase: fires when the step's level >= 10 - density*10
    function density(vk) {
      if (P.comp) { const ph0 = phAt(bar); return ph0.drums === 0 ? 0 : 1; } // 5.5.6: every lit cell plays
      const E = effE(), ph = phAt(bar), base = E * 1.15 - 0.15 + ph.d;
      const bias = { K: 0.2, S: 0.15, C: 0.1, H: 0.05, O: -0.05, R: 0, D: -0.15, P: -0.1 }[vk] || 0;
      return Math.max(0, Math.min(1, base + bias)) * (ph.drums === 0 ? 0 : ph.drums || 1);
    }
    const lvl = (thr) => { if (P.comp) return 0.85; const E = Math.max(0, effE() + phAt(bar).d); return E >= thr ? Math.min(1, 0.55 + (E - thr) * 1.5) : 0; };

    function scheduleStep(t) {
      if (API._fault) { API._fault = 0; throw new Error('test fault'); }
      if (P.skip && s16 === 0) { newPiece(nextSpec()); forceNext = null; return scheduleStep(t); }
      if (s16 === 0 && bar % 8 === 0 && (P.boss || P.v2)) { // 6.3: phrase starts. A boss phase jumps to Final a semitone up; a v2 'key up' phrase lifts the key
        if (P.boss && bossNow === P.boss && bossPhase > P.phSeen && bar > 0) { P.phSeen = bossPhase; P.root += 1; bar = (P.form.length - 1) * 8; }
        if (phAt(bar).lift && !P.lifted) { P.lifted = 1; P.root += P.liftBy || 1; }
      }
      const S = P.S, sp16 = P.spb / 4, phIdx = Math.min(P.form.length - 1, Math.floor(bar / 8)), ph = P.form[phIdx], barInPh = bar % 8, lastBarOfPh = barInPh === 7;
      const ch = chordAt(bar), swingOff = (s16 % 2 === 1) ? (S.swing - 0.5) * 2 * sp16 : 0, hum = () => S.human ? (R() - 0.5) * S.human / 1000 : 0;
      const tt = t + swingOff;
      const E = effE();
      // ---- chord change: pads and sustained keys ----
      if (s16 === 0 && ch.first) {
        const v = voice(ch.deg, ch.q), bars = P.loop.bars, len = bars * 16 * sp16;
        P.cur = { deg: ch.deg, q: ch.q, v, root: chordRoot(ch.deg) };
        if (S.pad && ph.pad && lvl(S.pad.lv || 0) > 0) pad(v, t, len, 0.9 * (ph.brk ? 1.25 : 1), S.pad.kind);
        if (S.keys && S.keys.rhythm === 'gate' && ph.keys && lvl(S.keys.lv || 0) > 0) gateChord(v, t, sp16, bars, lvl(S.keys.lv || 0));
      }
      const C0 = P.cur; if (!C0) { s16++; return; }
      const bassRoot = (() => { let r = C0.root; while (r > 47) r -= 12; while (r < 33) r += 12; return r; })();
      // ---- drums (Grids-style maps) ----
      const fillBar = lastBarOfPh && !ph.build;
      // 6.3 phrase options (v2 and boss themes): dr swaps drum rows, half plays the maps at half speed, hop stops the band for the
      // last beat of every second bar
      const drMap = ph.dr ? Object.assign({}, S.drums, ph.dr) : S.drums, hop = ph.hop && bar % 2 === 1 && s16 >= 12;
      const st16 = ph.half ? (s16 % 2 ? -1 : s16 / 2 + (bar % 2) * 8) : s16, bar2 = ph.half ? Math.floor(bar / 2) : bar;
      if ((ph.drums !== 0 || ph.build) && st16 >= 0 && !hop) for (const vk in drMap) {
        const m = drMap[vk]; if (!m) continue;
        const ch0 = m.length === 32 ? m[(bar2 % 2) * 16 + st16] : m[st16], lv0 = ch0 === undefined ? 0 : +ch0; if (!lv0) continue;
        if (ph.drums === 0 && vk !== 'H' && vk !== 'P') continue;
        if (P.dropouts && P.dropouts[vk]) continue;
        const dn = density(vk); if (lv0 < 10 - dn * 10) continue;
        if (fillBar && S.fill === 'kickdrop' && vk === 'K' && s16 >= 8) continue;
        if (fillBar && S.fill === 'drop' && vk === 'K' && s16 >= 8 && E < 0.7) continue;
        if (S.halftime && vk === 'S' && s16 === 4) continue;
        const vel = (lv0 >= 8 ? 1 : lv0 >= 6 ? 0.82 : lv0 >= 4 ? 0.62 : 0.38) * (0.92 + R() * 0.16);
        const late = vk === 'S' && S.human ? S.human * 0.0008 : vk === 'H' && S.human && s16 % 2 ? -0.003 : 0;
        drumHit(vk, tt + late + (vk === 'K' ? 0 : hum()), vel);
      }
      if (S.halftime && s16 === 8 && density('S') > 0.3 && ph.drums !== 0) drumHit('S', tt, 0.95);
      // fills and builds
      if (lastBarOfPh && E > 0.3) {
        if (S.fill === 'toms' && s16 >= 12 && ph.drums !== 0) drumTom(tt, s16);
        if (S.fill === 'chip' && s16 >= 12 && s16 % 1 === 0) drumHit('S', tt, 0.5 + (s16 - 12) * 0.12);
        if (S.fill === 'flam' && s16 >= 13) drumHit('S', tt, 0.4 + (s16 - 13) * 0.15);
        if ((S.fill === 'snare' || S.fill === 'clap') && s16 >= 12 && ph.drums !== 0) drumHit(S.fill === 'snare' ? 'S' : 'C', tt, 0.35 + (s16 - 12) * 0.15); // 6.3 v2 fills
      }
      if (ph.build && barInPh >= 4) { // snare roll: quarters -> 8ths -> 16ths over the last four bars, then silence on the last beat
        const b = barInPh - 4, every = b < 1 ? 4 : b < 2 ? 2 : 1;
        if (!(barInPh === 7 && s16 >= 12) && s16 % every === 0) drumHit(S.kit === 'chip' ? 'S' : 'S', tt, 0.3 + (b * 16 + s16) / 64 * 0.7);
        if (barInPh === 4 && s16 === 0) riser(t, sp16 * 16 * 4, 0.9);
      }
      if (ph.drop && barInPh === 0 && s16 === 0) { crash(t, 1); }
      if (barInPh === 0 && s16 === 0 && phIdx > 0 && (S.form === 'dance' || S.form === 'trance' || S.form === 'dnb') && E > 0.45 && !ph.drop) crash(t, 0.6);
      // ---- long filter sweeps on everything but the drums (filter house, Detroit, progressive) ----
      if (sweepLP && s16 === 0 && barInPh === 0) {
        const T0 = ctx.currentTime > t ? ctx.currentTime : t, len8 = sp16 * 16 * 8, f = sweepLP.frequency; f.cancelScheduledValues(T0);
        if (ph.under) { f.setValueAtTime(20000, T0); f.exponentialRampToValueAtTime(600, T0 + sp16 * 8); } // 6.3: the burrow / the nap: everything but the drums goes muffled
        else if (!S.filterLoop) f.setValueAtTime(20000, T0);
        else if (phIdx === 0) { f.setValueAtTime(260, T0); f.exponentialRampToValueAtTime(2800, T0 + len8); }
        else if (phIdx === 1) { f.setValueAtTime(2800, T0); f.exponentialRampToValueAtTime(18000, T0 + len8); }
        else if (ph.brk) { f.setValueAtTime(18000, T0); f.exponentialRampToValueAtTime(500, T0 + len8 * 0.5); f.exponentialRampToValueAtTime(6000, T0 + len8); }
        else f.setValueAtTime(18000, T0);
      }
      // ---- bass ----
      const bassOn = S.bass && (ph.bass === undefined || ph.bass) && lvl(S.bass.lv || 0) > 0 && !(P.dropouts && P.dropouts.bass) && !(S.form === 'dnb' && lastBarOfPh && s16 >= 8) && !hop;
      if (bassOn) {
        const pat = P.bassPat, st = (S.bass.line === 'reese' || S.bass.len32 ? (bar % 2) * 16 : 0) + s16;
        for (let i = 0; i < pat.length; i++) { const b = pat[i]; if (b.st !== st) continue;
          let n = bassRoot + b.iv;
          if (b.approach) { const nx = chordAt(bar + 1); n = (() => { let r2 = chordRoot(nx.deg); while (r2 > 47) r2 -= 12; while (r2 < 33) r2 += 12; return r2; })() + b.iv; }
          const nxt = pat[i + 1]; bassNote(tt + hum(), n, b.len * sp16, 0.95 * (b.acc ? 1 : 0.85), S.bass.kind, { acc: b.acc, slide: b.slide, next: nxt ? bassRoot + nxt.iv : null });
        }
      }
      // ---- keys ----
      const K = S.keys;
      if (K && K.rhythm !== 'gate' && (ph.keys === undefined || ph.keys) && lvl(K.lv || 0) > 0 && !(P.dropouts && P.dropouts.keys) && !hop) {
        const kl = lvl(K.lv || 0) * (ph.keys === 0.5 ? 0.6 : 1);
        if (K.rhythm === 'arp') { if (s16 % 1 === 0) { const ns = C0.v.slice(0, 3); for (let h = 0; h < 2; h++) chipNote(ns[(s16 * 2 + h) % ns.length] + 12, tt + h * sp16 / 2, sp16 * 0.45, 0.5 * kl, 0.125, L.keys, 'keys'); } }
        else if (P.keysPat.includes(s16)) {
          const kind = K.kind;
          if (kind === 'rhodes') { const ant = K.rhythm === 'lofi' && s16 === 0; for (const n of C0.v) rhodes(n, tt + R() * 0.018 + (ant ? -0.012 : 0), kl * (s16 === 0 ? 0.85 : 0.55) * (0.85 + R() * 0.3), P.g === 'lofi' ? 1.6 : 2.2); }
          else if (kind === 'piano') { if (K.rhythm === 'broken') { const order = [C0.root, ...C0.v]; piano(order[(s16 / 4) % order.length] + 12, tt, 0.8, 2.6); } else for (const n of C0.v) piano(n, tt + R() * 0.01, kl * 0.7, K.rhythm === 'offbeat' ? 0.5 : 1.4); }
          else if (kind === 'stab') stab(C0.v, tt, 0.55 * kl, K.how || K.rhythm);
          else if (kind === 'organ') organ(C0.v, tt, 0.6 * kl, sp16 * (K.dur || 1.5));
          else if (kind === 'power') { const i = P.keysPat.indexOf(s16), nx = i + 1 < P.keysPat.length ? P.keysPat[i + 1] : P.keysPat[0] + 16; power(C0.root, tt, 0.6 * kl, (nx - s16) * sp16); }
          else if (kind === 'skank') skank(C0.v, tt, 0.6 * kl);
          else if (kind === 'pluck') pluck(C0.v[(s16 / 2) % C0.v.length] + 12, tt, 0.5 * kl, L.keys, 'keys');
        }
      }
      // ---- arp ----
      const A0 = S.arp;
      if (A0 && (ph.arp === undefined || ph.arp) && lvl(A0.lv) > 0 && !hop) {
        const every = 16 / (P.arpRate || A0.rate);
        if (s16 % every === 0) { const ns = []; for (let o = 0; o < (A0.oct || 1); o++) for (const n of C0.v) ns.push(n + 12 * o); const k = (s16 / every + bar * 3) % (ns.length * 2 - 2); let idx = k < ns.length ? k : ns.length * 2 - 2 - k;
          if (P.v2 && P.arpShape !== 'updown') { const j = s16 / every + bar * 4, Ln = ns.length; idx = P.arpShape === 'up' ? j % Ln : P.arpShape === 'down' ? Ln - 1 - j % Ln : P.arpShape === 'pinky' ? (j % 2 ? 1 + (j >> 1) % (Ln - 1) : 0) : (j * 2) % Ln + (Ln % 2 ? 0 : (Math.floor(j * 2 / Ln) % 2)); idx = Math.min(Ln - 1, idx); } // 6.3 v2 arp shapes
          if (A0.kind === 'glass') lead(ns[idx] + 12, tt, 1.2, 0.5 * lvl(A0.lv), 'glass'); else pluck(ns[idx] + (A0.kind === 'juno' ? 0 : 12), tt, 0.55 * lvl(A0.lv)); }
      }
      // ---- lead (motif-based phrases) ----
      const Ld = S.lead, ll = Ld ? lvl(Ld.lv) * (ph.lead === 0.5 ? (barInPh >= 4 ? 1 : 0) : ph.lead) : 0;
      if (P.boss) bossLead(tt, ph, barInPh, ll); // 6.3: the theme's own hook, exact notes
      else if (Ld && ll > 0 && !(P.dropouts && P.dropouts.lead)) {
        let mot = (ph.motif || (barInPh >= 6 && phIdx % 2 === 1)) ? P.motifs[1] : P.motifs[0], up = 0; const st = (barInPh % 2) * 16 + s16;
        if (P.v2 && mot === P.motifs[0]) { // 6.3 v2: verses play only the call (space for the answer later), drops and hooks go up an octave in their second half
          if (ph.d <= 0 && !ph.drop && /Verse|Intro|Riddim|Drift|Groove/.test(ph.n) && barInPh % 2 === 1 && barInPh !== 7) mot = [];
          if ((ph.drop || /Hook|Drop/.test(ph.n)) && barInPh >= 4 && barInPh < 6 && Ld.oct <= 74) up = 12;
        }
        const tail = barInPh % 4 === 3 && barInPh !== 7 ? 1 : 0;
        for (const nn of mot) if (nn.st === st) {
          if (tail && s16 >= 8 && !P.fixedMel && !P.v2 && chance(0.5)) continue;
          const abs = P.fixedMel && P.comp && P.comp.melAbs; // 5.5.8 'Fixed notes': degrees of the key, not of each chord
          const scaleTones = abs ? P.scale : Ld.scale === 'pent' ? (P.scale[2] === 3 ? PENT.minor : PENT.major) : Ld.scale === 'pentmajor' ? (P.scale[2] === 3 ? PENT.minor : PENT.major) : P.scale;
          const strong = s16 % 4 === 0, off = abs ? 0 : scaleTones.length === 5 ? Math.round(C0.deg * 5 / 7) : C0.deg;
          let n = degTo(P.root + 12 * Math.round((Ld.oct - P.root) / 12), off + nn.d, scaleTones);
          if (!P.fixedMel) { if (strong) n = nearestChordTone(n, C0); if (barInPh === 7 && s16 >= 8) n = nearestPc(n, C0.root % 12); if (Ld.grammar === 'drone' && !strong) continue; }
          lead(n + up, tt + hum(), Math.max(sp16, nn.len * sp16), (Ld.kind === 'chip' ? 0.6 : 0.85) * ll, Ld.kind, Ld.duty);
        }
      }
      // ---- ambient: incommensurable bell loops (Music for Airports) ----
      if (S.form === 'flow' && s16 % 4 === 0) { const sec = t; for (const lp0 of AMB_LOOPS) { if (sec - (lp0.last || -99) >= lp0.per) { lp0.last = sec; lead(degTo(P.root + 24, lp0.d, P.scale[2] === 3 ? PENT.minor : PENT.major), t, 4, 0.35 + effE() * 0.3, 'bell'); } } }
      // ---- dub: siren and drop-outs ----
      if (S.form === 'dub' && s16 === 0) {
        P.dropouts = ph.dropouts && chance(0.3) ? { [pick(['K', 'H', 'keys', 'lead', 'bass'])]: 1 } : null;
        if (ph.version && barInPh === 0) P.dropouts = { keys: 1, lead: 1 };
        if (barInPh === 7 && E > 0.35 && chance(0.4)) siren(t + sp16 * 8, 0.8);
      }
      s16++;
      if (s16 >= 16) {
        s16 = 0; bar++;
        if (bar % 8 === 0 && bar < 32 && !P.fixedMel && chance(0.6)) P.motifs[0] = P.v2 ? varyHook(P.motifs[0]) : varyMotif(P.motifs[0]); // (32: the first four phrases vary exactly as before)
        if (bar >= pieceBars()) { if (P.boss && bossNow === P.boss) bar = 8; else { newPiece(nextSpec()); forceNext = null; } } // a boss theme loops from Hook while its boss lives
      }
    }
    // 6.3: a boss theme's lead. Slot = 2 bars; L picks the motif; 'up' doubles an octave higher in Final; the Auditor rings a desk bell
    function bossLead(tt, ph, barInPh, ll) {
      const th = BOSS_THEMES[P.boss], Ld = P.S.lead, base = P.root + 12 * Math.round((Ld.oct - th.root) / 12), st = (barInPh % 2) * 16 + s16, sp16 = P.spb / 4;
      if (th.ding && barInPh === 7 && s16 === 12 && ph.drums !== 0) lead(base + 24, tt, 1.2, 0.6, 'bell');
      if (ll <= 0 || !ph.L) return; const mi = ph.L[Math.floor(barInPh / 2)], mot = mi >= 0 ? P.motifs[mi] : null; if (!mot) return;
      for (const nn of mot) if (nn.st === st) {
        const kind = nn.k === 'm' && Ld.k2 ? Ld.k2 : Ld.kind, v = 0.85 * Math.max(0.6, ll);
        lead(base + nn.d, tt, Math.max(sp16, nn.len * sp16), v, kind);
        if (ph.up && barInPh >= 4 && Ld.oct <= 70) lead(base + nn.d + 12, tt, Math.max(sp16, nn.len * sp16), v * 0.55, kind);
      }
    }
    // 6.3: a power chord (root, fifth, octave) on driven saws, held until the next hit
    function power(r, t, v, dur) {
      while (r > 52) r -= 12; while (r < 40) r += 12; evlog('keys', 'power', t, r, v);
      const g = vca(t, 0.005, dur, v * 0.5, L.keys), fl = lp(2400, 0.7, g), sh = ctx.createWaveShaper(); sh.curve = driveCurve(); sh.connect(fl); const pre = gainN(1.6, sh), end = t + dur + 0.3;
      for (const x of [0, 7, 12]) { osc('sawtooth', mtof(r + x), t, end, pre, -6); osc('sawtooth', mtof(r + x), t, end, pre, 6); }
      g.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.04); sendFx(g, 0.2, 0.05);
    }
    const AMB_LOOPS = [{ per: 19.7, d: 0 }, { per: 23.5, d: 2 }, { per: 25.9, d: 4 }, { per: 29.9, d: 7 }, { per: 31.3, d: 9 }];
    function drumTom(t, s) { tom(t, 0.8, [196, 165, 131, 98][s - 12] || 110); }
    function degTo(base, d, scale) { const n = scale.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return base + scale[i] + 12 * o; }
    function nearestChordTone(n, C0) { let best = n, bd = 99; for (const v of C0.v.concat([C0.root])) for (let o = -24; o <= 24; o += 12) { const x = v + o, d = Math.abs(x - n); if (d < bd) { bd = d; best = x; } } return best; }
    function nearestPc(n, pc) { let best = n, bd = 99; for (let x = n - 6; x <= n + 6; x++) if ((x % 12 + 12) % 12 === pc && Math.abs(x - n) < bd) { bd = Math.abs(x - n); best = x; } return best; }
    function varyMotif(m) { const c = m.map(x => ({ ...x })); const i = Math.floor(R() * c.length); if (chance(0.5)) c[i].d += pick([-1, 1]); else if (c.length > 2) c.splice(i, 1); if (chance(0.3)) for (const x of c) if (x.st >= 24) x.st = x.st; return c; }
    function liveSpb() { const c = live(), want = Math.max(40, P.bpm * (1 + (battle - 0.4) * 0.06 * c.follow)); tempoNow = tempoNow ? tempoNow + (want - tempoNow) * 0.02 : want; P.spb = 60 / tempoNow; return P.spb; }
    function schedule(horizon) {
      if (!ctx || !P) return;
      battle += (targetB - battle) * 0.04;
      if (nextT < ctx.currentTime - 0.4) nextT = ctx.currentTime + 0.05;
      if (paused || held) return;
      const until = (horizon !== undefined ? horizon : ctx.currentTime + 0.3);
      while (nextT < until) { const t = nextT; try { scheduleStep(t); } catch (e) { noteErr(e, 'step ' + (P ? P.g + '/' + P.f : '')); try { forceNext = null; newPiece(null); } catch (e2) { noteErr(e2, 'recover'); nextT += 1; } } nextT += liveSpb() / 4; }
    }
    // ---------------- v5.5 composer: a piece whose parts are chosen instead of rolled ----------------
    // A comp is plain data (it travels in saved tracks and share codes): genre + flavour (the sound kit and arrangement), mode,
    // key (pitch class), chord loop, 16-step drum rows, bass and lead style, a melody (16 steps of scale steps above the chord
    // root, so it follows the chords) or a melody seed for an automatic one, and a tempo.
    const MOODS = [['ionian', 'Bright'], ['lydian', 'Dreamy'], ['mixolydian', 'Bluesy'], ['dorian', 'Soulful'], ['aeolian', 'Moody'], ['phrygian', 'Dark'], ['harmonic', 'Exotic']];
    const BASSES = [['sub', 'long', 'Sub'], ['upright', 'lofi', 'Upright'], ['dub', 'dubby', 'Dub'], ['sawoct', 'octave', 'Octaves'], ['sub', 'deep', 'Deep'], ['sawoct', 'disco', 'Disco'],
      ['organ', 'organ', 'Organ'], ['sub', 'rumble', 'Rumble'], ['acid', 'acid', 'Acid 303'], ['saw', 'rolling', 'Rolling'], ['saw', 'offbeat', 'Offbeat'], ['sub', 'twostep', 'Two-step'],
      ['reese', 'reese', 'Reese'], ['tri', 'chip', 'Chip'], ['dub', 'dub', 'Dub roots'],
      ['upright', 'walk', 'Walking'], ['sawoct', 'gallop', 'Gallop'], ['wobble', 'reese', 'Wobble'], ['acid', 'rolling', 'Psy'], ['tri', 'dub', 'Chip dub']]; // 6.3: the new styles' basses
    const LEADS = [['none', 'None'], ['bell', 'Bell', 'sparse'], ['flute', 'Flute', 'sparse'], ['piano', 'Piano', 'riff'], ['theremin', 'Theremin', 'long'], ['saw', 'Saw', 'anthem'],
      ['supersaw', 'Supersaw', 'trance'], ['bleep', 'Bleep', 'bleep'], ['chip', 'Chip', 'chip'], ['melodica', 'Melodica', 'call'], ['glass', 'Glass', 'sparse'], ['pulse', 'Pulse', 'riff'], ['brass', 'Brass', 'anthem']]; // 6.3: Pulse, Brass
    const DRUM_ROWS = [['K', 'Kick', 9], ['S', 'Snare', 9], ['C', 'Clap', 8], ['H', 'Hat', 6], ['O', 'Open hat', 7], ['R', 'Rim', 6], ['P', 'Shaker', 4], ['D', 'Ride', 5]];
    function drumsFor(g, f) { const d = recipe(g, f).drums, o = {}; for (const [k] of DRUM_ROWS) o[k] = (d[k] || '').slice(0, 16).padEnd(16, '0'); return o; }
    // each loop with the modes its flavours were written for (a loop that forces chord types, like Rainy Day's i-VI-V7, belongs to those moods)
    function loopsFor(g) { const by = new Map(); for (const F of Object.values(GENRES[g].flavours)) for (const L0 of F.loops || []) { const k = JSON.stringify(L0); if (!by.has(k)) by.set(k, Object.assign({}, L0, { modes: [] })); for (const m of F.modes || []) if (!by.get(k).modes.includes(m)) by.get(k).modes.push(m); } return [...by.values()]; }
    function numerals(degs, mode, q) { // roman numerals as a musician writes them: case for major/minor, ° and +, and the chord type
      const sc = MODES[mode] || MODES.aeolian, R0 = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'], FLAT = { 1: [1, 2], 2: [3, 4], 5: [8, 9], 6: [10, 11] };
      const SUF = { M: '', m: '', '7': '7', M7: 'maj7', m7: '7', m9: '9', '6': '6', m6: '6', mM7: '(maj7)', s2: 'sus2', s4: 'sus4' };
      return degs.map((d, i) => { const dd = ((d % 7) + 7) % 7, qq = q && q[i], tq = triadQ(mode, d);
        const minor = qq ? /^m/.test(qq) && !/^M/.test(qq) : tq === 'm' || tq === 'dim';
        const fl = FLAT[dd] && sc[dd] === FLAT[dd][0] ? '♭' : dd === 3 && sc[3] === 6 ? '♯' : ''; // against the major scale: ♭II ♭III ♭VI ♭VII, Lydian's ♯IV
        let r = fl + (minor ? R0[dd].toLowerCase() : R0[dd]);
        if (!qq && tq === 'dim') r += '°'; if (!qq && tq === 'aug') r += '+'; if (qq) r += SUF[qq] || ''; return r; }).join(' · ');
    }
    function melMotif(mel) { // 16 steps (null or a scale step) into the engine's 2-bar motif; each note lasts until the next
      const on = []; for (let i = 0; i < 16; i++) if (mel[i] !== null && mel[i] !== undefined) on.push(i);
      const out = []; for (let h = 0; h < 2; h++) on.forEach((st, j) => { const nx = j + 1 < on.length ? on[j + 1] : on[0] + 16; out.push({ st: st + 16 * h, d: +mel[st], len: Math.min(4, Math.max(1, nx - st)) }); });
      return out.length ? out : [{ st: 0, d: 0, len: 4 }];
    }
    function applyComp(p, cp) {
      const S = Object.assign({}, p.S); p.S = S; p.comp = JSON.parse(JSON.stringify(cp));
      if (MODES[cp.mode]) { p.mode = cp.mode; p.scale = MODES[cp.mode]; }
      if (cp.key !== undefined && cp.key !== null && cp.key >= 0) p.root = S.keyR[0] + ((((cp.key | 0) - S.keyR[0]) % 12) + 12) % 12;
      if (cp.loop && Array.isArray(cp.loop.degs) && cp.loop.degs.length) p.loop = { degs: cp.loop.degs.slice(0, 8).map(x => x | 0), q: (cp.loop.q || []).slice(0, 8), bars: Math.max(1, Math.min(8, cp.loop.bars | 0 || 1)) };
      if (cp.drums) { S.drums = {}; for (const k in cp.drums) if (/^[KSCHORDP]$/.test(k) && typeof cp.drums[k] === 'string') S.drums[k] = cp.drums[k].replace(/[^0-9]/g, '0').slice(0, 32); S.halftime = 0; S.fill = 'none'; }
      S.filterLoop = 0; // no slow filter sweep hiding the first phrase
      const on = (n, d) => ({ n, d, drums: 1, bass: 1, keys: 1, lead: 1, pad: 1, arp: 1 }); p.dropouts = null; // what you write is what you hear
      p.form = editing ? [on('Your loop', 0), on('Your loop', 0), on('Your loop', 0), on('Your loop', 0)] : makeForm(S.form).map(ph => Object.assign({}, ph, { dropouts: 0, version: 0 })); // played back: shaped like the genre
      const r0 = R; R = mulberry32((cp.melSeed >>> 0) || 7); // the automatic melody and bassline come from the comp's own seed
      if (Array.isArray(cp.bass) && cp.bass[0]) S.bass = Object.assign({ lv: 0.1 }, S.bass || {}, { kind: cp.bass[0], line: cp.bass[1] });
      p.bassPat = makeBass(S.bass);
      const LD = LEADS.find(x => x[0] === cp.lead);
      if (cp.lead === 'none') S.lead = null;
      else if (LD) S.lead = Object.assign({ scale: 'mode', oct: 74 }, S.lead || {}, { kind: LD[0], grammar: LD[2], lv: Math.min((S.lead && S.lead.lv) || 0.3, 0.25), duty: LD[0] === 'chip' ? 0.25 : (S.lead && S.lead.duty) });
      else if (S.lead) S.lead = Object.assign({}, S.lead, { lv: Math.min(S.lead.lv, 0.25) });
      const mel = Array.isArray(cp.mel) ? cp.mel : null, any = mel && mel.some(x => x !== null && x !== undefined);
      p.fixedMel = 0; if (S.lead) { if (any) { const m = melMotif(mel); p.motifs = [m, m]; p.fixedMel = 1; } else if (mel) { p.motifs = [[], []]; p.fixedMel = 1; } else p.motifs = [makeMotif(S.lead), makeMotif(S.lead)]; }
      R = r0;
    }
    function compFromPiece() {
      if (!P || P.boss) return null;
      const d16 = () => { const o = {}; for (const [k] of DRUM_ROWS) o[k] = (P.S.drums[k] || '').slice(0, 16).padEnd(16, '0'); return o; }; // a v2 piece's own drums
      return { v: 1, genre: P.g, flav: P.f, seed: (Math.random() * 4294967296) >>> 0, name: P.name, mode: P.mode, key: P.root % 12,
        loop: { degs: P.loop.degs.slice(), q: (P.loop.q || []).slice(), bars: P.loop.bars || 1 }, drums: P.comp && P.comp.drums ? Object.assign({}, P.comp.drums) : P.v2 ? d16() : drumsFor(P.g, P.f),
        bass: P.S.bass ? [P.S.bass.kind, P.S.bass.line] : null, lead: P.S.lead ? P.S.lead.kind : 'none', mel: P.comp && P.comp.mel ? P.comp.mel.slice() : null,
        melSeed: (Math.random() * 4294967296) >>> 0, bpm: Math.round(P.bpm) };
    }
    // a saved track remembers the sound it was saved with; playing it brings that sound back
    function snapshot() { const c = live(); return { energy: c.energy, follow: c.follow, mix: Object.assign({}, c.mix), mute: Object.assign({}, c.mute || {}), fx: Object.assign({}, c.fx), bpm: cfg.custom && P ? c.bpm[P.g] : undefined }; }
    function loadSnd(sn, g) {
      if (!cfg.custom) { const D = JSON.parse(JSON.stringify(DEF)); Object.assign(cfg, { genres: D.genres, energy: D.energy, follow: D.follow, mix: D.mix, mute: {}, fx: D.fx }); cfg.custom = true; }
      for (const k of ['energy', 'follow']) if (typeof sn[k] === 'number') cfg[k] = Math.max(0, Math.min(1, sn[k]));
      if (sn.mix) Object.assign(cfg.mix, sn.mix); if (sn.fx) Object.assign(cfg.fx, sn.fx); cfg.mute = Object.assign({}, sn.mute || {});
      if (sn.bpm && g) cfg.bpm[g] = sn.bpm;
      sndGen++;
    }
    let sndGen = 0;
    const sameComp = (a, b) => !a === !b && (!a || JSON.stringify(a) === JSON.stringify(b));
    const isP = f => f.seed === P.seed && sameComp(f.comp, P.comp) && (f.boss || null) === (P.boss || null); // 6.3: a kept boss theme is its own track
    function start() {
      if (running || !ctx) return; running = true;
      if (!mIn) busFor();
      if (!P) newPiece();
      nextT = ctx.currentTime + 0.1;
      if (!offline) timer = setInterval(() => schedule(), 100);
    }
    // 6.3: drop what is already scheduled (fade the music out in sec), then open again after the 0.33 s lookahead
    function fadeTo(t, sec) { if (!pauseG) return; const g = pauseG.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + sec); if (!paused && !held) g.setValueAtTime(1, t + 0.34); }
    function meterOf(an) { if (!an) return 0; const a = new Float32Array(an.fftSize); an.getFloatTimeDomainData(a); let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length); }
    const flavName = (g, f) => GENRES[g] && GENRES[g].flavours[f] ? GENRES[g].flavours[f].name : '';
    const API = {
      start, schedule, GENRES, GENRE_IDS, CHN, DEF, flavName,
      setIntensity(v) { targetB = clamp(v, 0, 1); },
      setScene(s) { scene = s; },
      setMood(m) { mood = m; },
      // 6.3 boss themes. UI.tick reports the boss on the field (or null) and its phase. Edge-triggered: a Skip during the fight stays
      // skipped. The theme starts with a stinger; after a kill (win) a victory sting plays, then the interrupted song comes back at the
      // phrase it was in (a new song if it was nearly over). Off (config.bossThemes false), or while the composer holds the music,
      // nothing changes: the old boss behaviour (minor keys; Trip Hop in the default mix) stays.
      setBoss(id, phase, win) {
        id = id && BOSS_THEMES[id] ? id : null; bossPhase = phase | 0;
        if (id === bossNow) return; const was = bossNow; bossNow = id;
        if (!ctx || !P || !running) return;
        if (id) {
          if (cfg.bossThemes === false || editing || held) return;
          bossRet = P.boss || bar + 16 >= pieceBars() ? null : Object.assign(specOf(), { start: Math.floor(bar / 8) * 8 });
          const t = ctx.currentTime, th = BOSS_THEMES[id]; fadeTo(t, 0.12);
          newPiece({ boss: id }); forceNext = null; nextT = t + 0.36; bossHit(t + 0.36, th);
        } else if (was && P.boss === was) {
          const t = ctx.currentTime, th = BOSS_THEMES[was]; fadeTo(t, 0.06);
          if (win) victory(t + 0.36, th);
          const back = bossRet; bossRet = null; newPiece(back); // null: the next song (or the next kept track with Only my tracks) forceNext = null; nextT = t + 0.36 + (win ? 1.9 : 0);
        }
      },
      get boss() { return bossNow; }, get bossPhase() { return bossPhase; },
      BOSS_THEMES, BOSS_IDS, VX, VX_F,
      setBaseBpm(v) { cfg.calmBpm = clamp(+v || 72, 50, 110); if (P && !cfg.custom) P.bpm = pieceBpm(); },
      get config() { return cfg; },
      setConfig(c) {
        const d = JSON.parse(JSON.stringify(DEF)); c = c || {};
        const D2 = JSON.parse(JSON.stringify(DEF)); cfg = Object.assign(d, c); cfg.bpm = Object.assign(D2.bpm, c.bpm || {}); cfg.mix = Object.assign(D2.mix, c.mix || {}); cfg.fx = Object.assign(D2.fx, c.fx || {});
        // v4.7 configs: old genre ids and FX names map onto the new ones
        const OLD = { chill: 'lofi', synthwave: 'synthwave', techno: 'techno', chiptune: 'chiptune', dub: 'dub' };
        cfg.genres = (cfg.genres || []).map(g => GENRES[g] ? g : OLD[g]).filter((g, i, a) => g && a.indexOf(g) === i); if (!cfg.genres.length) cfg.genres = d.genres.slice();
        if (c.fx && c.fx.warmth !== undefined && c.fx.tone === undefined) cfg.fx.tone = 1 - c.fx.warmth;
        if (c.fx && c.fx.vinyl !== undefined && c.fx.tape === undefined) cfg.fx.tape = c.fx.vinyl;
        if (cfg.bpm.chill && !c.calmBpm) cfg.calmBpm = cfg.bpm.chill;
        for (const k of ['warmth', 'vinyl']) delete cfg.fx[k]; delete cfg.bpm.chill;
        cfg.mute = c.mute || {}; cfg.favs = (c.favs || []).filter(f => f.flav && GENRES[f.genre]);
        applyGenreMix(false); if (P) P.bpm = pieceBpm();
      },
      apply() { applyGenreMix(false); if (P) P.bpm = pieceBpm(); },
      skip(force) { if (!P) return; forceNext = force || null; P.skip = true; },
      // v5.5: Back to the last piece, Repeat, Pause; tracks remember their sound; composed pieces
      back() { if (!P || hist.length < 2) return null; hist.pop(); const prev = hist.pop(); forceNext = prev; P.skip = true; return prev.name; },
      get canBack() { return hist.length >= 2; },
      get repeat() { return rep; }, set repeat(v) { rep = !!v; },
      get paused() { return paused; },
      setPaused(v) { paused = !!v; if (pauseG && ctx) pauseG.gain.setTargetAtTime(paused || held ? 0 : 1, ctx.currentTime, 0.06); },
      get held() { return held; },
      setHold(v) { held = !!v; if (pauseG && ctx) pauseG.gain.setTargetAtTime(paused || held ? 0 : 1, ctx.currentTime, 0.04); if (!held && ctx) nextT = Math.max(nextT, ctx.currentTime + 0.05); },
      // start a piece now instead of at the next bar: fade out what is already scheduled, then begin after the lookahead window
      jump(force) {
        if (!ctx || !P) { forceNext = force || null; return; }
        const t = ctx.currentTime; newPiece(force || null); forceNext = null; nextT = t + 0.34;
        if (pauseG) { const g = pauseG.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.05); if (!paused && !held) g.setValueAtTime(1, t + 0.33); }
      },
      get spec() { return P ? specOf() : null; },
      restart() { if (!P) return; this.jump(Object.assign(specOf(), { start: 0 })); if (hist.length >= 2) hist.splice(hist.length - 2, 1); }, // the same piece from the top, without a second history entry
      get track() { if (!P) return null; const o = specOf(); o.snd = snapshot(); return o; }, // what is playing, as a shareable track
      get queued() { return forceNext; },
      get editing() { return editing; }, set editing(v) { editing = !!v; },
      get sndGen() { return sndGen; },
      setLength(v) { cfg.length = ['short', 'standard', 'long'].includes(v) ? v : 'standard'; if (P) { const keepComp = P.comp || P.boss; P.form = keepComp ? P.form : makeForm(P.S.form, null, P.fv); } }, // the playing piece takes the new shape; past its end it moves on at the next bar
      setName(n) { if (P && n) { P.name = String(n).slice(0, 32); if (hist.length) hist[hist.length - 1].name = P.name; } },
      save(extra) {
        if (!P) return null; if (cfg.favs.some(isP)) return null;
        const f = { seed: P.seed, genre: P.g, flav: P.f, name: (extra && extra.name) || P.name, at: Date.now(), snd: snapshot() }; if (P.comp) f.comp = JSON.parse(JSON.stringify(P.comp));
        if (P.v > 1) f.v = P.v; if (P.boss) f.boss = P.boss;
        cfg.favs.unshift(f); if (cfg.favs.length > 80) cfg.favs.pop(); return f;
      },
      saveComp(cp) { const f = { seed: cp.seed >>> 0, genre: cp.genre, flav: cp.flav, name: cp.name || 'My Track', at: Date.now(), snd: snapshot(), comp: JSON.parse(JSON.stringify(cp)) }; cfg.favs.unshift(f); if (cfg.favs.length > 80) cfg.favs.pop(); return f; },
      unsave() { if (!P) return false; const n = cfg.favs.length; cfg.favs = cfg.favs.filter(f => !isP(f)); return cfg.favs.length < n; },
      isSaved() { return !!(P && cfg.favs.some(isP)); },
      addTrack(f) { if (!f || !GENRES[f.genre] || !GENRES[f.genre].flavours[f.flav]) return null; const t = { seed: f.seed >>> 0, genre: f.genre, flav: f.flav, name: String(f.name || 'Shared Track').slice(0, 32), at: Date.now() }; if (f.snd) t.snd = f.snd; if (f.comp) t.comp = f.comp; if (f.v > 1) t.v = f.v | 0; if (f.boss && BOSS_THEMES[f.boss]) t.boss = f.boss; cfg.favs.unshift(t); if (cfg.favs.length > 80) cfg.favs.pop(); return t; },
      compose(cp) { // play a comp: edits to the piece already playing apply at once; a new genre or flavour starts it at the next bar
        if (!cp || !GENRES[cp.genre] || !GENRES[cp.genre].flavours[cp.flav]) return null;
        if (P && P.comp && P.g === cp.genre && P.f === cp.flav && !P.skip) { applyComp(P, cp); P.seed = cp.seed >>> 0; P.name = cp.name || P.name; P.bpm = pieceBpm(); applyGenreMix(false); return 'live'; }
        const f = { genre: cp.genre, flav: cp.flav, seed: cp.seed >>> 0, name: cp.name, comp: cp, start: editing ? 8 : 0 };
        if (editing) { this.jump(f); return 'now'; } forceNext = f; if (P) P.skip = true; return 'next';
      },
      compFromPiece, drumsFor, loopsFor, numerals, loopOK, triadQ, MODES, MOODS, BASSES, LEADS, DRUM_ROWS, NOTE,
      autoMel() { if (!P || !P.motifs || !P.motifs[0]) return null; const o = Array(16).fill(null); for (const n of P.motifs[0]) if (n.st < 16) { let d = n.d; while (d < 0) d += 7; while (d > 7) d -= 7; o[n.st] = d; } return o; },
      meters() { const o = {}; for (const c of CHN) o[c] = meterOf(AN[c]); return o; },
      spectrum(arr) { if (outAn) outAn.getByteFrequencyData(arr); },
      get energyNow() { return effE(); },
      get battle() { return battle; },
      // tests: log every note event while rendering offline
      set debug(v) { EV = v ? [] : null; }, get events() { return EV; },
      renderAhead(seconds, curve) { start(); const step = 0.1; for (let t = 0; t < seconds; t += step) { if (curve) targetB = curve(t / seconds); battle += (targetB - battle) * 0.3; const h = t + step; while (nextT < h) { const tt = nextT; scheduleStep(tt); nextT += liveSpb() / 4; } } },
      get log() { return pieceLog; },
      get piece() { if (!P) return null; const ph = phAt(bar); return { name: P.name, genre: P.g, genreName: GENRES[P.g].name, flav: P.f, flavName: flavName(P.g, P.f), mode: P.mode, key: NOTE[P.root % 12] + ' ' + MODE_NAME[P.mode], root: P.root, bpm: Math.round(P.bpm), now: Math.round(tempoNow || P.bpm), bar, bars: pieceBars(), step: s16, loop: P.loop.degs.slice(), loopQ: (P.loop.q || []).slice(), seed: P.seed, comp: !!P.comp, saved: cfg.favs.some(isP), energy: +effE().toFixed(2), section: ph.n || 'Groove', length: cfg.length || 'standard', v: P.v || 1,
        boss: P.boss || null, ...(P.boss ? { genreName: 'Boss theme', flavName: BOSS_THEMES[P.boss].name } : {}) }; },
    };
    return API;
  })();

  return { stats: () => ({ played, inFlight, nodes: ctx ? ctx.state : 'none' }), init, play, beams, flames, proxK: (x, y) => { const P = prox({ x, y }); return P ? P.k : 1; }, danger, offlineCtx, setLocator(f) { locate = f; }, setT(t) { tBase = t; }, setVolumes, setTrack, setSoundtrack, music: Music, setMono(v) { mono = !!v; applyMono(); }, get mono() { return mono; }, wake, get state() { return ctx ? ctx.state : 'none'; }, get lastError() { return lastErr; }, get errors() { return errN; }, report: noteErr, _test: { get ctx() { return ctx; }, fault() { Music._fault = 1; } }, get ready() { return !!ctx; } };
})();

// ---------- v4.7 haptics: a buzz when the core takes a hit ----------
// Android and other browsers with the Vibration API get real patterns. iOS Safari has no vibration API; on iOS 17.4 to 26.4 a
// hidden <input switch> toggled by its label plays the system haptic tick (Apple closed this in 26.5), so that is best effort.
const Haptics = (() => {
  let lbl = null, last = 0;
  const on = () => !(typeof PROF !== 'undefined' && PROF.settings && PROF.settings.haptics === false);
  function sw() {
    if (lbl) return lbl;
    lbl = document.createElement('label'); lbl.setAttribute('aria-hidden', 'true');
    lbl.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none';
    const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; lbl.appendChild(i); document.body.appendChild(lbl); return lbl;
  }
  function buzz(pat, ticks, force) {
    if (!force && !on()) return; const now = performance.now(); if (now - last < 140) return; last = now;
    try { if (navigator.vibrate) { navigator.vibrate(pat); return; } } catch (e) {}
    try { const l = sw(); l.click(); for (let k = 1; k < ticks; k++) setTimeout(() => l.click(), k * 110); } catch (e) {}
  }
  return { leak: () => buzz(30, 1), big: () => buzz([70, 50, 110], 3), tap: f => buzz(15, 1, f), get native() { return !!navigator.vibrate; } };
})();
