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

  // ================= v4.6 DRIFT: the generative soundtrack =================
  // A small composer that never stops writing. Calm by design: 60-84 BPM, extended chords (7ths, 9ths) with smooth voice
  // leading, melodies biased toward chord tones, and loops that slowly mutate instead of repeating.
  //  - a PIECE is a style + key + mode + tempo + progression + motif. It runs 4 phrases of 8 bars (A, A', B, A''), then the
  //    composer modulates to a related key and starts the next piece, with the pad bridging the seam (horizontal resequencing)
  //  - within a piece, layers fade in and out with the game's intensity (vertical layering): pads and bass always, then keys,
  //    hats, drums, melody, arpeggios and sparkles as the action climbs. Boss fights darken the next piece, not the volume
  //  - five styles: Drift (ambient pads and glass), Lofi (electric piano and a dusty beat), Glass (plucked arpeggios),
  //    Tide (a gentle synthwave pulse) and Nocturne (a slow, piano-like waltz of broken chords)
  const Music = (() => {
    let timer = null, nextT = 0, intensity = 0.15, targetI = 0.15, scene = 'menu', mood = 'calm', running = false, baseBpm = 72;
    let mIn = null, mRev = null, crackle = null, L = {};
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const R = Math.random, pick = a => a[Math.floor(R() * a.length)], chance = p => R() < p;
    const sstep = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const MODES = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
    // progressions as scale degrees (0 = I). Each chord lasts 1 or 2 bars.
    const PROGS = {
      ionian: [[1, 4, 0, 0], [0, 5, 1, 4], [3, 2, 1, 0], [0, 3, 0, 3], [3, 4, 2, 5], [0, 2, 3, 3]],
      dorian: [[0, 3, 0, 3], [0, 6, 3, 0], [0, 4, 3, 0], [0, 0, 6, 6]],
      aeolian: [[0, 5, 2, 6], [0, 3, 6, 2], [5, 6, 0, 0], [0, 5, 3, 4], [0, 6, 5, 6]],
      lydian: [[0, 1, 0, 1], [0, 1, 6, 2], [0, 0, 1, 1]],
      mixolydian: [[0, 6, 3, 0], [0, 3, 6, 0], [0, 0, 6, 3]],
    };
    const STYLES = {
      // bpm: offset from the player's chosen average tempo (Settings > Music Tempo, default 72)
      drift: { bpm: [-8, -3], bars: 2, modes: ['lydian', 'ionian', 'dorian'], swing: 0, calm: 1 },
      nocturne: { bpm: [-9, -5], bars: 2, modes: ['aeolian', 'dorian', 'ionian'], swing: 0, calm: 1, meter: 3 },
      glass: { bpm: [-3, 2], bars: 2, modes: ['lydian', 'ionian', 'mixolydian', 'dorian'], swing: 0, calm: 0.6 },
      lofi: { bpm: [0, 6], bars: 1, modes: ['dorian', 'ionian', 'aeolian'], swing: 0.58, calm: 0.3 },
      tide: { bpm: [4, 9], bars: 2, modes: ['aeolian', 'dorian', 'mixolydian'], swing: 0, calm: 0 },
    };
    let P = null; // the current piece
    const pieceLog = [];
    let lastStyle = '', bar = 0, s16 = 0, voicing = null, root = 50;
    function newPiece() {
      // style: calm moments favour the ambient styles, busy ones the groovier ones, and never the same style twice running
      const k = intensity, w = {};
      for (const [id, S] of Object.entries(STYLES)) w[id] = id === lastStyle ? 0.05 : 0.25 + Math.abs(1 - Math.abs(S.calm - (1 - k))) * 1.2;
      if (scene === 'menu') { w.tide = 0.05; w.lofi *= 0.6; }
      if (mood === 'boss') { w.drift = w.nocturne = 0.05; }
      let tot = 0; for (const id in w) tot += w[id]; let r = R() * tot, style = 'drift'; for (const id in w) { r -= w[id]; if (r <= 0) { style = id; break; } }
      const S = STYLES[style];
      let mode = pick(S.modes); if (mood === 'boss') mode = pick(['aeolian', 'dorian']);
      // keys walk: a fourth up, a whole step down, or a relative shift; kept between D and A so nothing gets shrill or muddy
      if (P) { root += pick([5, -2, 2, -5, 7, 0, 3, -3]); while (root > 57) root -= 12; while (root < 46) root += 12; } else root = pick([48, 50, 52, 53, 55, 57]);
      const prog = pick(PROGS[mode]);
      const bpm = baseBpm + S.bpm[0] + R() * (S.bpm[1] - S.bpm[0]);
      lastStyle = style; pieceLog.push({ style, mode, root, bpm: Math.round(bpm), t: ctx ? +(nextT || 0).toFixed(1) : 0, i: +intensity.toFixed(2) });
      P = { style, S, mode, prog, bpm, meter: S.meter || 4, scale: MODES[mode], spb: 60 / bpm, phrase: 0, motif: makeMotif(S), motifB: makeMotif(S), arpPat: pick([[0, 1, 2, 3], [0, 2, 1, 3], [0, 1, 2, 3, 2, 1], [0, 2, 3, 1], [3, 2, 1, 0]]), keysPat: makeKeys(S), drum: makeDrums(S), bassPat: pick([[0], [0, 0.5], [0, 0.75], [0, 0.625]]) };
      bar = 0; s16 = 0;
    }
    // a motif: 16 eighth-note steps over two bars, as scale-degree moves (a random walk) with rests. It mutates on repeat.
    function makeMotif(S) {
      const m = []; let d = pick([0, 2, 4]), dens = S.calm > 0.7 ? 0.28 : 0.42;
      for (let i = 0; i < 16; i++) { const strong = i % 4 === 0; if (chance(strong ? dens + 0.2 : dens * 0.7)) { d += pick([-2, -1, -1, 1, 1, 2, 0]); d = Math.max(-2, Math.min(9, d)); m.push({ d, len: pick([1, 1, 2, 2, 3]) }); } else m.push(null); }
      if (m.every(x => !x)) m[0] = { d: 2, len: 2 };
      return m;
    }
    function mutate(m) { const c = m.map(x => x && { ...x }); const i = Math.floor(R() * 16); if (c[i]) { if (chance(0.5)) c[i].d += pick([-1, 1]); else c[i] = null; } else c[i] = { d: pick([0, 2, 4]), len: 1 }; return c; }
    // keys comping rhythm in 16ths within a bar (lofi Rhodes stabs, nocturne broken chords)
    function makeKeys(S) {
      if (S.meter === 3) return [0, 4, 8];
      return pick([[0, 6, 10], [0, 7], [2, 6, 10, 14], [0, 3, 8, 11], [0, 10]]);
    }
    function makeDrums(S) {
      return { kick: pick([[0, 8], [0, 7, 10], [0, 10], [0, 6, 8]]), snare: [4, 12], hat: pick([[0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14], [0, 2, 3, 4, 6, 8, 10, 11, 12, 14]]) };
    }
    // chord tones for a degree: stacked thirds from the mode (root, 3rd, 5th, 7th, 9th)
    function chordPCs(deg) { const sc = P.scale; return [0, 2, 4, 6, 8].map(k => sc[(deg + k) % 7] + 12 * Math.floor((deg + k) / 7)); }
    // voice leading: put each chord tone in the octave closest to the previous voicing, inside E3-D5
    function voice(deg) {
      const pcs = chordPCs(deg).slice(1).map(p => root + p), out = [];
      const prev = voicing || [root + 7, root + 12, root + 16];
      for (const p of pcs) { let best = p, bd = 99; for (const o of [-24, -12, 0, 12]) { const n = p + o; if (n < 52 || n > 74) continue; const d = Math.min(...prev.map(q => Math.abs(q - n))); if (d < bd) { bd = d; best = n; } } out.push(best); }
      voicing = [...new Set(out)].sort((a, b) => a - b); return voicing;
    }
    // scale degree -> midi near a centre
    function degToMidi(deg, centre) { const sc = P.scale, o = Math.floor(deg / 7), m = root + sc[((deg % 7) + 7) % 7] + 12 * o; let n = m; while (n < centre - 6) n += 12; while (n > centre + 7) n -= 12; return n; }

    // ---------------- instruments ----------------
    const ctxT = () => ctx;
    function vca(t, a, d, r, peak, dest) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); if (d > 0) g.gain.setTargetAtTime(peak * 0.0001, t + a, d / 4); g.connect(dest); return g; }
    function oscN(type, f, t, end, dest, det) { const o = ctx.createOscillator(); if (typeof type === 'number') o.setPeriodicWave(pulseWave(type)); else o.type = type; o.frequency.value = f; o.detune.value = (det || 0) + (R() * 8 - 4); o.connect(dest); o.start(t); o.stop(end); return o; }
    function pad(notes, t, dur, lv, bright) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
      f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(700 + 1400 * bright, t + dur * 0.45); f.frequency.linearRampToValueAtTime(420, t + dur + 1.5);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lv, t + Math.min(2.2, dur * 0.35)); g.gain.setValueAtTime(lv, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.8);
      f.connect(g); g.connect(L.pad);
      for (const n of notes) { oscN('sawtooth', mtof(n), t, t + dur + 2, f, -7); oscN('sawtooth', mtof(n), t, t + dur + 2, f, 7); oscN('triangle', mtof(n - 12), t, t + dur + 2, f, 0); }
    }
    function bass(n, t, dur, lv) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.connect(vca(t, 0.02, dur * 0.9, 0, lv, L.bass)); oscN('sine', mtof(n), t, t + dur + 0.4, f); oscN('triangle', mtof(n), t, t + dur + 0.4, f).detune.value = 3; }
    function keys(n, t, lv, dec) { // FM electric piano: a mellow body and a short tine
      const g = vca(t, 0.004, dec || 2.2, 0, lv, L.keys), car = ctx.createOscillator(), m1 = ctx.createOscillator(), mg = ctx.createGain(), m2 = ctx.createOscillator(), mg2 = ctx.createGain(), f = mtof(n);
      car.frequency.value = f; car.detune.value = R() * 6 - 3; m1.frequency.value = f; m2.frequency.value = f * 14;
      mg.gain.setValueAtTime(f * 1.6, t); mg.gain.setTargetAtTime(f * 0.25, t, 0.25); mg2.gain.setValueAtTime(f * 0.5, t); mg2.gain.setTargetAtTime(0.01, t, 0.02);
      m1.connect(mg); mg.connect(car.frequency); m2.connect(mg2); mg2.connect(car.frequency); car.connect(g);
      const e = t + (dec || 2.2) + 0.3; for (const o of [car, m1, m2]) { o.start(t); o.stop(e); }
    }
    function pluck(n, t, lv) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(3200, t); f.frequency.setTargetAtTime(380, t, 0.09); f.connect(vca(t, 0.003, 0.9, 0, lv, L.arp)); oscN('triangle', mtof(n), t, t + 1, f); oscN('sawtooth', mtof(n), t, t + 1, f, 5); }
    function bell(n, t, lv) { const g = vca(t, 0.003, 3, 0, lv, L.spark), car = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), f = mtof(n); car.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.2, t); mg.gain.setTargetAtTime(f * 0.05, t, 0.5); m.connect(mg); mg.connect(car.frequency); car.connect(g); car.start(t); m.start(t); car.stop(t + 3.4); m.stop(t + 3.4); }
    function lead(n, t, dur, lv) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1900; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lv, t + 0.03); g.gain.setTargetAtTime(lv * 0.6, t + 0.03, dur * 0.4); g.gain.setTargetAtTime(0.0001, t + dur, 0.12); f.connect(g); g.connect(L.lead);
      const o = oscN(0.25, mtof(n), t, t + dur + 0.6, f), lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(n) * 0.006, t + 0.35); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.6);
      oscN('sine', mtof(n + 12), t, t + dur + 0.6, (() => { const q = ctx.createGain(); q.gain.value = 0.25; q.connect(f); return q; })()); }
    function arpN(n, t, lv) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(900 + 1600 * intensity, t); f.frequency.setTargetAtTime(500, t, 0.08); f.connect(vca(t, 0.002, 0.35, 0, lv, L.arp)); oscN(0.125, mtof(n), t, t + 0.4, f); }
    function noiseHit(t, ft, fq, q, dur, lv, dest) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = ft; f.frequency.value = fq; f.Q.value = q; g.gain.setValueAtTime(lv, t); g.gain.setTargetAtTime(0.0001, t, dur / 4); s.connect(f); f.connect(g); g.connect(dest); s.start(t, R() * 1.5); s.stop(t + dur + 0.05); }
    function kick(t, lv) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(lv, t); g.gain.setTargetAtTime(0.0001, t, 0.07); o.connect(g); g.connect(L.drums); o.start(t); o.stop(t + 0.4); }
    function snare(t, lv) { noiseHit(t, 'bandpass', 1800, 0.8, 0.16, lv, L.drums); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.05); g.gain.setValueAtTime(lv * 0.5, t); g.gain.setTargetAtTime(0.0001, t, 0.02); o.connect(g); g.connect(L.drums); o.start(t); o.stop(t + 0.15); }
    function hat(t, lv, open) { noiseHit(t, 'highpass', 7500, 0.7, open ? 0.18 : 0.05, lv, L.drums); }

    // ---------------- the scheduler ----------------
    function busFor() {
      // the music chain: layers -> warm lowpass -> gentle glue -> music bus, with a long hall send
      mIn = ctx.createGain(); mIn.gain.value = 0.62; // sits about 4 dB under the effects tiers
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7500; lp.Q.value = 0.5;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 2.5; comp.knee.value = 12; comp.attack.value = 0.02; comp.release.value = 0.3;
      mIn.connect(lp); lp.connect(comp); comp.connect(synthOut());
      const conv = ctx.createConvolver(); conv.buffer = impulse(4.2, 0.22); const rg = ctx.createGain(); rg.gain.value = 0.55; mRev = ctx.createGain(); mRev.connect(conv); conv.connect(rg); rg.connect(lp);
      const lay = (v, rev) => { const g = ctx.createGain(); g.gain.value = v; g.connect(mIn); if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(mRev); } return g; };
      L = { pad: lay(0.05, 0.9), bass: lay(0.3, 0.05), keys: lay(0.075, 0.5), arp: lay(0.05, 0.6), spark: lay(0.035, 1.1), lead: lay(0.05, 0.6), drums: lay(0.22, 0.12) };
      // vinyl: soft hiss with sparse crackle, under everything
      const len = ctx.sampleRate * 3, vb = ctx.createBuffer(1, len, ctx.sampleRate), d = vb.getChannelData(0);
      for (let i = 0; i < len; i++) { d[i] = (R() * 2 - 1) * 0.015; if (R() < 0.00035) d[i] += (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.5); }
      crackle = ctx.createBufferSource(); crackle.buffer = vb; crackle.loop = true; const vf = ctx.createBiquadFilter(); vf.type = 'bandpass'; vf.frequency.value = 3000; vf.Q.value = 0.4;
      const vg = ctx.createGain(); vg.gain.value = 0.12; crackle.connect(vf); vf.connect(vg); vg.connect(mIn); crackle.start();
    }
    const lvl = (thr) => sstep(intensity, thr - 0.12, thr + 0.12); // a layer's level fades in across ±0.12 around its threshold
    function scheduleStep(t) {
      const st = P.S, meter = P.meter, perBar = meter * 4, sp16 = P.spb / 4;
      const chordLen = st.bars, ci = Math.floor(bar / chordLen) % P.prog.length, deg = P.prog[ci], firstOfChord = bar % chordLen === 0 && s16 === 0;
      const sw = st.swing && s16 % 2 === 1 ? (st.swing - 0.5) * 2 * sp16 : 0, tt = t + sw;
      const phrase = Math.floor(bar / 8), inB = phrase === 2, lastBar = bar === 31;
      const I = intensity;
      if (firstOfChord) {
        const v = voice(deg), dur = chordLen * perBar * sp16;
        pad(v, t, dur, 0.9 * (inB ? 1.15 : 1) * (st.calm > 0.5 ? 1.15 : 1), 0.35 + I * 0.5);
        P.cur = { deg, v, rootN: root + chordPCs(deg)[0] - 12 };
        while (P.cur.rootN > 47) P.cur.rootN -= 12; while (P.cur.rootN < 36) P.cur.rootN += 12;
      }
      const C = P.cur; if (!C) return;
      // bass: root (and sometimes the fifth) on a simple pattern; long and soft in the calm styles
      const bLv = 0.55 + 0.45 * lvl(0.25);
      if (s16 === 0 || (st.calm < 0.7 && P.bassPat.some(b => Math.round(b * perBar) === s16) && lvl(0.3) > 0.2)) {
        const n = s16 === 0 ? C.rootN : C.rootN + (chance(0.5) ? 7 : 12);
        bass(n, tt, st.calm > 0.7 ? perBar * sp16 * 0.95 : sp16 * pick([3, 4, 6]), bLv);
      }
      // keys: Rhodes comping (lofi, tide, glass), broken chords (nocturne). Busier with intensity.
      if (st.calm < 1 || P.style === 'nocturne') {
        const kl = P.style === 'nocturne' ? 1 : lvl(0.15);
        if (kl > 0.05 && P.keysPat.includes(s16)) {
          if (P.style === 'nocturne') { const order = [C.rootN + 12, ...C.v]; const idx = s16 / 4; keys(order[idx % order.length] + (idx ? 0 : 0), tt, 0.9, 2.6); if (s16 === 0) keys(C.v[C.v.length - 1] + 12, tt + sp16 * 6, 0.35, 2); }
          else for (const n of C.v) keys(n, tt + R() * 0.015, kl * (0.6 + 0.4 * R()), P.style === 'lofi' ? 1.2 : 2.2);
        }
      }
      // arpeggio: glass plucks always; tide's pulse arp from mid intensity
      if (P.style === 'glass' || (P.style === 'tide' && lvl(0.35) > 0.05) || (P.style === 'drift' && lvl(0.55) > 0.05 && s16 % 4 === 0)) {
        const every = P.style === 'tide' ? 1 : 2;
        if (s16 % every === 0) { const pat = P.arpPat, k = (s16 / every + bar * 3) % pat.length, notes = [...C.v, C.v[0] + 12]; const n = notes[pat[k] % notes.length] + (P.style === 'glass' ? 12 : 0);
          if (P.style === 'tide') arpN(n, tt, 0.8 * lvl(0.35)); else pluck(n, tt, 0.7 * (P.style === 'glass' ? 0.7 + 0.3 * lvl(0.3) : lvl(0.55))); }
      }
      // drums: lofi and tide only, entering with intensity. Breakdowns (phrase B) thin them out; the last bar drops them.
      if ((P.style === 'lofi' || P.style === 'tide') && !lastBar) {
        const dl = lvl(0.42) * (inB ? 0.5 : 1), hl = lvl(0.3);
        if (P.drum.hat.includes(s16) && hl > 0.05) hat(tt, 0.18 * hl * (s16 % 4 === 0 ? 1 : 0.7), P.style === 'tide' && s16 % 8 === 4);
        if (dl > 0.05) { if (P.drum.kick.includes(s16)) kick(tt, 0.9 * dl); if (P.drum.snare.includes(s16) && P.style === 'lofi') snare(tt, 0.35 * dl); if (P.style === 'tide' && (s16 === 4 || s16 === 12)) hat(tt, 0.2 * dl, true); }
      }
      // melody: the motif on eighth notes, harmonised to the chord; A' and A'' mutate it, B uses a second motif
      const ml = lvl(P.style === 'nocturne' || P.style === 'drift' ? 0.35 : 0.5);
      if (s16 % 2 === 0 && ml > 0.05 && !(phrase === 0 && bar < 2)) {
        const mot = inB ? P.motifB : P.motif, i = ((bar % 2) * 8 + s16 / 2) % 16, ev = mot[i];
        if (ev) {
          let d = C.deg + ev.d;
          if (i % 4 === 0) { const tones = [0, 2, 4].map(k => C.deg + k); d = tones.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a); }
          const n = degToMidi(d, 72), dur = ev.len * sp16 * 2;
          if (P.style === 'drift' || P.style === 'glass') bell(n + 12, tt, 0.8 * ml); else if (P.style === 'nocturne') keys(n + 12, tt, 0.75 * ml, 2.4); else lead(n, tt, dur, 0.85 * ml);
        }
      }
      // sparkles: a high bell on chord tones now and then
      if (s16 % 4 === 2 && chance(0.06 + 0.12 * lvl(0.65))) bell(pick(C.v) + 24, tt + R() * 0.05, 0.5);
      // advance
      s16++;
      if (s16 >= perBar) {
        s16 = 0; bar++;
        if (bar % 8 === 0 && bar < 32) { if (phrase === 0 || phrase === 2) P.motif = mutate(mutate(P.motif)); }
        if (bar >= 32) newPiece();
      }
    }
    function schedule(horizon) {
      if (!ctx || !P) return;
      intensity += (targetI - intensity) * 0.04;
      if (nextT < ctx.currentTime - 0.4) nextT = ctx.currentTime + 0.05; // after a background pause: pick up from now
      const until = (horizon !== undefined ? horizon : ctx.currentTime + 0.3);
      while (nextT < until) { const t = nextT; scheduleStep(t); nextT += liveSpb() / 4; }
    }
    let tempoNow = 0;
    function liveSpb() { const want = Math.max(48, P.bpm + (intensity - 0.4) * 18); tempoNow = tempoNow ? tempoNow + (want - tempoNow) * 0.02 : want; P.spb = 60 / tempoNow; return P.spb; }
    function start() {
      if (running || !ctx) return; running = true;
      if (!mIn) busFor();
      if (!P) newPiece();
      nextT = ctx.currentTime + 0.1;
      if (!offline) timer = setInterval(() => schedule(), 100);
    }
    return {
      start, schedule,
      setIntensity(v) { targetI = clamp(v, 0, 1); },
      setScene(s) { scene = s; },
      setMood(m) { mood = m; },
      setBaseBpm(v) { baseBpm = clamp(+v || 72, 50, 110); if (P) P.bpm = baseBpm + P.S.bpm[0] + (P.S.bpm[1] - P.S.bpm[0]) / 2; },
      // tests: write `seconds` of music ahead into an offline context, stepping intensity along a curve
      renderAhead(seconds, curve) { start(); const step = 0.1; for (let t = 0; t < seconds; t += step) { if (curve) targetI = curve(t / seconds); intensity += (targetI - intensity) * 0.3; const h = t + step; while (nextT < h) { const tt = nextT; scheduleStep(tt); nextT += liveSpb() / 4; } } },
      get log() { return pieceLog; },
      get piece() { return P && { style: P.style, mode: P.mode, root, bpm: Math.round(P.bpm), now: Math.round(tempoNow), bar }; },
    };
  })();

  return { stats: () => ({ played, inFlight, nodes: ctx ? ctx.state : 'none' }), init, play, beams, danger, offlineCtx, setLocator(f) { locate = f; }, setT(t) { tBase = t; }, setVolumes, setTrack, setSoundtrack, music: Music, get ready() { return !!ctx; } };
})();
