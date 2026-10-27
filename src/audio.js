// ===================== ENTROPY — SYNTH AUDIO =====================
// Engine modeled on the Elemental Clash SFX kit: osc / fm / noise / kick voices
// routed through reverb, compression and distortion. Everything is synthesized.
const SFX = (() => {
  let ctx = null, master, sfxBus, musBus, limiter, noiseBuf, musRev;
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
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = 0.002; limiter.release.value = 0.15;
    master = ctx.createGain(); master.gain.value = 0.9;
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol;
    musBus = ctx.createGain(); musBus.gain.value = musVol;
    sfxBus.connect(limiter); musBus.connect(limiter); limiter.connect(master); master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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
  function impulse(decay) {
    const k = decay.toFixed(1);
    if (revCache[k]) return revCache[k];
    const len = Math.floor(ctx.sampleRate * decay), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return (revCache[k] = b);
  }
  function makeReverb(wet, _pre, decay, out) {
    if (!ctx) return null;
    const input = ctx.createGain(), dry = ctx.createGain(), wetG = ctx.createGain(), conv = ctx.createConvolver();
    conv.buffer = impulse(decay || 2);
    dry.gain.value = 1 - wet * 0.5; wetG.gain.value = wet;
    input.connect(dry); input.connect(conv); conv.connect(wetG);
    const dest = out || sfxBus;
    dry.connect(dest); wetG.connect(dest);
    setTimeout(() => { try { input.disconnect(); conv.disconnect(); } catch (e) {} }, (decay + 2) * 1000);
    return { input };
  }
  // shared reverb for frequent sounds (avoid allocating convolvers per shot)
  let sharedRev = null;
  function shared() {
    if (!sharedRev && ctx) {
      const input = ctx.createGain(), conv = ctx.createConvolver(), wet = ctx.createGain();
      conv.buffer = impulse(2.2); wet.gain.value = 0.35;
      input.connect(conv); conv.connect(wet); wet.connect(sfxBus);
      sharedRev = { input };
    }
    return sharedRev;
  }
  function makeComp(th, knee, ratio, att, rel) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = th; c.knee.value = knee; c.ratio.value = ratio;
    c.attack.value = att || 0.003; c.release.value = rel || 0.12;
    c.connect(sfxBus);
    setTimeout(() => { try { c.disconnect(); } catch (e) {} }, 3000);
    return c;
  }
  function distort(amount) {
    const ws = ctx.createWaveShaper(), n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (3 + amount) * x * 20 * Math.PI / 180 / (Math.PI + amount * Math.abs(x)); }
    ws.curve = curve;
    setTimeout(() => { try { ws.disconnect(); } catch (e) {} }, 3000);
    return ws;
  }
  function env(g, vol, t, att, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.max(0.001, att));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function osc(type, freq, dur, vol, dest, o) {
    o = o || {};
    const t = now() + (o.delay || 0), os = ctx.createOscillator(), g = ctx.createGain();
    os.type = type; os.frequency.setValueAtTime(freq, t);
    if (o.freqEnd) os.frequency.exponentialRampToValueAtTime(Math.max(10, o.freqEnd), t + dur);
    if (o.detune) os.detune.value = o.detune;
    env(g, vol, t, o.attack || 0.005, dur);
    os.connect(g); g.connect(dest || sfxBus);
    os.start(t); os.stop(t + dur + 0.05);
  }
  function fm(freq, ratio, idx, vol, dur, dest, o) {
    o = o || {};
    const t = now() + (o.delay || 0);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = o.carType || 'sine'; mod.type = o.modType || 'sine';
    car.frequency.setValueAtTime(freq, t);
    if (o.carrierFreqEnd) car.frequency.exponentialRampToValueAtTime(Math.max(10, o.carrierFreqEnd), t + dur);
    mod.frequency.setValueAtTime(freq * ratio, t);
    if (o.carrierFreqEnd) mod.frequency.exponentialRampToValueAtTime(Math.max(10, o.carrierFreqEnd * ratio), t + dur);
    mg.gain.setValueAtTime(freq * idx, t);
    if (o.modIndexEnd !== undefined) mg.gain.exponentialRampToValueAtTime(Math.max(0.01, freq * o.modIndexEnd), t + dur);
    mod.connect(mg); mg.connect(car.frequency);
    env(g, vol, t, o.attack || 0.004, dur);
    car.connect(g); g.connect(dest || sfxBus);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  function noise(dur, vol, dest, o) {
    o = o || {};
    const t = now() + (o.delay || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.filterType || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.Q || 1;
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + dur);
    env(g, vol, t, o.attack || 0.002, dur);
    src.connect(f); f.connect(g); g.connect(dest || sfxBus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  function kick(freq, dur, vol, dest, delay) {
    osc('sine', freq * 2.2, dur, vol, dest, { freqEnd: freq * 0.5, attack: 0.002, delay });
  }
  function gate(name, gap) {
    const t = performance.now();
    if (last[name] && t - last[name] < gap * 1000) return false;
    recent = recent.filter(x => t - x < 200);
    if (recent.length > 18) return false;
    last[name] = t; recent.push(t);
    return true;
  }

  const ELSHOT = {
    K: () => { noise(0.05, 0.05, null, { filterType: 'bandpass', freq: 2600, Q: 2 }); osc('square', 420, 0.04, 0.025, null, { freqEnd: 160 }); },
    T: () => { noise(0.07, 0.05, null, { filterType: 'bandpass', freq: 1400, Q: 2 }); fm(180, 3, 1.5, 0.03, 0.06, null, { carrierFreqEnd: 80 }); },
    C: () => { osc('sine', 1760, 0.06, 0.035, null, { freqEnd: 880 }); noise(0.05, 0.03, null, { filterType: 'highpass', freq: 5000, Q: 2 }); },
    A: () => { noise(0.04, 0.06, null, { filterType: 'highpass', freq: 6500, Q: 0.5 }); fm(600, 5, 3, 0.03, 0.05, null, { carrierFreqEnd: 200 }); },
    V: () => { fm(120, 4, 2, 0.04, 0.08, null, { carrierFreqEnd: 60 }); },
  };

  function play(name, arg) {
    if (!ctx || ctx.state !== 'running') return;
    const el = arg && arg.s ? arg.s.el : 'K';
    switch (name) {
      case 'ui': if (!gate(name, 0.03)) return; osc('square', 880, 0.04, 0.03, null, { freqEnd: 1320 }); break;
      case 'deny': if (!gate(name, 0.1)) return; osc('square', 180, 0.12, 0.05, null, { freqEnd: 110 }); break;
      case 'build': { if (!gate(name, 0.05)) return; const c = makeComp(-14, 5, 6); kick(70, 0.12, 0.3, c); fm(350, 5.5, 3, 0.15, 0.18, c, { carrierFreqEnd: 175, modIndexEnd: 0.1 }); noise(0.08, 0.12, c, { filterType: 'bandpass', freq: 3500, Q: 4 }); break; }
      case 'upgrade': { if (!gate(name, 0.05)) return; const r = shared(); [523, 659, 784].forEach((f, i) => fm(f, 2, 0.35, 0.12 - i * 0.02, 0.22, r.input, { delay: i * 0.06 })); break; }
      case 'reroll': { if (!gate(name, 0.05)) return; for (let i = 0; i < 5; i++) osc('square', 300 + Math.random() * 900, 0.05, 0.04, null, { delay: i * 0.04 }); break; }
      case 'sell': if (!gate(name, 0.05)) return; fm(660, 2, 0.6, 0.1, 0.18, null, { carrierFreqEnd: 330 }); break;
      case 'cash': { if (!gate(name, 0.08)) return; const r = shared(); [988, 1319, 1568, 1976].forEach((f, i) => { osc('square', f, 0.06, 0.05, r.input, { delay: i * 0.045 }); fm(f, 3, 0.4, 0.05, 0.12, r.input, { delay: i * 0.045 }); }); break; }
      case 'shot': if (!gate('shot' + el, 0.07)) return; (ELSHOT[el] || ELSHOT.K)(); break;
      case 'coreshot': if (!gate(name, 0.12)) return; fm(330, 2, 0.8, 0.04, 0.08, null, { carrierFreqEnd: 660 }); break;
      case 'rail': { if (!gate(name, 0.08)) return; const r = shared(); fm(1200, 10, 8, 0.07, 0.12, r.input, { carrierFreqEnd: 60, modIndexEnd: 0.2 }); noise(0.06, 0.08, null, { filterType: 'highpass', freq: 6000 }); break; }
      case 'pulse': if (!gate(name, 0.15)) return; fm(800, 2, 0.5, 0.06, 0.3, shared().input, { carrierFreqEnd: 2400, modIndexEnd: 0.05 }); break;
      case 'missile': if (!gate(name, 0.1)) return; noise(0.25, 0.05, null, { filterType: 'bandpass', freq: 900, Q: 1.5, freqEnd: 2600 }); break;
      case 'zap': if (!gate(name, 0.08)) return; noise(0.06, 0.07, null, { filterType: 'highpass', freq: 5000, Q: 0.6 }); fm(900, 6, 4, 0.04, 0.08, null, { carrierFreqEnd: 300 }); break;
      case 'flame': if (!gate(name, 0.18)) return; noise(0.2, 0.04, null, { filterType: 'bandpass', freq: 700, Q: 0.8 }); break;
      case 'mortar': if (!gate(name, 0.1)) return; kick(60, 0.1, 0.12, null); noise(0.12, 0.05, null, { filterType: 'lowpass', freq: 900 }); break;
      case 'grav': if (!gate(name, 0.2)) return; osc('sine', 80, 0.5, 0.12, null, { freqEnd: 30 }); fm(200, 0.5, 4, 0.05, 0.5, null, { carrierFreqEnd: 50 }); break;
      case 'boom': if (!gate(name, 0.06)) return; kick(52, 0.12, 0.18, null); noise(0.12, 0.12, null, { filterType: 'lowpass', freq: 700 }); break;
      case 'die': if (!gate(name, 0.04)) return; noise(0.07, 0.05, null, { filterType: 'bandpass', freq: 1800 + Math.random() * 1500, Q: 3 }); break;
      case 'freeze': if (!gate(name, 0.15)) return; fm(2200, 1.5, 0.3, 0.06, 0.14, shared().input, { carrierFreqEnd: 880 }); break;
      case 'combo': {
        if (!gate('combo' + arg, 0.12)) return;
        const r = shared();
        if (arg === 'SHATTER') { osc('triangle', 4400, 0.1, 0.07, r.input, { freqEnd: 600 }); noise(0.15, 0.08, r.input, { filterType: 'highpass', freq: 4000 }); }
        else if (arg === 'OVERLOAD') { kick(55, 0.18, 0.25, null); noise(0.25, 0.12, r.input, { filterType: 'bandpass', freq: 2200, Q: 1 }); }
        else if (arg === 'THERMAL SHOCK') { noise(0.3, 0.1, r.input, { filterType: 'highpass', freq: 2500, freqEnd: 600 }); }
        else if (arg === 'SUPERCONDUCT') { fm(1400, 4, 2, 0.06, 0.2, r.input, { carrierFreqEnd: 2800 }); }
        else if (arg === 'COLLAPSE') { osc('sine', 300, 0.4, 0.15, r.input, { freqEnd: 30 }); fm(400, 5, 6, 0.08, 0.4, r.input, { carrierFreqEnd: 20, modType: 'sawtooth' }); }
        break;
      }
      case 'leak': { if (!gate(name, 0.1)) return; const c = makeComp(-16, 6, 8); kick(90, 0.12, 0.35, c); noise(0.1, 0.2, c, { filterType: 'lowpass', freq: 900 }); break; }
      case 'bigleak': { const c = makeComp(-16, 6, 8); kick(45, 0.3, 0.6, c); const ds = distort(130); ds.connect(c); noise(0.3, 0.5, ds, { filterType: 'lowpass', freq: 500, Q: 1.5 }); break; }
      case 'wave': { const r = shared(); fm(440, 2, 0.8, 0.08, 0.35, r.input, { carrierFreqEnd: 880 }); fm(660, 1.5, 0.5, 0.06, 0.3, r.input, { carrierFreqEnd: 1320, delay: 0.1 }); break; }
      case 'bosswarn': case 'boss': { if (!gate('boss', 1)) return; const r = makeReverb(0.6, 0, 3); kick(30, 0.6, 0.6, r.input); fm(80, 4, 5, 0.25, 1.4, r.input, { carrierFreqEnd: 40, modIndexEnd: 0.5 }); noise(1.2, 0.2, r.input, { filterType: 'lowpass', freq: 600, freqEnd: 150 }); break; }
      case 'bossdie': { const r = makeReverb(0.55, 0, 3.5); [0, 0.06, 0.12, 0.18].forEach((d, i) => fm(330 * Math.pow(1.25, i), 3, 1.5, 0.15, 0.5, r.input, { delay: d, carrierFreqEnd: 660 * Math.pow(1.25, i) })); kick(40, 0.3, 0.5, r.input); noise(0.8, 0.25, r.input, { filterType: 'lowpass', freq: 1200, freqEnd: 200 }); break; }
      case 'call': fm(220, 2, 2, 0.1, 0.28, shared().input, { carrierFreqEnd: 1760, modIndexEnd: 0.1 }); break;
      case 'storm': { const r = shared(); fm(330, 2, 0.6, 0.06, 0.8, r.input, { carrierFreqEnd: 660, attack: 0.1 }); noise(0.8, 0.05, r.input, { filterType: 'bandpass', freq: 500, Q: 2, attack: 0.2 }); break; }
      case 'converge': { const r = makeReverb(0.5, 0, 2.5); fm(220, 3, 2, 0.15, 0.8, r.input, { carrierFreqEnd: 880 }); noise(0.6, 0.12, r.input, { filterType: 'highpass', freq: 1500 }); break; }
      case 'maelstrom': { const r = makeReverb(0.7, 0, 5); osc('sine', 30, 2.5, 0.5, r.input, { freqEnd: 55, attack: 0.02 }); kick(25, 0.5, 0.6, r.input); fm(80, 4, 5, 0.3, 1.5, r.input, { carrierFreqEnd: 40, modIndexEnd: 0.5 }); fm(220, 3, 2, 0.2, 0.8, r.input, { carrierFreqEnd: 880, delay: 0.4 }); break; }
      case 'implode': { const r = makeReverb(0.65, 0, 4); fm(400, 5, 6, 0.35, 0.8, r.input, { carrierFreqEnd: 10, modIndexEnd: 0.8, modType: 'sawtooth' }); noise(0.6, 0.35, r.input, { filterType: 'lowpass', freq: 1000, freqEnd: 30 }); kick(25, 0.3, 0.5, r.input, 0.3); break; }
      case 'lane': { const r = makeReverb(0.5, 0, 3); fm(110, 7, 4, 0.2, 0.6, r.input, { carrierFreqEnd: 220, modType: 'sawtooth' }); kick(40, 0.3, 0.4, r.input); break; }
      case 'milestone': { const r = shared(); [523, 659, 784, 1047].forEach((f, i) => fm(f, 2, 0.4, 0.1, 0.3, r.input, { delay: i * 0.07 })); break; }
      case 'levelup': { const r = makeReverb(0.5, 0, 3); [392, 523, 659, 784, 1047].forEach((f, i) => { fm(f, 2, 0.5, 0.12, 0.5, r.input, { delay: i * 0.08 }); osc('triangle', f * 2, 0.2, 0.04, r.input, { delay: i * 0.08 }); }); break; }
      case 'strikecharge': fm(220, 2, 2, 0.12, 0.6, shared().input, { carrierFreqEnd: 1760, modIndexEnd: 0.1 }); break;
      case 'strike': { const r = makeReverb(0.4, 0, 3); kick(50, 0.15, 0.8, r.input); const ds = distort(180); ds.connect(r.input); noise(0.05, 0.8, ds, { filterType: 'highpass', freq: 6000, Q: 0.4 }); fm(1200, 10, 8, 0.4, 0.1, ds, { carrierFreqEnd: 30, modIndexEnd: 0.2 }); noise(0.6, 0.4, ds, { filterType: 'bandpass', freq: 3000, Q: 1.5, delay: 0.04 }); break; }
      case 'nova': { const r = makeReverb(0.6, 0, 4); osc('sine', 60, 1.2, 0.5, r.input, { freqEnd: 30 }); fm(300, 3, 4, 0.25, 1, r.input, { carrierFreqEnd: 60 }); noise(1, 0.3, r.input, { filterType: 'lowpass', freq: 2000, freqEnd: 100 }); break; }
      case 'stasis': { const r = makeReverb(0.6, 0, 3.5); fm(800, 2, 0.5, 0.2, 0.6, r.input, { carrierFreqEnd: 2400, modIndexEnd: 0.05 }); osc('triangle', 4400, 0.4, 0.1, r.input, { freqEnd: 220 }); break; }
      case 'overclock': { const r = shared(); const ds = distort(60); ds.connect(r.input); fm(110, 7, 4, 0.18, 0.6, ds, { carrierFreqEnd: 440, modIndexEnd: 0.5, modType: 'sawtooth' }); break; }
      case 'emp': if (!gate(name, 0.2)) return; noise(0.3, 0.12, null, { filterType: 'bandpass', freq: 3000, Q: 3, freqEnd: 400 }); fm(110, 7, 4, 0.08, 0.3, null, { carrierFreqEnd: 55 }); break;
      case 'blink': if (!gate(name, 0.15)) return; fm(880, 3, 2.5, 0.08, 0.22, shared().input, { carrierFreqEnd: 220, modIndexEnd: 0.05 }); break;
      case 'quack': { if (!gate(name, 0.3)) return; const r = shared(); fm(520, 1.01, 3, 0.12, 0.13, r.input, { carrierFreqEnd: 340, modType: 'sawtooth' }); fm(500, 1.01, 3, 0.1, 0.16, r.input, { carrierFreqEnd: 300, modType: 'sawtooth', delay: 0.16 }); break; }
      case 'meow': { if (!gate(name, 0.4)) return; const r = shared(); fm(600, 2, 1.2, 0.1, 0.18, r.input, { carrierFreqEnd: 950 }); fm(950, 2, 1.2, 0.09, 0.3, r.input, { carrierFreqEnd: 480, delay: 0.16 }); break; }
      case 'whale': { if (!gate(name, 1)) return; const r = makeReverb(0.7, 0, 4); osc('sine', 180, 1.4, 0.12, r.input, { freqEnd: 260, attack: 0.3 }); osc('sine', 260, 1.2, 0.09, r.input, { freqEnd: 140, delay: 1.1, attack: 0.2 }); break; }
      case 'blorp': { if (!gate(name, 0.2)) return; osc('sine', 420, 0.18, 0.14, shared().input, { freqEnd: 70 }); break; }
      case 'crack': { const c = makeComp(-12, 6, 5); kick(42, 0.3, 0.5, c); noise(0.5, 0.5, c, { filterType: 'lowpass', freq: 700 }); break; }
      case 'unbreak': { const r = makeReverb(0.5, 0, 3); [262, 330, 392, 523].forEach((f, i) => fm(f, 2, 0.5, 0.18, 0.8, r.input, { delay: i * 0.05 })); break; }
      case 'gameover': { const r = makeReverb(0.7, 0, 5); fm(400, 5, 6, 0.35, 1.6, r.input, { carrierFreqEnd: 20, modIndexEnd: 0.8, modType: 'sawtooth' }); osc('sine', 55, 1.8, 0.5, r.input, { freqEnd: 18 }); break; }
    }
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

  return { init, play, setVolumes, setTrack, setSoundtrack, music: Music, bgm: BGM, get ready() { return !!ctx; } };
})();
