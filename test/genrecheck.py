"""v4.8 genre truth check. For every genre flavour: render offline with the Studio forced to it, log every note event, and
compare against the genre spec from docs/music-research.md: tempo (events and audio beat tracking), where kick/snare/hats land
on the 16-step grid, how diatonic the chords and lead are, loudness (LUFS) and brightness. Also checks that the Studio knobs
audibly do what they say (Energy -> density, Reverb -> tail, Echo -> repeats, Tone -> brightness, Tape -> wobble/noise, Pump).
usage: python3 genrecheck.py [secs] [genre/flav,...] [--knobs] [--mp3]"""
import json, sys, pathlib, base64, subprocess, math, collections
import numpy as np
import mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'genres'; out.mkdir(parents=True, exist_ok=True)
args = [a for a in sys.argv[1:] if not a.startswith('--')]
secs = float(args[0]) if args else 40
only = args[1].split(',') if len(args) > 1 else None
KNOBS = '--knobs' in sys.argv; MP3 = '--mp3' in sys.argv
mkpage.mk()
JS = '''async ([secs, cfg, force]) => {
  const sr = 44100, oc = new OfflineAudioContext(2, Math.ceil(sr * (secs + 3)), sr);
  SFX.offlineCtx(oc); SFX.music.setConfig(cfg); SFX.music.debug = true; SFX.music.setIntensity(0.4); SFX.music.start();
  if (force) SFX.music.skip(force);
  for (let t = 0; t < secs; t += 0.25) oc.suspend(t).then(() => { for (let k = 0; k < 6; k++) SFX.music.schedule(t + 0.5); oc.resume(); });
  const buf = await oc.startRendering();
  const Lc = buf.getChannelData(0), Rc = buf.getChannelData(1), n = Lc.length, i16 = new Int16Array(n * 2); let pk = 0;
  for (let i = 0; i < n; i++) { pk = Math.max(pk, Math.abs(Lc[i]), Math.abs(Rc[i])); i16[2 * i] = Math.max(-1, Math.min(1, Lc[i])) * 32767; i16[2 * i + 1] = Math.max(-1, Math.min(1, Rc[i])) * 32767; }
  let str = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 32768) str += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return { wav: btoa(str), peak: pk, ev: SFX.music.events, piece: SFX.music.piece, log: SFX.music.log };
}'''
def render(pg, cfg, force, tag):
    pg.reload(); pg.wait_for_timeout(250)
    r = pg.evaluate(JS, [secs, cfg, force])
    raw = base64.b64decode(r['wav']); a = np.frombuffer(raw, dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768
    if MP3:
        import wave
        wp = out / f'{tag}.wav'
        with wave.open(str(wp), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100); w.writeframes(raw)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wp), '-b:a', '160k', str(out / f'{tag}.mp3')]); wp.unlink()
    return r, a
def lufs(a):
    import scipy.signal as ss
    # K-weighting (BS.1770): high shelf + high pass, then gated mean square
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]
    y = ss.lfilter(b2, a2, ss.lfilter(b1, a1, a, axis=0), axis=0)
    blk = 17640; ms = [np.mean(y[i:i + blk] ** 2, axis=0).sum() for i in range(0, len(y) - blk, blk // 4)]
    ms = np.array([m for m in ms if m > 0]); l = -0.691 + 10 * np.log10(ms + 1e-12); ms = ms[l > -70]
    if not len(ms): return -99
    g = -0.691 + 10 * np.log10(ms.mean()) - 10; ms2 = ms[-0.691 + 10 * np.log10(ms) > g]
    return round(-0.691 + 10 * np.log10(ms2.mean()), 1)
def centroid(a):
    m = a.mean(1); cs = []
    for i in range(0, len(m) - 44100, 44100):
        f = np.abs(np.fft.rfft(m[i:i + 44100])); fr = np.fft.rfftfreq(44100, 1 / 44100); cs.append((f * fr).sum() / max(f.sum(), 1e-9))
    return int(np.median(cs)) if cs else 0
def audio_tempo(a):
    try:
        import librosa
        y = librosa.resample(a.mean(1), orig_sr=44100, target_sr=22050)
        t, _ = librosa.beat.beat_track(y=y, sr=22050); return float(np.atleast_1d(t)[0])
    except Exception as e: return -1
def grid(ev, voice):
    h = collections.Counter(); bars = set()
    for e in ev:
        if e[1] == 'drums' and e[2] == voice: h[e[6]] += 1; bars.add(e[5])
    nb = max(1, len(bars)); return ''.join(('X' if h[i] / nb > 0.66 else 'x' if h[i] / nb > 0.25 else '.' if h[i] == 0 else ',') for i in range(16)), sum(h.values())
def diatonic(ev, role, mode_pcs, root):
    ns = [e[3] for e in ev if e[1] == role and e[3] is not None]
    if not ns: return None
    return round(sum(1 for n in ns if (n - root) % 12 in mode_pcs) / len(ns), 2)
MODES = { 'ionian': [0, 2, 4, 5, 7, 9, 11], 'dorian': [0, 2, 3, 5, 7, 9, 10], 'phrygian': [0, 1, 3, 5, 7, 8, 10], 'lydian': [0, 2, 4, 6, 7, 9, 11], 'mixolydian': [0, 2, 4, 5, 7, 9, 10], 'aeolian': [0, 2, 3, 5, 7, 8, 10], 'harmonic': [0, 2, 3, 5, 7, 8, 11] }
report = {}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    flavs = pg.evaluate('() => SFX.music.GENRE_IDS.flatMap(g => Object.keys(SFX.music.GENRES[g].flavours).map(f => g + "/" + f))')
    if only: flavs = [f for f in flavs if f in only or f.split('/')[0] in only]
    for gf in flavs:
        g, f = gf.split('/')
        cfg = { 'custom': True, 'genres': [g], 'energy': float(__import__('os').environ.get('ENERGY', 0.62)), 'follow': 0 }
        r, a = render(pg, cfg, { 'genre': g, 'flav': f, 'seed': 12345 }, f'{g}_{f}')
        ev = [e for e in r['ev'] if e[7] == gf]
        pc = r['piece'] or {}
        kt = sorted(e[0] for e in ev if e[1] == 'drums' and e[2] == 'K')
        bars = sorted(set(e[5] for e in ev)); bar_t = {}
        for e in ev: bar_t.setdefault(e[5], []).append(e[0])
        spb = None
        if len(bars) > 3:
            starts = [min(t for t, s in [(e[0], e[6]) for e in ev if e[5] == bb] if True) for bb in bars[1:4]]
        rows = { v: grid(ev, v) for v in ['K', 'S', 'C', 'H', 'O', 'R', 'D', 'P'] }
        mode = pc.get('mode'); rootn = pc.get('root')
        rep = { 'piece': f"{pc.get('name')} · {pc.get('key')} · {pc.get('bpm')} BPM", 'bpm': pc.get('bpm'), 'audio_bpm': round(audio_tempo(a), 1),
                'lufs': lufs(a), 'peak_db': round(20 * math.log10(max(r['peak'], 1e-9)), 1), 'centroid': centroid(a),
                'grid': { k: v[0] for k, v in rows.items() if v[1] }, 'counts': collections.Counter(e[1] for e in ev),
                'keys_diatonic': diatonic(ev, 'keys', MODES.get(mode, []), rootn), 'lead_diatonic': diatonic(ev, 'lead', MODES.get(mode, []), rootn),
                'bass_diatonic': diatonic(ev, 'bass', MODES.get(mode, []), rootn) }
        report[gf] = rep
        print(f"\n== {gf}: {rep['piece']}  (audio tempo {rep['audio_bpm']})  LUFS {rep['lufs']}  peak {rep['peak_db']}  centroid {rep['centroid']} Hz")
        for k, v in rep['grid'].items(): print(f"   {k}: {v}")
        print('   events', dict(rep['counts']), ' diatonic keys/lead/bass', rep['keys_diatonic'], rep['lead_diatonic'], rep['bass_diatonic'])
    if KNOBS:
        print('\n== knobs (house/deep and lofi/jazzhop, 30 s each)')
        for gf in (only or ['house/deep', 'lofi/jazzhop', 'dub/onedrop']):
            g, f = gf.split('/'); base = { 'custom': True, 'genres': [g], 'energy': 0.6, 'follow': 0 }
            res = {}
            for name, ch in [('base', {}), ('energy0.1', { 'energy': 0.1 }), ('energy0.95', { 'energy': 0.95 }), ('reverb0', { 'fx': { 'reverb': 0 } }), ('reverb1', { 'fx': { 'reverb': 1 } }),
                             ('echo0', { 'fx': { 'echo': 0 } }), ('echo1', { 'fx': { 'echo': 1 } }), ('tone0', { 'fx': { 'tone': 0 } }), ('tone1', { 'fx': { 'tone': 1 } }), ('tape0', { 'fx': { 'tape': 0 } }), ('tape1', { 'fx': { 'tape': 1 } }), ('pump0', { 'fx': { 'pump': 0 }, 'mute': { 'drums': True } }), ('pump1', { 'fx': { 'pump': 1 }, 'mute': { 'drums': True } })]:
                cfg = dict(base); cfg.update(ch); print('  knob', name, flush=True)
                old = secs; secs = 24
                r, a = render(pg, cfg, { 'genre': g, 'flav': f, 'seed': 777 }, f'knob_{g}_{name}')
                secs = old
                ev = r['ev']; m = a.mean(1)
                # tail: energy in the 30 ms .. 400 ms after each drum hit relative to the hit (reverb/echo), pump: envelope modulation of non-drum part
                env = np.sqrt(np.convolve(m ** 2, np.ones(441) / 441, 'same'))
                mod = float(np.std(env[44100:]) / (np.mean(env[44100:]) + 1e-9))
                res[name] = { 'events/s': round(len(ev) / 24, 1), 'lufs': lufs(a), 'centroid': centroid(a), 'mod': round(mod, 3),
                              'noise_floor_db': round(20 * math.log10(np.percentile(env[44100:], 3) + 1e-9), 1) }
            print(gf); [print(f'   {k:12s}', v) for k, v in res.items()]
            report['knobs_' + gf] = res
    b.close()
(out / 'report.json').write_text(json.dumps(report, indent=1, default=str))
