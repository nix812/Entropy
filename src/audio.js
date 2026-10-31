// ===================== ENTROPY — SYNTH AUDIO =====================
// Engine modeled on the Elemental Clash SFX kit: osc / fm / noise / kick voices
// routed through reverb, compression and distortion. Everything is synthesized.
const SFX = (() => {
  let ctx = null, master, sfxBus, musBus, limiter, noiseBuf, noiseLo, musRev;
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
    synthBus = ctx.createGain(); synthBus.gain.value = soundtrack === 'synth' ? 1 : 0; synthBus.connect(musBus);
    musRev = makeReverb(0.5, 0, 3.5, synthBus);
    BGM.attach();
    if (soundtrack === 'synth') Music.start();
  }
  // ---------------- soundtrack: composed tracks (default), the procedural synth, or a mix of both ----------------
  // Composed tracks rotate as a playlist: audio/bgm-battle.mp3, bgm-battle-2.mp3 … (and bgm-menu-2.mp3 …) are picked up
  // automatically when present, so new tracks only need dropping into the audio folder.
  // 'mix' plays the composed battle track, then a generative interlude, then the next composed track.
  let soundtrack = 'ec', synthBus = null, track = 'menu';
  const MIX_INTERLUDE = 150;
  const BGM = (() => {
    const els = {}, lists = { menu: ['menu'], battle: ['battle'] }, idx = { menu: 0, battle: 0 };
    let failed = false, unlocked = false, interlude = 0, interludeTimer = null;
    const cur = () => lists[track][idx[track] % lists[track].length];
    function el(id) {
      if (els[id]) return els[id];
      const a = document.createElement('audio');
      a.preload = id === cur() ? 'auto' : 'metadata'; a.setAttribute('playsinline', ''); a.setAttribute('webkit-playsinline', '');
      a.src = new URL('audio/bgm-' + id + '.mp3', document.baseURI).href;
      a.addEventListener('error', () => { if (!a.src) return; if (id === 'menu' || id === 'battle') { failed = true; fallback(); } });
      a.addEventListener('ended', () => next(id));
      a.style.display = 'none'; document.body.appendChild(a);
      els[id] = a; return a;
    }
    // probe for extra tracks; each one that loads joins its playlist
    function probe() {
      for (const cat of ['battle', 'menu']) for (let n = 2; n <= 6; n++) {
        const id = cat + '-' + n, a = document.createElement('audio');
        a.preload = 'metadata'; a.src = new URL('audio/bgm-' + id + '.mp3', document.baseURI).href;
        a.addEventListener('loadedmetadata', () => { if (!lists[cat].includes(id)) { lists[cat].push(id); a.removeAttribute('src'); a.load(); loopFlags(); } }, { once: true });
        a.addEventListener('error', () => a.removeAttribute('src'), { once: true });
      }
    }
    // a lone track loops; a playlist (or mix mode) advances on 'ended'
    function loopFlags() { for (const cat in lists) for (const id of lists[cat]) if (els[id]) els[id].loop = lists[cat].length === 1 && !(soundtrack === 'mix' && cat === 'battle'); }
    function next(id) {
      const cat = id.startsWith('menu') ? 'menu' : 'battle';
      idx[cat] = (idx[cat] + 1) % lists[cat].length;
      if (els[id]) els[id].currentTime = 0;
      if (soundtrack === 'mix' && cat === 'battle') startInterlude(); else apply();
    }
    function startInterlude() {
      interlude = 1; if (synthBus) synthBus.gain.setTargetAtTime(1, now(), 1.5); if (ctx) Music.start();
      clearTimeout(interludeTimer);
      interludeTimer = setTimeout(() => { interlude = 0; if (synthBus && soundtrack !== 'synth') synthBus.gain.setTargetAtTime(0, now(), 1.5); apply(); }, MIX_INTERLUDE * 1000);
      apply();
    }
    function attach() { unlocked = true; el('menu'); el('battle'); loopFlags(); probe(); apply(); }
    function apply() {
      const composed = (soundtrack === 'ec' || soundtrack === 'mix') && !(soundtrack === 'mix' && track === 'battle' && interlude);
      const on = composed && !failed && unlocked && !document.hidden && musVol > 0.001;
      for (const id in els) { els[id].volume = Math.min(1, musVol * 1.4); if ((!on || id !== cur()) && !els[id].paused) els[id].pause(); }
      if (!on) return;
      const a = el(cur()); loopFlags();
      if (a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
    }
    function reset() { interlude = 0; clearTimeout(interludeTimer); }
    function fallback() { if (soundtrack === 'ec' || soundtrack === 'mix') { soundtrack = 'synth-fallback'; if (synthBus) synthBus.gain.value = 1; if (ctx) Music.start(); } }
    document.addEventListener('visibilitychange', () => apply());
    // iOS only grants playback inside a user gesture: retry on every tap until a track is actually playing
    for (const ev of ['touchend', 'click', 'pointerup', 'keydown']) document.addEventListener(ev, () => {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (unlocked && (soundtrack === 'ec' || soundtrack === 'mix') && els[cur()] && els[cur()].paused) apply();
    }, { passive: true });
    return { attach, apply, reset, loopFlags, get failed() { return failed; }, get lists() { return lists; }, get interlude() { return interlude; } };
  })();
  function setTrack(t) {
    const nt = t === 'game' ? 'battle' : 'menu';
    if (nt !== track && synthBus && soundtrack === 'mix') { BGM.reset(); synthBus.gain.setTargetAtTime(0, now(), 0.3); }
    track = nt; BGM.apply();
  }
  function setSoundtrack(v) {
    soundtrack = v; BGM.reset(); BGM.loopFlags();
    if (synthBus) synthBus.gain.setTargetAtTime(v === 'synth' ? 1 : 0, now(), 0.1);
    if (v === 'synth' && ctx) Music.start();
    BGM.apply();
  }
  function setVolumes(s, m) {
    sfxVol = s; musVol = m;
    if (sfxBus) sfxBus.gain.setTargetAtTime(s, now(), 0.05);
    if (musBus) musBus.gain.setTargetAtTime(m, now(), 0.05);
    BGM.apply();
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
    master = ctx.createGain(); master.gain.value = 1; sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; musBus = ctx.createGain();
    sfxBus.connect(limiter); limiter.connect(master); master.connect(ctx.destination);
    makeNoise(); buildBuses();
  }
  function makeNoise() {
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // lo-fi noise: sample-and-hold every 6 samples, NES-style grit
    noiseLo = ctx.createBuffer(1, len, ctx.sampleRate); const e = noiseLo.getChannelData(0); let v = 0;
    for (let i = 0; i < len; i++) { if (i % 6 === 0) v = Math.random() * 2 - 1; e[i] = v; }
  }

  // ---------------- procedural music ----------------
  const Music = (() => {
    let timer = null, step = 0, nextT = 0, intensity = 0.15, targetI = 0.15;
    const BPM = 92, S16 = 60 / BPM / 4;
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    // A minor-ish progression: Am, F, Dm, E (two bars each)
    const PROG = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];
    const SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
    let arpIdx = 4;
    function pad(chord, t, dur) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(900 + 900 * intensity, t + dur * 0.5); f.frequency.linearRampToValueAtTime(500, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 1.2); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
      f.connect(g); g.connect(musRev.input);
      for (const n of chord) for (const dt of [-8, 8]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = dt;
        o.connect(f); o.start(t); o.stop(t + dur + 0.6);
      }
    }
    function note(type, freq, t, dur, vol, cut, dest) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cut || 2000;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(dest || synthBus); o.start(t); o.stop(t + dur + 0.05);
    }
    function hat(t, vol) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f); f.connect(g); g.connect(synthBus); s.start(t, Math.random()); s.stop(t + 0.06);
    }
    function kickM(t, vol) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(synthBus); o.start(t); o.stop(t + 0.25);
    }
    function schedule() {
      if (!ctx) return;
      intensity += (targetI - intensity) * 0.05;
      while (nextT < ctx.currentTime + 0.25) {
        const t = nextT, bar = Math.floor(step / 16), s = step % 16;
        const chord = PROG[Math.floor(bar / 2) % PROG.length];
        if (s === 0 && bar % 2 === 0) pad(chord, t, S16 * 32);
        // bass
        if (s % 4 === 0 || (intensity > 0.5 && s % 2 === 0)) note('triangle', mtof(chord[0] - 24), t, S16 * 1.8, 0.07 + intensity * 0.04, 500);
        // arp
        if (s % 2 === 0 && Math.random() < 0.35 + intensity * 0.5) {
          arpIdx = clamp(arpIdx + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2)), 0, SCALE.length - 1);
          note('square', mtof(SCALE[arpIdx]), t, S16 * 1.5, 0.012 + intensity * 0.012, 1600, musRev.input);
        }
        if (intensity > 0.35 && (s === 0 || s === 8)) kickM(t, 0.12 * intensity);
        if (intensity > 0.55 && s % 2 === 1) hat(t, 0.012 * intensity);
        if (intensity > 0.85 && (s === 4 || s === 12)) { const sv = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); sv.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); sv.connect(f); f.connect(g); g.connect(musRev.input); sv.start(t, Math.random()); sv.stop(t + 0.13); }
        nextT += S16; step++;
      }
    }
    return {
      start() { if (timer) return; nextT = ctx.currentTime + 0.1; timer = setInterval(schedule, 90); },
      setIntensity(v) { targetI = clamp(v, 0, 1); },
    };
  })();

  return { stats: () => ({ played, inFlight, nodes: ctx ? ctx.state : 'none' }), init, play, beams, danger, offlineCtx, setLocator(f) { locate = f; }, setT(t) { tBase = t; }, setVolumes, setTrack, setSoundtrack, music: Music, bgm: BGM, get ready() { return !!ctx; } };
})();
