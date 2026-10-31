// ===================== ENTROPY — SYNTH AUDIO =====================
// Engine modeled on the Elemental Clash SFX kit: osc / fm / noise / kick voices
// routed through reverb, compression and distortion. Everything is synthesized.
const SFX = (() => {
  let ctx = null, master, sfxBus, musBus, limiter, noiseBuf, noiseLo;
  let sfxVol = 0.8, musVol = 0.45;
  const revCache = {};
  const last = {};
  let recent = [];
  const now = () => ctx.currentTime;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // master: a brickwall limiter just under 0 dBFS. The SFX glue compressor (in buildBuses) does the gentle work.
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 1; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.12;
    master = ctx.createGain(); master.gain.value = 0.95;
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol;
    musBus = ctx.createGain(); musBus.gain.value = musVol;
    sfxBus.connect(limiter); limiter.connect(master); master.connect(ctx.destination);
    makeNoise(); buildBuses(); hookMusic();
    // iOS: play one silent buffer inside the unlocking gesture
    try { const sb = ctx.createBufferSource(); sb.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); sb.connect(ctx.destination); sb.start(0); } catch (e) {}
    Music.start();
  }
  // v4.6: one soundtrack, the generative composer (Drift, below). The menu and battle scenes only steer its choices.
  function setTrack(t) { Music.setScene(t === 'game' ? 'game' : 'menu'); }
  function setSoundtrack() {}
  const synthOut = () => musBus;
  // iOS only starts audio inside a user gesture: resume on every tap until it runs
  for (const ev of ['touchend', 'click', 'pointerup', 'keydown']) document.addEventListener(ev, () => { if (ctx && ctx.state === 'suspended') ctx.resume(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!ctx || offline) return; if (document.hidden) ctx.suspend && ctx.suspend(); else ctx.resume && ctx.resume(); });
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
  const TRIM = { ui: 20, deny: 12, rail: -2, pulse: -1, missile: -2, flame: 1, mortar: -3.5, grav: -6, hit: 13, hitcrit: -2, hitshield: 2,
    build: -3, upgrade: 4, reroll: 15, sell: 12, cash: 4, wave: -2, call: 11, milestone: 6, freeze: 2, net: 15, boom: -2, blink: 3, storm: 7, levelup: 2, unbreak: 4,
    converge: 4, crack: 1, stasis: 5, strikecharge: 3, overclock: 12, quack: 5,
    comboSHATTER: -2.5, comboOVERLOAD: -5, 'comboTHERMAL SHOCK': -3, comboSUPERCONDUCT: 3, comboCOLLAPSE: -7 };
  const dB = v => Math.pow(10, v / 20);
  // start a sound: bus, base volume, pitch jitter (semitones), placement and sends
  function ev(name, bus, vol, o, arg) {
    o = o || {};
    const P = place(arg), jit = o.jit === undefined ? 0.6 : o.jit;
    const dens = bus === busW || bus === busH ? density() : 1;
    const c = chain(bus, { vol: vol * dB((TRIM[name] || 0) + (o.trim || 0)) * P.k * dens * rnd(0.9, 1.05), pan: o.pan !== undefined ? o.pan : P.pan, dull: P.dull, room: o.room, hall: o.hall, pitch: (o.pitch || 1) * semi(rnd(-jit, jit)) });
    c.name = name; return c;
  }
  let played = 0;
  function done(c) { played++; trackV(c.name, c); }

  // ---------- the sound set ----------
  const WEAP = {
    // Pulse Blaster: light, bright, high lane. A 25% pulse chirp over a noise snap. Kinetic by default; element flavours below.
    shot(t) {
      const el = t && t.s ? t.s.el : 'K', fast = t && t.spec === 1;
      if (!allow('shot', fast ? 0.045 : 0.06, 6)) return;
      const c = ev('shot', busW, fast ? 0.32 : 0.42, { room: 0.12, jit: 1, trim: ({ K: 5, T: 5, C: 0, A: 0, V: -2 }[el] || 0) + (fast ? 2 : 0) }, t);
      click(c, 0.35, 0, 4500);
      if (el === 'T') { nz(c, { f0: 1600, f1: 500, q: 1.4, d: 0.07, v: 0.4 }); tone(c, { w: 0.25, f0: 520, f1: 180, d: 0.06, v: 0.22, lp: 3000 }); }
      else if (el === 'C') { fmv(c, { f0: 1900, f1: 1300, r: 3.5, i: 1.2, d: 0.07, v: 0.22 }); nz(c, { ft: 'highpass', f0: 6000, d: 0.03, v: 0.2 }); }
      else if (el === 'A') { fmv(c, { f0: 900, f1: 300, r: 7.1, i: 4, d: 0.05, v: 0.22, cw: 'square' }); nz(c, { ft: 'highpass', f0: 7000, d: 0.03, v: 0.3 }); }
      else if (el === 'V') { fmv(c, { f0: 300, f1: 110, r: 0.5, i: 3, d: 0.08, v: 0.32 }); }
      else { tone(c, { w: 0.25, f0: 1250, f1: 380, d: 0.05, v: 0.24, lp: 5200, lp1: 1800 }); nz(c, { f0: 2400, f1: 1200, q: 1.6, d: 0.04, v: 0.3 }); }
      done(c);
    },
    // Rail Lance: the sharpest gun. Crack + FM sweep down + metallic ring + room tail; mid-high lane.
    rail(t) {
      if (!allow('rail', 0.08, 4)) return;
      const c = ev('rail', busW, 0.6, { room: 0.3, jit: 0.5 }, t);
      click(c, 0.6, 0, 5000);
      fmv(c, { f0: 2200, f1: 90, r: 9.03, i: 7, i1: 0.3, d: 0.14, v: 0.32 });
      tone(c, { w: 'sawtooth', f0: 660, f1: 110, d: 0.11, v: 0.16, lp: 4000, lp1: 500 });
      fmv(c, { f0: 1480, r: 2.76, i: 0.8, d: 0.22, v: 0.06, at: 0.01 });
      done(c);
    },
    // Cryo pulse: a glassy bell and a frosty hiss. High and soft (it fires constantly).
    pulse(t) {
      if (!allow('pulse', 0.14, 3)) return;
      const c = ev('pulse', busW, 0.42, { room: 0.35, jit: 1.5 }, t);
      fmv(c, { f0: 2093, r: 3.01, i: 1.4, i1: 0.05, d: 0.28, v: 0.16 });
      fmv(c, { f0: 3136, r: 1.5, i: 0.6, d: 0.2, v: 0.07, at: 0.015 });
      nz(c, { ft: 'highpass', f0: 7000, d: 0.16, v: 0.16, a: 0.01 });
      done(c);
    },
    // Swarm Missile: launch thunk + rising rocket whoosh. Mid lane.
    missile(t) {
      if (!allow('missile', 0.09, 4)) return;
      const c = ev('missile', busW, 0.5, { room: 0.18 }, t);
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
    // Flame Projector: a breathy roar in the low-mid lane (fires in bursts, so it stays short)
    flame(t) {
      if (!allow('flame', 0.16, 2)) return;
      const c = ev('flame', busW, 0.42, { room: 0.1, jit: 1 }, t);
      nz(c, { f0: 600, f1: 380, q: 0.7, d: 0.24, v: 0.45, a: 0.03, curve: 'lin' });
      nz(c, { ft: 'highpass', f0: 3500, d: 0.08, v: 0.12, lofi: 1 });
      done(c);
    },
    // EMP Mortar: a heavy tube thump on launch. Low lane.
    mortar(t) {
      if (!allow('mortar', 0.1, 3)) return;
      const c = ev('mortar', busW, 0.55, { room: 0.25 }, t);
      sub(c, 110, 45, 0.14, 0.55);
      nz(c, { ft: 'lowpass', f0: 1200, f1: 300, d: 0.1, v: 0.35, lofi: 1 });
      click(c, 0.25, 0, 2500);
      done(c);
    },
    // Gravity Well: a sub drop under a down-bending FM moan. Lowest lane.
    grav(t) {
      if (!allow('grav', 0.2, 2)) return;
      const c = ev('grav', busW, 0.55, { hall: 0.25 }, t);
      sub(c, 90, 28, 0.5, 0.5);
      fmv(c, { f0: 220, f1: 55, r: 0.5, i: 3, d: 0.45, v: 0.16, mw: 'triangle' });
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
  const HIT = {
    hit(e) { if (!allow('hit', 0.035, 5)) return; const c = ev('hit', busH, 0.22, { jit: 2 }, e); nz(c, { f0: rnd(1500, 2600), q: 2.2, d: 0.03, v: 0.4 }); done(c); },
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
    unbreak() { const c = ev('unbreak', busE, 0.6, { hall: 0.4, jit: 0, pan: 0 }); arp(c, [60, 64, 67, 72], 0.05, { v: 0.12, d: 0.4, bell: 1 }); done(c); },
    freeze(e) { if (!allow('freeze', 0.12, 2)) return; const c = ev('freeze', busH, 0.4, { room: 0.35 }, e); fmv(c, { f0: 2794, f1: 1397, r: 3.5, i: 2, d: 0.18, v: 0.15 }); nz(c, { ft: 'highpass', f0: 6000, f1: 3000, d: 0.15, v: 0.25 }); done(c); },
    net(e) { if (!allow('net', 0.1, 2)) return; const c = ev('net', busH, 0.4, { room: 0.2 }, e); tone(c, { w: 0.25, f0: 1400, f1: 500, d: 0.1, v: 0.12 }); nz(c, { f0: 2500, f1: 900, q: 3, d: 0.1, v: 0.25 }); done(c); },
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
    stasis() { duck(-5, 0.05, 0.5, 1, true); const c = ev('stasis', busE, 0.7, { hall: 0.55, pan: 0 }); fmv(c, { f0: 880, f1: 2640, r: 2, i: 0.5, d: 0.6, v: 0.14 }); fmv(c, { f0: 4186, f1: 220, r: 3.5, i: 1.2, d: 0.5, v: 0.08 }); nz(c, { ft: 'highpass', f0: 7000, d: 0.5, v: 0.15, a: 0.05 }); done(c); },
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
  function play(name, arg) {
    if (!ctx || (!offline && ctx.state !== 'running') || !busW) return;
    if (WEAP[name]) return WEAP[name](arg);
    if (HIT[name]) return HIT[name](arg);
    if (name === 'die') return die(arg);
    if (name === 'bosswarn') return EVT.boss(arg);
    if (name === 'combo') { const n = typeof arg === 'string' ? arg : arg && arg.n; if (!COMBO[n] || !allow('combo' + n, 0.12, 2)) return; const c = ev('combo' + n, busE, 0.6, { room: 0.3 }, typeof arg === 'object' ? arg : null); COMBO[n](c); done(c); return; }
    if (name === 'ui' || name === 'deny') { if (!allow(name, name === 'ui' ? 0.03 : 0.1)) return; return UIS[name](); }
    if (EVT[name]) return EVT[name](arg);
  }
  // Void Lens: one shared beam hum. Its level follows how many beams are firing; its pitch climbs as they ramp up.
  function beams(n, ramp) {
    if (!ctx || ctx.state !== 'running' || !busW) return;
    if (!beamV) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o1.type = 'sawtooth'; o2.setPeriodicWave(pulseWave(0.25)); o1.frequency.value = 110; o2.frequency.value = 110.6; f.type = 'lowpass'; f.Q.value = 4; f.frequency.value = 600;
      lfo.frequency.value = 7; lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency);
      g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(busW);
      o1.start(); o2.start(); lfo.start(); beamV = { o1, o2, f, g };
    }
    const t = ctx.currentTime, k = Math.min(1, ramp || 0), on = n > 0;
    beamV.g.gain.setTargetAtTime(on ? Math.min(0.09, 0.035 + 0.02 * Math.log2(1 + n)) : 0, t, on ? 0.05 : 0.12);
    const f0 = 98 * semi(k * 12);
    beamV.o1.frequency.setTargetAtTime(f0, t, 0.1); beamV.o2.frequency.setTargetAtTime(f0 * 1.005, t, 0.1);
    beamV.f.frequency.setTargetAtTime(500 + 2200 * k, t, 0.1);
  }
  // low core: a soft double heartbeat whose rate climbs as the hull falls (k = 0 healthy … 1 critical)
  function danger(k, dt) {
    if (!ctx || ctx.state !== 'running' || !busE || k <= 0) { dangerT = 0; return; }
    dangerT -= dt; if (dangerT > 0) return;
    dangerT = 1.1 - 0.5 * k;
    const c = ev('heart', busE, 0.25 + 0.3 * k, { jit: 0, pan: 0 }); sub(c, 70, 45, 0.12, 0.5); sub(c, 62, 40, 0.14, 0.4, 0.2); done(c);
  }
  // offline rendering for tests: play(name) into an OfflineAudioContext at time t
  function offlineCtx(oc) { ctx = oc; offline = true; tBase = 0; buildMasterOffline(); }
  function buildMasterOffline() {
    limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
    master = ctx.createGain(); master.gain.value = 1; sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; musBus = ctx.createGain(); musBus.gain.value = musVol;
    sfxBus.connect(limiter); limiter.connect(master); master.connect(ctx.destination);
    makeNoise(); buildBuses(); hookMusic();
  }
  function makeNoise() {
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // lo-fi noise: sample-and-hold every 6 samples, NES-style grit
    noiseLo = ctx.createBuffer(1, len, ctx.sampleRate); const e = noiseLo.getChannelData(0); let v = 0;
    for (let i = 0; i < len; i++) { if (i % 6 === 0) v = Math.random() * 2 - 1; e[i] = v; }
  }

  // ================= v4.7 DRIFT STUDIO: the generative soundtrack =================
  // A small composer that never stops writing. Default mode is the calm score the game shipped with (Chill, following the
  // battle). Custom mode is the Studio: pick genres, energy, tempo per genre, how much it follows the battle, a six-channel
  // mix and four effects, and save the pieces you like (a piece is fully described by its seed, style, key and mode).
  //  - a PIECE is a genre + style + key + mode + tempo + progression + two motifs, named from its seed ("Velvet Orbit").
  //    32 bars: phrases A, A', B (second motif, thinner drums), A''; then the next piece (horizontal resequencing)
  //  - layers fade in with intensity (vertical layering): pads and bass, keys, hats, drums, melody, arps, sparkles
  //  - chords are stacked thirds (7ths, 9ths) voice-led into E3-D5; melodies snap to chord tones on strong beats
  const Music = (() => {
    let timer = null, nextT = 0, intensity = 0.15, targetI = 0.15, scene = 'menu', mood = 'calm', running = false;
    let mIn = null, mRev = null, revRet = null, echoIn = null, echoD = null, echoFb = null, warmLP = null, vinylG = null, outAn = null, CH = {}, AN = {}, L = {};
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    let R = Math.random;
    const pick = a => a[Math.floor(R() * a.length)], chance = p => R() < p;
    const sstep = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
    const MODES = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10] };
    const MODE_NAME = { ionian: 'major', dorian: 'dorian', aeolian: 'minor', lydian: 'lydian', mixolydian: 'mixolydian', phrygian: 'phrygian' };
    // progressions as scale degrees (0 = I). Each chord lasts the style's `bars`.
    const PROGS = {
      ionian: [[1, 4, 0, 0], [0, 5, 1, 4], [3, 2, 1, 0], [0, 3, 0, 3], [3, 4, 2, 5], [0, 2, 3, 3], [0, 4, 5, 3]],
      dorian: [[0, 3, 0, 3], [0, 6, 3, 0], [0, 4, 3, 0], [0, 0, 6, 6], [0, 2, 3, 6]],
      aeolian: [[0, 5, 2, 6], [0, 3, 6, 2], [5, 6, 0, 0], [0, 5, 3, 4], [0, 6, 5, 6], [0, 0, 5, 6]],
      lydian: [[0, 1, 0, 1], [0, 1, 6, 2], [0, 0, 1, 1]],
      mixolydian: [[0, 6, 3, 0], [0, 3, 6, 0], [0, 0, 6, 3]],
      phrygian: [[0, 1, 0, 1], [0, 6, 1, 0], [0, 0, 1, 6]],
    };
    // genres: their natural tempo and the styles they draw from
    const GENRES = {
      chill: { name: 'Chill', bpm: 72, styles: ['drift', 'nocturne', 'glass', 'lofi', 'tide'], col: '#59f0b4', trim: 1.1, blurb: 'Pads, glass, lo-fi keys, a slow waltz' },
      synthwave: { name: 'Synthwave', bpm: 104, styles: ['neon', 'outrun'], col: '#ff5fa8', trim: 1, blurb: 'Neon arps, gated drums, a driving bass' },
      techno: { name: 'Techno', bpm: 124, styles: ['acid', 'deep'], col: '#6ae2ff', trim: 0.92, blurb: 'Four on the floor, acid lines, dub stabs' },
      chiptune: { name: 'Chiptune', bpm: 132, styles: ['nes', 'arcade'], col: '#ffe14d', trim: 1.5, blurb: 'Pulse waves, triangle bass, noise drums' },
      dub: { name: 'Dub', bpm: 76, styles: ['dub', 'steppers'], col: '#ff9a3c', trim: 0.88, blurb: 'Deep bass, offbeat skank, long echoes' },
    };
    // style recipes. hard: 0 calm .. 1 driving. bpm: offset from the genre tempo. Instrument kinds are dispatched below.
    const STYLES = {
      drift: { name: 'Drift', genre: 'chill', hard: 0, bpm: [-8, -3], bars: 2, modes: ['lydian', 'ionian', 'dorian'], pad: 'warm', bass: 'long', keys: null, arp: 'pluckHi', lead: 'bell', kit: null },
      nocturne: { name: 'Nocturne', genre: 'chill', hard: 0.05, bpm: [-9, -5], bars: 2, meter: 3, modes: ['aeolian', 'dorian', 'ionian'], pad: 'warm', bass: 'long', keys: 'broken', arp: null, lead: 'keys', kit: null },
      glass: { name: 'Glass', genre: 'chill', hard: 0.3, bpm: [-3, 2], bars: 2, modes: ['lydian', 'ionian', 'mixolydian', 'dorian'], pad: 'warm', bass: 'pattern', keys: null, arp: 'pluck', lead: 'bell', kit: null },
      lofi: { name: 'Lofi', genre: 'chill', hard: 0.55, bpm: [0, 6], bars: 1, swing: 0.58, modes: ['dorian', 'ionian', 'aeolian'], pad: 'warm', bass: 'pattern', keys: 'rhodes', arp: null, lead: 'pulse', kit: 'lofi' },
      tide: { name: 'Tide', genre: 'chill', hard: 0.7, bpm: [4, 9], bars: 2, modes: ['aeolian', 'dorian', 'mixolydian'], pad: 'warm', bass: 'pattern', keys: 'rhodes', arp: 'pulse', lead: 'pulse', kit: 'tide' },
      neon: { name: 'Neon', genre: 'synthwave', hard: 0.5, bpm: [-6, 0], bars: 2, modes: ['aeolian', 'dorian'], pad: 'saw', bass: 'octave', keys: null, arp: 'pulse16', lead: 'saw', kit: 'synth' },
      outrun: { name: 'Outrun', genre: 'synthwave', hard: 0.85, bpm: [2, 8], bars: 1, modes: ['aeolian', 'phrygian', 'dorian'], pad: 'saw', bass: 'drive16', keys: 'stab', arp: 'pulse16', lead: 'saw', kit: 'synth16' },
      acid: { name: 'Acid', genre: 'techno', hard: 0.9, bpm: [0, 6], bars: 2, modes: ['aeolian', 'phrygian', 'dorian'], pad: 'dark', bass: 'acid', keys: 'stab', arp: null, lead: 'bleep', kit: 'techno' },
      deep: { name: 'Deep', genre: 'techno', hard: 0.6, bpm: [-6, -1], bars: 2, modes: ['dorian', 'aeolian', 'mixolydian'], pad: 'warm', bass: 'rumble', keys: 'dubstab', arp: null, lead: 'bleep', kit: 'deep' },
      nes: { name: 'Overworld', genre: 'chiptune', hard: 0.75, bpm: [0, 8], bars: 1, modes: ['ionian', 'mixolydian', 'dorian'], pad: 'none', bass: 'chip', keys: 'chiparp', arp: null, lead: 'chip', kit: 'chip' },
      arcade: { name: 'Save Room', genre: 'chiptune', hard: 0.3, bpm: [-34, -24], bars: 2, modes: ['ionian', 'lydian', 'aeolian'], pad: 'chip', bass: 'chipLong', keys: 'chiparp', arp: null, lead: 'chip', kit: 'chipsoft' },
      dub: { name: 'One Drop', genre: 'dub', hard: 0.4, bpm: [-4, 2], bars: 2, swing: 0.55, modes: ['aeolian', 'dorian', 'mixolydian'], pad: 'warm', bass: 'dub', keys: 'skank', arp: null, lead: 'melodica', kit: 'onedrop' },
      steppers: { name: 'Steppers', genre: 'dub', hard: 0.7, bpm: [2, 8], bars: 2, swing: 0.55, modes: ['aeolian', 'dorian'], pad: 'warm', bass: 'dub', keys: 'skank', arp: null, lead: 'melodica', kit: 'steppers' },
    };
    const ADJ = ['Velvet', 'Quiet', 'Neon', 'Distant', 'Slow', 'Golden', 'Hollow', 'Paper', 'Silver', 'Midnight', 'Soft', 'Static', 'Lucid', 'Amber', 'Cobalt', 'Drifting', 'Tidal', 'Glass', 'Faded', 'Electric', 'Patient', 'Low', 'Warm', 'Lost', 'Small', 'Gentle', 'Broken', 'Endless', 'Orbital', 'Sleepy'];
    const NOUN = ['Orbit', 'Harbor', 'Signal', 'Comet', 'Lantern', 'Tide', 'Nebula', 'Circuit', 'Garden', 'Satellite', 'Echo', 'Horizon', 'Engine', 'Reef', 'Window', 'Arcade', 'Moth', 'Wavelength', 'Meadow', 'Relay', 'Aurora', 'Kettle', 'Highway', 'Lighthouse', 'Sunday', 'Pixel', 'Station', 'Current', 'Afterglow', 'Static'];
    // the Studio settings. Default mode ignores everything except the Chill tempo.
    const DEF = { custom: false, genres: ['chill'], energy: 0.35, follow: 1, bpm: { chill: 72, synthwave: 104, techno: 124, chiptune: 132, dub: 76 },
      mix: { pads: 1, keys: 1, arp: 1, bass: 1, drums: 1, lead: 1 }, mute: {}, fx: { reverb: 0.55, echo: 0.35, warmth: 0.5, vinyl: 0.35 }, favs: [], favOnly: false };
    const CHN = ['pads', 'keys', 'arp', 'bass', 'drums', 'lead'];
    let cfg = JSON.parse(JSON.stringify(DEF));
    let P = null, lastStyle = '', lastGenre = '', bar = 0, s16 = 0, voicing = null, root = 50, forceNext = null, favIdx = 0;
    const pieceLog = [];
    const live = () => cfg.custom ? cfg : { ...DEF, bpm: { ...DEF.bpm, chill: cfg.bpm.chill }, mix: DEF.mix, mute: {}, fx: DEF.fx };
    // the intensity the arrangement reads: the battle (scaled by Follow) plus the Energy knob
    const effI = () => { const c = live(); return Math.max(0, Math.min(1, c.follow * intensity + (1 - c.follow) * 0.45 + (c.energy - 0.35) * 0.65)); };

    function chooseGenre() {
      const g = live().genres.filter(x => GENRES[x]); if (!g.length) return 'chill';
      const pool = g.length > 1 ? g.filter(x => x !== lastGenre) : g; return pool[Math.floor(Math.random() * pool.length)];
    }
    function chooseStyle(genre) {
      const ids = GENRES[genre].styles, E = effI(), tgt = Math.max(0, Math.min(1, E * 0.85 + (live().energy - 0.35) * 0.5)), w = {};
      for (const id of ids) w[id] = (id === lastStyle && ids.length > 1 ? 0.05 : 1) * (0.2 + (1 - Math.abs(STYLES[id].hard - tgt)) * 1.3);
      if (scene === 'menu' && genre === 'chill') { w.tide *= 0.1; w.lofi *= 0.6; }
      if (mood === 'boss' && genre === 'chill') { w.drift *= 0.05; w.nocturne *= 0.05; }
      let tot = 0; for (const id in w) tot += w[id]; let r = Math.random() * tot; for (const id in w) { r -= w[id]; if (r <= 0) return id; } return ids[0];
    }
    function newPiece(force) {
      if (!force && cfg.custom && cfg.favOnly && cfg.favs.length) { force = cfg.favs[favIdx % cfg.favs.length]; favIdx++; }
      const style = force && STYLES[force.style] ? force.style : chooseStyle(chooseGenre()), S = STYLES[style], genre = S.genre;
      let mode = force && force.mode ? force.mode : S.modes[Math.floor(Math.random() * S.modes.length)];
      if (!force && mood === 'boss') mode = genre === 'techno' ? ['aeolian', 'phrygian'][Math.floor(Math.random() * 2)] : ['aeolian', 'dorian'][Math.floor(Math.random() * 2)];
      if (force && force.root) root = force.root;
      else if (P) { root += [5, -2, 2, -5, 7, 0, 3, -3][Math.floor(Math.random() * 8)]; while (root > 57) root -= 12; while (root < 46) root += 12; }
      else root = [48, 50, 52, 53, 55, 57][Math.floor(Math.random() * 6)];
      const seed = force && force.seed !== undefined ? force.seed : (Math.random() * 4294967296) >>> 0;
      R = mulberry32(seed); // everything below is reproducible from the seed
      const prog = pick(PROGS[mode] || PROGS.aeolian), bOff = S.bpm[0] + R() * (S.bpm[1] - S.bpm[0]);
      const name = pick(ADJ) + ' ' + pick(NOUN);
      lastStyle = style; lastGenre = genre;
      P = { style, S, genre, mode, prog, bOff, seed, name, meter: S.meter || 4, scale: MODES[mode], motif: makeMotif(S), motifB: makeMotif(S),
        arpPat: pick([[0, 1, 2, 3], [0, 2, 1, 3], [0, 1, 2, 3, 2, 1], [0, 2, 3, 1], [3, 2, 1, 0]]), keysPat: makeKeys(S), drum: makeDrums(S), bassPat: pick([[0], [0, 0.5], [0, 0.75], [0, 0.625]]),
        acid: makeAcid(), dubLine: makeDub(), forced: !!force };
      P.bpm = pieceBpm(); P.spb = 60 / P.bpm; tempoNow = 0;
      if (mIn) mIn.gain.setTargetAtTime(0.62 * (GENRES[genre].trim || 1), ctx.currentTime, 0.5); // loudness matched per genre by offline render (RMS, brightness-weighted)
      if (echoD) echoD.delayTime.setTargetAtTime(Math.min(1.5, P.spb * 0.75), ctx.currentTime, 0.2);
      pieceLog.push({ name, genre, style, mode, root, bpm: Math.round(P.bpm), t: +(nextT || 0).toFixed(1), i: +effI().toFixed(2) });
      if (pieceLog.length > 50) pieceLog.shift();
      bar = 0; s16 = 0;
    }
    const pieceBpm = () => (live().bpm[P.genre] || GENRES[P.genre].bpm) + P.bOff * (GENRES[P.genre].bpm / 72);
    function makeMotif(S) {
      const m = []; let d = pick([0, 2, 4]), dens = S.hard < 0.2 ? 0.28 : S.genre === 'chiptune' ? 0.55 : 0.42;
      for (let i = 0; i < 16; i++) { const strong = i % 4 === 0; if (chance(strong ? dens + 0.2 : dens * 0.7)) { d += pick([-2, -1, -1, 1, 1, 2, 0]); d = Math.max(-2, Math.min(9, d)); m.push({ d, len: pick([1, 1, 2, 2, 3]) }); } else m.push(null); }
      if (m.every(x => !x)) m[0] = { d: 2, len: 2 };
      return m;
    }
    function mutate(m) { const c = m.map(x => x && { ...x }); const i = Math.floor(R() * 16); if (c[i]) { if (chance(0.5)) c[i].d += pick([-1, 1]); else c[i] = null; } else c[i] = { d: pick([0, 2, 4]), len: 1 }; return c; }
    function makeKeys(S) {
      if (S.meter === 3) return [0, 4, 8];
      if (S.keys === 'skank') return [4, 12];
      if (S.keys === 'dubstab') return pick([[6], [14], [6, 14], [10]]);
      if (S.keys === 'stab') return pick([[0], [10], [6, 14], [0, 10]]);
      return pick([[0, 6, 10], [0, 7], [2, 6, 10, 14], [0, 3, 8, 11], [0, 10]]);
    }
    function makeDrums(S) { return { kick: pick([[0, 8], [0, 7, 10], [0, 10], [0, 6, 8]]), hat: pick([[0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14], [0, 2, 3, 4, 6, 8, 10, 11, 12, 14]]) }; }
    // a 303-style line: 16 steps of (note, accent, slide)
    function makeAcid() { const n = [0, 0, 12, 0, 7, 10, 0, 3, 0, 12, 5, 0, -2, 0, 7, 12]; return Array.from({ length: 16 }, (_, i) => chance(i % 4 === 0 ? 0.9 : 0.55) ? { n: pick(n), acc: chance(0.3), slide: chance(0.2) } : null); }
    // a dub bass phrase: scale degrees with rests, one bar, repeated
    function makeDub() { return Array.from({ length: 16 }, (_, i) => i === 0 ? { d: 0, len: 3 } : chance(i % 4 === 0 ? 0.6 : i % 2 === 0 ? 0.35 : 0.1) ? { d: pick([0, 0, 2, 4, 4, 5, 7, -1]), len: pick([1, 2, 2, 3]) } : null); }
    function chordPCs(deg) { const sc = P.scale; return [0, 2, 4, 6, 8].map(k => sc[(deg + k) % 7] + 12 * Math.floor((deg + k) / 7)); }
    function voice(deg) {
      const pcs = chordPCs(deg).slice(1).map(p => root + p), out = [];
      const prev = voicing || [root + 7, root + 12, root + 16];
      for (const p of pcs) { let best = p, bd = 99; for (const o of [-24, -12, 0, 12]) { const n = p + o; if (n < 52 || n > 74) continue; const d = Math.min(...prev.map(q => Math.abs(q - n))); if (d < bd) { bd = d; best = n; } } out.push(best); }
      voicing = [...new Set(out)].sort((a, b) => a - b); return voicing;
    }
    function degToMidi(deg, centre) { const sc = P.scale, o = Math.floor(deg / 7), m = root + sc[((deg % 7) + 7) % 7] + 12 * o; let n = m; while (n < centre - 6) n += 12; while (n > centre + 7) n -= 12; return n; }

    // ---------------- instruments ----------------
    function vca(t, a, d, peak, dest) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); if (d > 0) g.gain.setTargetAtTime(peak * 0.0001, t + a, d / 4); g.connect(dest); return g; }
    function oscN(type, f, t, end, dest, det) { const o = ctx.createOscillator(); if (typeof type === 'number') o.setPeriodicWave(pulseWave(type)); else o.type = type; o.frequency.value = f; o.detune.value = (det || 0) + (R() * 8 - 4); o.connect(dest); o.start(t); o.stop(end); return o; }
    function send(node, amt) { if (!echoIn || amt <= 0) return; const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(echoIn); }
    function pad(notes, t, dur, lv, bright, kind) {
      if (kind === 'none') return;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = kind === 'saw' ? 1.2 : 0.7;
      const top = kind === 'dark' ? 500 + 600 * bright : kind === 'saw' ? 1200 + 2600 * bright : kind === 'chip' ? 3000 : 700 + 1400 * bright;
      f.frequency.setValueAtTime(kind === 'chip' ? 3000 : 350, t); f.frequency.linearRampToValueAtTime(top, t + dur * 0.45); f.frequency.linearRampToValueAtTime(kind === 'chip' ? 2500 : 420, t + dur + 1.5);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lv, t + Math.min(kind === 'chip' ? 0.05 : 2.2, dur * 0.35)); g.gain.setValueAtTime(lv, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur + (kind === 'chip' ? 0.2 : 1.8));
      f.connect(g); g.connect(L.pad);
      for (const n of notes) {
        if (kind === 'chip') { oscN('triangle', mtof(n), t, t + dur + 0.4, f); continue; }
        const det = kind === 'saw' ? 12 : 7;
        oscN('sawtooth', mtof(n), t, t + dur + 2, f, -det); oscN('sawtooth', mtof(n), t, t + dur + 2, f, det); oscN('triangle', mtof(n - 12), t, t + dur + 2, f, 0);
      }
    }
    function bassTone(n, t, dur, lv, kind) {
      if (kind === 'saw') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(900, t); f.frequency.setTargetAtTime(260, t, 0.06); f.connect(vca(t, 0.004, dur, lv * 0.75, L.bass)); oscN('sawtooth', mtof(n), t, t + dur + 0.3, f); oscN('sine', mtof(n), t, t + dur + 0.3, f); return; }
      if (kind === 'tri') { const g = vca(t, 0.003, dur * 0.7, lv * 1.4, L.bass); oscN('triangle', mtof(n), t, t + dur + 0.2, g); return; }
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'dub' ? 260 : 380; f.connect(vca(t, 0.02, dur * 0.9, lv * (kind === 'dub' ? 1.15 : 1), L.bass)); oscN('sine', mtof(n), t, t + dur + 0.4, f); oscN('triangle', mtof(n), t, t + dur + 0.4, f).detune.value = 3;
    }
    function acid303(st, n, t, sp16, lv) { // resonant saw with a snappy filter envelope; accents open it further
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 9 + 5 * live().energy;
      const peak = (st.acc ? 2600 : 1400) * (0.6 + effI() * 0.8);
      f.frequency.setValueAtTime(peak, t); f.frequency.setTargetAtTime(220, t, st.acc ? 0.09 : 0.05);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lv * (st.acc ? 0.7 : 0.45), t + 0.004); g.gain.setTargetAtTime(0.0001, t + sp16 * (st.slide ? 1.9 : 0.8), 0.03);
      f.connect(g); g.connect(L.bass); send(g, 0.15);
      const o = oscN('sawtooth', mtof(n), t, t + sp16 * 2.2, f); if (st.slide) o.frequency.setTargetAtTime(mtof(n + 12), t + sp16 * 0.5, 0.04);
    }
    function keys(n, t, lv, dec) { // FM electric piano
      const g = vca(t, 0.004, dec || 2.2, lv, L.keys), car = ctx.createOscillator(), m1 = ctx.createOscillator(), mg = ctx.createGain(), m2 = ctx.createOscillator(), mg2 = ctx.createGain(), f = mtof(n);
      car.frequency.value = f; car.detune.value = R() * 6 - 3; m1.frequency.value = f; m2.frequency.value = f * 14;
      mg.gain.setValueAtTime(f * 1.6, t); mg.gain.setTargetAtTime(f * 0.25, t, 0.25); mg2.gain.setValueAtTime(f * 0.5, t); mg2.gain.setTargetAtTime(0.01, t, 0.02);
      m1.connect(mg); mg.connect(car.frequency); m2.connect(mg2); mg2.connect(car.frequency); car.connect(g);
      const e = t + (dec || 2.2) + 0.3; for (const o of [car, m1, m2]) { o.start(t); o.stop(e); }
    }
    function stab(notes, t, lv, echo) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(2400 + 1800 * effI(), t); f.frequency.setTargetAtTime(500, t, 0.07); const g = vca(t, 0.003, 0.35, lv, L.keys); f.connect(g); send(g, echo || 0); for (const n of notes) { oscN('sawtooth', mtof(n), t, t + 0.5, f, -6); oscN('sawtooth', mtof(n), t, t + 0.5, f, 6); } }
    function skank(notes, t, lv) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.8; const g = vca(t, 0.002, 0.13, lv, L.keys); f.connect(g); send(g, 0.55); for (const n of notes) { oscN(0.25, mtof(n + 12), t, t + 0.2, f); oscN('triangle', mtof(n), t, t + 0.2, f); } }
    function chipNote(n, t, dur, lv, duty, dest) { const g = ctx.createGain(); g.gain.setValueAtTime(lv, t); g.gain.setValueAtTime(lv * 0.7, t + dur * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur); g.connect(dest); oscN(duty, mtof(n), t, t + dur + 0.02, g); }
    function pluck(n, t, lv) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(3200, t); f.frequency.setTargetAtTime(380, t, 0.09); f.connect(vca(t, 0.003, 0.9, lv, L.arp)); oscN('triangle', mtof(n), t, t + 1, f); oscN('sawtooth', mtof(n), t, t + 1, f, 5); }
    function bell(n, t, lv) { const g = vca(t, 0.003, 3, lv, L.spark), car = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), f = mtof(n); car.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.2, t); mg.gain.setTargetAtTime(f * 0.05, t, 0.5); m.connect(mg); mg.connect(car.frequency); car.connect(g); car.start(t); m.start(t); car.stop(t + 3.4); m.stop(t + 3.4); }
    function lead(n, t, dur, lv, kind) {
      const f = ctx.createBiquadFilter(); f.type = kind === 'melodica' ? 'bandpass' : 'lowpass'; f.frequency.value = kind === 'saw' ? 2600 : kind === 'melodica' ? 1400 : kind === 'chip' ? 6000 : 1900; f.Q.value = kind === 'melodica' ? 0.9 : 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lv, t + (kind === 'chip' ? 0.004 : 0.03)); g.gain.setTargetAtTime(lv * 0.6, t + 0.03, dur * 0.4); g.gain.setTargetAtTime(0.0001, t + dur, kind === 'chip' ? 0.03 : 0.12); f.connect(g); g.connect(L.lead);
      send(g, kind === 'saw' ? 0.35 : kind === 'melodica' ? 0.5 : kind === 'chip' ? 0.12 : 0.2);
      const vibD = kind === 'chip' ? 0.15 : 0.35, vib = (o) => { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = kind === 'chip' ? 6.5 : 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(n) * (kind === 'chip' ? 0.01 : 0.006), t + vibD); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.6); };
      if (kind === 'saw') { vib(oscN('sawtooth', mtof(n), t, t + dur + 0.6, f, -8)); vib(oscN('sawtooth', mtof(n), t, t + dur + 0.6, f, 8)); return; }
      if (kind === 'melodica') { vib(oscN(0.25, mtof(n), t, t + dur + 0.6, f, -5)); oscN('square', mtof(n), t, t + dur + 0.6, f, 5); return; }
      vib(oscN(kind === 'chip' ? 0.25 : 0.25, mtof(n), t, t + dur + 0.6, f));
      if (kind !== 'chip') oscN('sine', mtof(n + 12), t, t + dur + 0.6, (() => { const q = ctx.createGain(); q.gain.value = 0.25; q.connect(f); return q; })());
    }
    function bleep(n, t, lv) { const g = vca(t, 0.002, 0.25, lv, L.lead); send(g, 0.45); oscN('sine', mtof(n), t, t + 0.3, g); oscN(0.125, mtof(n + 12), t, t + 0.12, (() => { const q = ctx.createGain(); q.gain.value = 0.3; q.connect(g); return q; })()); }
    function arpN(n, t, lv) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(900 + 1600 * effI(), t); f.frequency.setTargetAtTime(500, t, 0.08); const g = vca(t, 0.002, 0.35, lv, L.arp); f.connect(g); send(g, 0.2); oscN(0.125, mtof(n), t, t + 0.4, f); }
    function noiseHit(t, ft, fq, q, dur, lv, dest, lofi) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = lofi ? noiseLo : noiseBuf; f.type = ft; f.frequency.value = fq; f.Q.value = q; g.gain.setValueAtTime(lv, t); g.gain.setTargetAtTime(0.0001, t, dur / 4); s.connect(f); f.connect(g); g.connect(dest); s.start(t, R() * 1.5); s.stop(t + dur + 0.05); return g; }
    function kick(t, lv, hard) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(hard ? 150 : 110, t); o.frequency.exponentialRampToValueAtTime(hard ? 46 : 42, t + (hard ? 0.09 : 0.12)); g.gain.setValueAtTime(lv, t); g.gain.setTargetAtTime(0.0001, t, hard ? 0.09 : 0.07); o.connect(g); g.connect(L.drums); o.start(t); o.stop(t + 0.5); if (hard) noiseHit(t, 'highpass', 3000, 0.7, 0.01, lv * 0.25, L.drums); }
    function snare(t, lv, gated) { const g = noiseHit(t, 'bandpass', gated ? 1500 : 1800, 0.8, gated ? 0.24 : 0.16, lv, L.drums); if (gated) { const s = ctx.createGain(); s.gain.value = 0.9; g.connect(s); s.connect(mRev); } const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.05); og.gain.setValueAtTime(lv * 0.5, t); og.gain.setTargetAtTime(0.0001, t, 0.02); o.connect(og); og.connect(L.drums); o.start(t); o.stop(t + 0.15); }
    function clap(t, lv) { for (const d of [0, 0.011, 0.022]) noiseHit(t + d, 'bandpass', 1200, 1.2, d === 0.022 ? 0.14 : 0.02, lv, L.drums); }
    function hat(t, lv, open) { noiseHit(t, 'highpass', 7500, 0.7, open ? 0.2 : 0.05, lv, L.drums); }
    function rim(t, lv) { noiseHit(t, 'bandpass', 3200, 6, 0.04, lv, L.drums); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 520; g.gain.setValueAtTime(lv * 0.5, t); g.gain.setTargetAtTime(0.0001, t, 0.012); o.connect(g); g.connect(L.drums); send(g, 0.4); o.start(t); o.stop(t + 0.08); }
    function chipDrum(t, kind, lv) { if (kind === 'k') { const o = ctx.createOscillator(), g = ctx.createGain(); o.setPeriodicWave(pulseWave(0.25)); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.06); g.gain.setValueAtTime(lv * 0.9, t); g.gain.setTargetAtTime(0.0001, t, 0.035); o.connect(g); g.connect(L.drums); o.start(t); o.stop(t + 0.15); } else noiseHit(t, kind === 's' ? 'lowpass' : 'highpass', kind === 's' ? 5000 : 8000, 0.5, kind === 's' ? 0.12 : 0.03, lv * (kind === 's' ? 0.9 : 0.45), L.drums, true); }

    // ---------------- the music chain ----------------
    function busFor() {
      // channels (faders) -> mix -> warmth lowpass -> glue compressor -> music bus. A hall and a tempo-synced echo are sends.
      mIn = ctx.createGain(); mIn.gain.value = 0.62;
      warmLP = ctx.createBiquadFilter(); warmLP.type = 'lowpass'; warmLP.Q.value = 0.5; warmLP.frequency.value = 7500;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 2.5; comp.knee.value = 12; comp.attack.value = 0.02; comp.release.value = 0.3;
      outAn = ctx.createAnalyser(); outAn.fftSize = 256; outAn.smoothingTimeConstant = 0.75;
      mIn.connect(warmLP); warmLP.connect(comp); comp.connect(synthOut()); comp.connect(outAn);
      const conv = ctx.createConvolver(); conv.buffer = impulse(4.2, 0.22); revRet = ctx.createGain(); revRet.gain.value = 0.55; mRev = ctx.createGain(); mRev.connect(conv); conv.connect(revRet); revRet.connect(warmLP);
      // echo: a dotted-eighth delay with a darkening feedback loop
      echoIn = ctx.createGain(); echoD = ctx.createDelay(2); echoD.delayTime.value = 0.6; echoFb = ctx.createGain(); echoFb.gain.value = 0.35;
      const eLP = ctx.createBiquadFilter(); eLP.type = 'lowpass'; eLP.frequency.value = 2200; const eHP = ctx.createBiquadFilter(); eHP.type = 'highpass'; eHP.frequency.value = 250;
      echoIn.connect(echoD); echoD.connect(eLP); eLP.connect(eHP); eHP.connect(echoFb); echoFb.connect(echoD); eHP.connect(mIn); const es = ctx.createGain(); es.gain.value = 0.25; eHP.connect(es); es.connect(mRev);
      for (const c of CHN) { CH[c] = ctx.createGain(); CH[c].connect(mIn); AN[c] = ctx.createAnalyser(); AN[c].fftSize = 256; CH[c].connect(AN[c]); }
      const lay = (v, ch, rev) => { const g = ctx.createGain(); g.gain.value = v; g.connect(CH[ch]); if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(mRev); } return g; };
      L = { pad: lay(0.05, 'pads', 0.9), bass: lay(0.3, 'bass', 0.05), keys: lay(0.075, 'keys', 0.5), arp: lay(0.05, 'arp', 0.6), spark: lay(0.035, 'lead', 1.1), lead: lay(0.05, 'lead', 0.6), drums: lay(0.22, 'drums', 0.12) };
      const len = ctx.sampleRate * 3, vb = ctx.createBuffer(1, len, ctx.sampleRate), d = vb.getChannelData(0);
      for (let i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * 0.015; if (Math.random() < 0.00035) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.5); }
      const cr = ctx.createBufferSource(); cr.buffer = vb; cr.loop = true; const vf = ctx.createBiquadFilter(); vf.type = 'bandpass'; vf.frequency.value = 3000; vf.Q.value = 0.4;
      vinylG = ctx.createGain(); vinylG.gain.value = 0.12; cr.connect(vf); vf.connect(vinylG); vinylG.connect(mIn); cr.start();
      applyMix();
    }
    function applyMix() {
      if (!mIn) return;
      const c = live(), t = ctx.currentTime;
      for (const k of CHN) CH[k].gain.setTargetAtTime(c.mute && c.mute[k] ? 0 : (c.mix[k] === undefined ? 1 : c.mix[k]), t, 0.05);
      revRet.gain.setTargetAtTime(c.fx.reverb, t, 0.1);
      echoFb.gain.setTargetAtTime(Math.min(0.72, c.fx.echo * 0.8), t, 0.1);
      warmLP.frequency.setTargetAtTime(15000 - c.fx.warmth * 10500, t, 0.1);
      vinylG.gain.setTargetAtTime(c.fx.vinyl * 0.35, t, 0.1);
    }
    const lvl = (thr) => sstep(effI(), thr - 0.12, thr + 0.12);
    function drums(kit, tt, s16, dl, hl, inB, sp16) {
      const E = live().energy;
      if (kit === 'lofi') { if (P.drum.hat.includes(s16) && hl > 0.05) hat(tt, 0.18 * hl * (s16 % 4 === 0 ? 1 : 0.7)); if (dl > 0.05) { if (P.drum.kick.includes(s16)) kick(tt, 0.9 * dl); if (s16 === 4 || s16 === 12) snare(tt, 0.35 * dl); } return; }
      if (kit === 'tide') { if (s16 % 2 === 0 && hl > 0.05) hat(tt, 0.16 * hl, s16 % 8 === 4); if (dl > 0.05 && (s16 === 0 || s16 === 8)) kick(tt, 0.85 * dl); return; }
      if (kit === 'synth' || kit === 'synth16') {
        if ((kit === 'synth16' || E > 0.6 ? true : s16 % 2 === 0) && hl > 0.05) hat(tt, 0.13 * hl * (s16 % 2 ? 0.6 : 1));
        if (dl > 0.05) { if (kit === 'synth16' ? s16 % 4 === 0 : (s16 === 0 || s16 === 8 || (E > 0.7 && s16 === 10))) kick(tt, 0.95 * dl, true); if (s16 === 4 || s16 === 12) snare(tt, 0.42 * dl, true); }
        return;
      }
      if (kit === 'techno' || kit === 'deep') {
        const deep = kit === 'deep';
        if (dl > 0.05 && s16 % 4 === 0) kick(tt, (deep ? 0.8 : 1) * dl, true);
        if (hl > 0.05) { if (s16 % 4 === 2) hat(tt, 0.2 * hl, !deep); if (E > 0.45 && s16 % 2 === 1) hat(tt, 0.07 * hl); if (deep && s16 % 2 === 0) noiseHit(tt, 'bandpass', 6500, 1.5, 0.05, 0.07 * hl, L.drums); }
        if (dl > 0.3 && (s16 === 4 || s16 === 12)) { if (deep) { if (s16 === 12) rim(tt, 0.25 * dl); } else clap(tt, 0.4 * dl); }
        return;
      }
      if (kit === 'chip' || kit === 'chipsoft') {
        const soft = kit === 'chipsoft';
        if (hl > 0.05 && s16 % (soft ? 4 : 2) === 0) chipDrum(tt, 'h', hl);
        if (dl > 0.05) { if (soft ? s16 === 0 : (s16 === 0 || s16 === 8 || (E > 0.6 && s16 === 6))) chipDrum(tt, 'k', dl); if (soft ? s16 === 8 : (s16 === 4 || s16 === 12)) chipDrum(tt, 's', dl); }
        return;
      }
      if (kit === 'onedrop' || kit === 'steppers') {
        if (hl > 0.05 && s16 % 2 === 0) hat(tt, 0.11 * hl * (s16 % 4 ? 0.6 : 1));
        if (dl > 0.05) { if (kit === 'steppers' ? s16 % 4 === 0 : s16 === 8) kick(tt, 0.85 * dl); if (s16 === 8) rim(tt, 0.32 * dl); if (bar % 8 === 7 && s16 >= 12 && s16 % 1 === 0) snare(tt, (0.12 + 0.05 * (s16 - 12)) * dl); }
      }
    }
    function scheduleStep(t) {
      const st = P.S, meter = P.meter, perBar = meter * 4, sp16 = P.spb / 4;
      if (P.skip && s16 === 0) { newPiece(forceNext); forceNext = null; return scheduleStep(t); }
      const chordLen = st.bars, ci = Math.floor(bar / chordLen) % P.prog.length, deg = P.prog[ci], firstOfChord = bar % chordLen === 0 && s16 === 0;
      const sw = st.swing && s16 % 2 === 1 ? (st.swing - 0.5) * 2 * sp16 : 0, tt = t + sw;
      const phrase = Math.floor(bar / 8), inB = phrase === 2, lastBar = bar === 31, E = effI();
      if (firstOfChord) {
        const v = voice(deg), dur = chordLen * perBar * sp16;
        pad(v, t, dur, 0.9 * (inB ? 1.15 : 1) * (st.hard < 0.2 ? 1.15 : 1), 0.35 + E * 0.5, st.pad);
        P.cur = { deg, v, rootN: root + chordPCs(deg)[0] - 12 };
        while (P.cur.rootN > 47) P.cur.rootN -= 12; while (P.cur.rootN < 36) P.cur.rootN += 12;
      }
      const C = P.cur; if (!C) return;
      // ---- bass ----
      const bLv = 0.55 + 0.45 * lvl(0.25), bk = st.bass;
      if (bk === 'long') { if (s16 === 0) bassTone(C.rootN, tt, perBar * sp16 * 0.95, bLv); }
      else if (bk === 'pattern') { if (s16 === 0 || (P.bassPat.some(b => Math.round(b * perBar) === s16) && lvl(0.3) > 0.2)) bassTone(s16 === 0 ? C.rootN : C.rootN + (chance(0.5) ? 7 : 12), tt, sp16 * pick([3, 4, 6]), bLv); }
      else if (bk === 'octave') { if (s16 % 2 === 0) bassTone(C.rootN + (s16 % 4 === 2 ? 12 : 0), tt, sp16 * 1.6, bLv, 'saw'); }
      else if (bk === 'drive16') { if (lvl(0.3) > 0.1 || s16 % 4 === 0) bassTone(C.rootN + (s16 % 8 === 6 ? 12 : 0), tt, sp16 * 0.85, bLv * (s16 % 4 === 0 ? 1 : 0.75), 'saw'); }
      else if (bk === 'acid') { const a = P.acid[s16 % 16]; if (a && (lvl(0.2) > 0.1 || s16 % 4 === 0)) acid303(a, C.rootN + 12 + a.n, tt, sp16, bLv); }
      else if (bk === 'rumble') { if (s16 % 4 === 2) bassTone(C.rootN, tt, sp16 * 1.6, bLv); }
      else if (bk === 'chip') { if (s16 % 2 === 0) bassTone(C.rootN + [0, 12, 7, 12][(s16 / 2) % 4], tt, sp16 * 1.7, bLv, 'tri'); }
      else if (bk === 'chipLong') { if (s16 % 4 === 0) bassTone(C.rootN + (s16 === 8 ? 7 : 0), tt, sp16 * 3.5, bLv, 'tri'); }
      else if (bk === 'dub') { const d = P.dubLine[s16 % 16]; if (d) bassTone(degToMidi(C.deg + d.d, 40), tt, sp16 * d.len * 1.6, bLv * 1.1, 'dub'); }
      // ---- keys ----
      const kk = st.keys;
      if (kk) {
        const kl = kk === 'broken' ? 1 : lvl(kk === 'skank' ? 0.12 : 0.15);
        if (kk === 'chiparp') { if (kl > 0.05) for (const h of [0, 0.5]) { const notes = [C.v[0], C.v[1] || C.v[0] + 4, C.v[2] || C.v[0] + 7]; chipNote(notes[(s16 * 2 + (h ? 1 : 0)) % notes.length] + 12, tt + h * sp16, sp16 * 0.48, 1.1 * kl, 0.125, L.keys); } }
        else if (kl > 0.05 && P.keysPat.includes(s16)) {
          if (kk === 'broken') { const order = [C.rootN + 12, ...C.v]; const idx = s16 / 4; keys(order[idx % order.length], tt, 0.9, 2.6); if (s16 === 0) keys(C.v[C.v.length - 1] + 12, tt + sp16 * 6, 0.35, 2); }
          else if (kk === 'rhodes') { for (const n of C.v) keys(n, tt + R() * 0.015, kl * (0.6 + 0.4 * R()), st.name === 'Lofi' ? 1.2 : 2.2); }
          else if (kk === 'stab') stab(C.v, tt, 0.55 * kl, 0.25);
          else if (kk === 'dubstab') stab(C.v.map(n => n + 12), tt, 0.4 * kl, 0.7);
          else if (kk === 'skank') skank(C.v, tt, 0.55 * kl);
        }
      }
      // ---- arpeggios ----
      const ak = st.arp;
      if (ak) {
        const gate = ak === 'pluck' ? 0.7 + 0.3 * lvl(0.3) : ak === 'pluckHi' ? lvl(0.55) : lvl(ak === 'pulse16' ? 0.3 : 0.35);
        const every = ak === 'pulse16' ? 1 : ak === 'pulse' ? 1 : ak === 'pluckHi' ? 4 : 2;
        if (gate > 0.05 && s16 % every === 0) {
          const k = (s16 / every + bar * 3) % P.arpPat.length, notes = [...C.v, C.v[0] + 12], n = notes[P.arpPat[k] % notes.length];
          if (ak === 'pluck' || ak === 'pluckHi') pluck(n + 12, tt, 0.7 * gate); else arpN(n + (ak === 'pulse16' ? 12 : 0), tt, 0.8 * gate);
        }
      }
      // ---- drums ----
      if (st.kit && !lastBar) drums(st.kit, tt, s16, lvl(st.kit === 'techno' || st.kit === 'synth16' ? 0.25 : 0.42) * (inB ? 0.5 : 1), lvl(0.3), inB, sp16);
      // ---- melody ----
      const lk = st.lead, ml = lvl(st.hard < 0.2 ? 0.35 : lk === 'bleep' ? 0.55 : 0.5);
      if (s16 % 2 === 0 && ml > 0.05 && !(phrase === 0 && bar < 2)) {
        const mot = inB ? P.motifB : P.motif, i = ((bar % 2) * 8 + s16 / 2) % 16, ev = mot[i];
        if (ev) {
          let d = C.deg + ev.d;
          if (i % 4 === 0) { const tones = [0, 2, 4].map(k => C.deg + k); d = tones.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a); }
          const n = degToMidi(d, 72), dur = ev.len * sp16 * 2;
          if (lk === 'bell') bell(n + 12, tt, 0.8 * ml); else if (lk === 'keys') keys(n + 12, tt, 0.75 * ml, 2.4);
          else if (lk === 'bleep') { if (chance(0.55)) bleep(n + 12, tt, 0.6 * ml); }
          else lead(n + (lk === 'chip' ? 12 : 0), tt, lk === 'chip' ? Math.min(dur, sp16 * 2) : dur, (lk === 'chip' ? 1.05 : 0.85) * ml, lk);
        }
      }
      // ---- sparkles ----
      if (s16 % 4 === 2 && chance(0.06 + 0.12 * lvl(0.65)) && st.genre !== 'chiptune') bell(pick(C.v) + 24, tt + R() * 0.05, 0.5);
      s16++;
      if (s16 >= perBar) {
        s16 = 0; bar++;
        if (bar % 8 === 0 && bar < 32) { if (phrase === 0 || phrase === 2) P.motif = mutate(mutate(P.motif)); }
        if (bar >= 32) newPiece(forceNext), forceNext = null;
      }
    }
    let tempoNow = 0;
    function liveSpb() { const c = live(), want = Math.max(48, P.bpm * (1 + (intensity - 0.4) * 0.22 * c.follow + (c.energy - 0.35) * 0.08)); tempoNow = tempoNow ? tempoNow + (want - tempoNow) * 0.02 : want; P.spb = 60 / tempoNow; return P.spb; }
    function schedule(horizon) {
      if (!ctx || !P) return;
      intensity += (targetI - intensity) * 0.04;
      if (nextT < ctx.currentTime - 0.4) nextT = ctx.currentTime + 0.05;
      const until = (horizon !== undefined ? horizon : ctx.currentTime + 0.3);
      while (nextT < until) { const t = nextT; scheduleStep(t); nextT += liveSpb() / 4; }
    }
    function start() {
      if (running || !ctx) return; running = true;
      if (!mIn) busFor();
      if (!P) newPiece();
      nextT = ctx.currentTime + 0.1;
      if (!offline) timer = setInterval(() => schedule(), 100);
    }
    function meterOf(an) { if (!an) return 0; const a = new Float32Array(an.fftSize); an.getFloatTimeDomainData(a); let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length); }
    return {
      start, schedule, GENRES, STYLES, CHN, DEF,
      setIntensity(v) { targetI = clamp(v, 0, 1); },
      setScene(s) { scene = s; },
      setMood(m) { mood = m; },
      setBaseBpm(v) { cfg.bpm.chill = clamp(+v || 72, 50, 110); if (P) P.bpm = pieceBpm(); },
      // studio config: merged over the defaults; changes apply live
      get config() { return cfg; },
      setConfig(c) { const d = JSON.parse(JSON.stringify(DEF)); cfg = Object.assign(d, c || {}); cfg.bpm = Object.assign(d.bpm, (c && c.bpm) || {}); cfg.mix = Object.assign(d.mix, (c && c.mix) || {}); cfg.fx = Object.assign(d.fx, (c && c.fx) || {}); cfg.mute = (c && c.mute) || {}; cfg.favs = (c && c.favs) || []; applyMix(); if (P) P.bpm = pieceBpm(); },
      apply() { applyMix(); if (P) P.bpm = pieceBpm(); },
      skip(force) { if (!P) return; forceNext = force || null; P.skip = true; },
      save() { if (!P) return null; if (cfg.favs.some(f => f.seed === P.seed)) return null; const f = { seed: P.seed, style: P.style, mode: P.mode, root, name: P.name, genre: P.genre, at: Date.now() }; cfg.favs.unshift(f); if (cfg.favs.length > 40) cfg.favs.pop(); return f; },
      isSaved() { return !!(P && cfg.favs.some(f => f.seed === P.seed)); },
      meters() { const o = {}; for (const c of CHN) o[c] = meterOf(AN[c]); return o; },
      spectrum(arr) { if (outAn) outAn.getByteFrequencyData(arr); },
      renderAhead(seconds, curve) { start(); const step = 0.1; for (let t = 0; t < seconds; t += step) { if (curve) targetI = curve(t / seconds); intensity += (targetI - intensity) * 0.3; const h = t + step; while (nextT < h) { const tt = nextT; scheduleStep(tt); nextT += liveSpb() / 4; } } },
      get log() { return pieceLog; },
      get piece() { return P && { name: P.name, genre: P.genre, genreName: GENRES[P.genre].name, style: P.style, styleName: P.S.name, mode: P.mode, key: NOTE[root % 12] + ' ' + MODE_NAME[P.mode], root, bpm: Math.round(P.bpm), now: Math.round(tempoNow), bar, bars: 32, seed: P.seed, saved: cfg.favs.some(f => f.seed === P.seed), energy: +effI().toFixed(2) }; },
    };
  })();

  return { stats: () => ({ played, inFlight, nodes: ctx ? ctx.state : 'none' }), init, play, beams, danger, offlineCtx, setLocator(f) { locate = f; }, setT(t) { tBase = t; }, setVolumes, setTrack, setSoundtrack, music: Music, get ready() { return !!ctx; } };
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
