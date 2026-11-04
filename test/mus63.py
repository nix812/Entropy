"""6.3 music: variety inside each genre, and a theme for every boss.
usage: python3 mus63.py [variety|v1|bosses|samples|ui|all] [options]
  variety [N] [page.html]  for each genre, N songs (radio picks, seeded): mean pairwise distance per feature
                           (chord loop, drums, lead rhythm, lead contour, bass rhythm, instruments, tempo). Pass an older
                           build's dist html to measure it ("before").
  v1 [--write]             saved tracks from before 6.3 (no v) must play the same notes: compares note events with the
                           6.2.0 fixture in test/fixtures/mus63_v1.json (--write records it from the page given by V1PAGE).
  bosses                   renders every boss theme offline: level, peak (no clipping), no silence, distinct hooks; writes
                           test/out/mus63/boss_<id>.mp3
  samples                  before/after genre samples (needs the 6.2.0 html in BEFORE=path) -> test/out/mus63/
  ui                       Playwright: a boss on the field switches the music to its theme and back after the kill, with the
                           victory sting; Boss themes toggle; the Studio list unlocks with PROF.codex.bosses
"""
import json, sys, pathlib, base64, subprocess, math, os, itertools, wave
import mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'mus63'; out.mkdir(parents=True, exist_ok=True)
args = sys.argv[1:]; mode = args[0] if args else 'all'
checks, errs = [], []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name, flush=True)

def wrap(html_path, dest):
    """mkpage for any built entropy.html (an older build for 'before')"""
    body = pathlib.Path(html_path).read_text(); f = root / 'test' / 'fonts'
    ff = ('<style>@font-face{font-family:VT323;src:url(file://%s/vt323-latin-400-normal.woff2)}'
          '@font-face{font-family:Silkscreen;font-weight:400;src:url(file://%s/silkscreen-latin-400-normal.woff2)}</style>') % (f, f)
    pathlib.Path(dest).write_text('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1">' + ff +
                                  '</head><body>' + body + '</body></html>')
    return dest

# ---------------------------------------------------------------- variety
VAR_JS = '''([g, N, seed0]) => {
  const M = SFX.music; Math.random = mulberry32(seed0); // the radio's own picks (flavour, seed), reproducible
  const oc = new OfflineAudioContext(2, 44100, 44100); SFX.offlineCtx(oc); M.setConfig({ custom: true, genres: [g], energy: 0.6, follow: 0 });
  M.start(); M.renderAhead(0.5); let clock = 1; const songs = [];
  for (let i = 0; i < N; i++) {
    M.jump({ genre: g, start: 16 }); const p = M.piece; M.debug = true;
    const lenS = 16.5 * 4 * 60 / p.bpm; M.renderAhead(lenS + 0.4); // jump() restarts the clock at 0.34 s on an offline context
    const ev = M.events.filter(e => e[7] === p.genre + '/' + p.flav && e[5] >= 16 && e[5] < 32); M.debug = false;
    const bars = new Set(ev.map(e => e[5])).size || 1, cnt = {};
    for (const e of ev) if (e[1] === 'drums') { const k = e[2] + (e[5] % 2 ? 16 + e[6] : e[6]); cnt[k] = (cnt[k] || 0) + 1; }
    const drums = Object.keys(cnt).filter(k => cnt[k] / (bars / 2) > 0.45);
    const lead = ev.filter(e => e[1] === 'lead'), bass = ev.filter(e => e[1] === 'bass');
    const leadR = [...new Set(lead.map(e => (e[5] % 4) * 16 + e[6]))];
    const notes = lead.slice(0, 16).map(e => e[3]), contour = notes.slice(1).map((n, k) => Math.sign(n - notes[k]) + 1).join('');
    const bassR = [...new Set(bass.map(e => (e[5] % 2) * 16 + e[6]))];
    const insts = [...new Set(ev.filter(e => e[1] !== 'drums' && e[1] !== 'fx').map(e => e[1] + ':' + e[2]))];
    songs.push({ name: p.name, flav: p.flav, bpm: p.bpm, loop: p.mode + ' ' + M.numerals(p.loop, p.mode, p.loopQ), drums, leadR, contour, bassR, insts, key: p.key, v: (M.spec || {}).v || 1 });
  }
  return songs; }'''
def jacc(a, b):
    a, b = set(a), set(b)
    return 0.0 if not a and not b else 1 - len(a & b) / len(a | b)
def lev(a, b):
    if not a and not b: return 0.0
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, y in enumerate(b, 1): prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (x != y))
    return d[len(b)] / max(len(a), len(b))
FEATS = [('chords', lambda a, b: float(a['loop'] != b['loop'])), ('drums', lambda a, b: jacc(a['drums'], b['drums'])),
         ('leadRhythm', lambda a, b: jacc(a['leadR'], b['leadR'])), ('contour', lambda a, b: lev(a['contour'], b['contour'])),
         ('bass', lambda a, b: jacc(a['bassR'], b['bassR'])), ('instruments', lambda a, b: jacc(a['insts'], b['insts'])),
         ('tempo', lambda a, b: min(1.0, abs(a['bpm'] - b['bpm']) / 12))]
def variety(page, N, label):
    res = {}
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(page)); pg.wait_for_timeout(300)
        gids = pg.evaluate('() => SFX.music.GENRE_IDS')
        print(f'\n== variety ({label}, {N} songs per genre; mean pairwise distance 0..1, higher = more varied)')
        print(f"   {'genre':10s} " + ' '.join(f'{n[:7]:>7s}' for n, _ in FEATS) + '   overall  flavours')
        for g in gids:
            pg.reload(); pg.wait_for_timeout(150)
            songs = pg.evaluate(VAR_JS, [g, N, 1234])
            pairs = list(itertools.combinations(songs, 2)); row = {}
            for n, f in FEATS: row[n] = sum(f(a, b2) for a, b2 in pairs) / len(pairs)
            row['overall'] = sum(row[n] for n, _ in FEATS) / len(FEATS); row['flavours'] = len(set(s['flav'] for s in songs))
            res[g] = row
            print(f'   {g:10s} ' + ' '.join(f'{row[n]:7.2f}' for n, _ in FEATS) + f"   {row['overall']:6.2f}   {row['flavours']}", flush=True)
        b.close()
    mean = {n: sum(r[n] for r in res.values()) / len(res) for n, _ in FEATS + [('overall', 0)]}
    print(f"   {'MEAN':10s} " + ' '.join(f'{mean[n]:7.2f}' for n, _ in FEATS) + f"   {mean['overall']:6.2f}")
    res['MEAN'] = mean
    (out / f'variety_{label}.json').write_text(json.dumps(res, indent=1))
    return res

if mode in ('variety',):
    N = int(args[1]) if len(args) > 1 else 10
    if len(args) > 2: page = wrap(args[2], out / 'page_before.html'); label = 'before'
    else: mkpage.mk(); page = root / 'test' / 'out' / 'page.html'; label = 'after'
    variety(page, N, label)

# ---------------------------------------------------------------- v1: old saved tracks play the same notes
OLD_FLAVS = ['ambient/drift', 'ambient/glass', 'ambient/nocturne', 'lofi/jazzhop', 'lofi/rainy', 'downtempo/triphop', 'downtempo/chillout', 'synthwave/outrun', 'synthwave/dreamwave',
             'synthwave/darksynth', 'house/deep', 'house/disco', 'house/piano', 'techno/detroit', 'techno/minimal', 'techno/acid', 'trance/uplifting', 'trance/progressive', 'dnb/liquid',
             'dnb/roller', 'chiptune/nes', 'chiptune/gameboy', 'chiptune/saveroom', 'dub/onedrop', 'dub/rockers', 'dub/steppers']
V1_JS = '''(flavs) => {
  const M = SFX.music, oc = new OfflineAudioContext(2, 44100, 44100); SFX.offlineCtx(oc); M.setConfig({ custom: true, genres: ['lofi'], energy: 0.7, follow: 0 }); M.start(); M.renderAhead(0.5);
  const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
  const out = {}; let i = 0;
  const comp = { v: 1, genre: 'lofi', flav: 'jazzhop', seed: 9, name: 'T', mode: 'dorian', key: 2, loop: { degs: [0, 3, 4, 5], q: [], bars: 1 }, drums: M.drumsFor('lofi', 'jazzhop'), bass: ['sub', 'long'], lead: 'piano', mel: null, melSeed: 5, bpm: 88 };
  const specs = flavs.map(gf => ({ genre: gf.split('/')[0], flav: gf.split('/')[1], seed: 1000 + 37 * (i++), name: 'x' })).concat([{ genre: 'lofi', flav: 'jazzhop', seed: 9, name: 'T', comp }]);
  for (const sp of specs) { M.jump(Object.assign({ start: 0 }, sp)); M.debug = true; M.renderAhead(36); const ev = M.events; M.debug = false; const p = M.piece;
    out[sp.genre + '/' + sp.flav + (sp.comp ? '+comp' : '')] = { n: ev.length, h: h(JSON.stringify(ev)), key: p.key, bpm: p.bpm, loop: p.loop.join(), name: p.name }; }
  return out; }'''
def v1_events(page):
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(page)); pg.wait_for_timeout(300)
        r = pg.evaluate(V1_JS, OLD_FLAVS); b.close(); return r
if mode in ('v1', 'all'):
    fx = root / 'test' / 'fixtures' / 'mus63_v1.json'
    if '--write' in args:
        src = os.environ.get('V1PAGE'); r = v1_events(wrap(src, out / 'page_v1.html')); fx.write_text(json.dumps(r, indent=0)); print('wrote', fx, len(r))
    else:
        mkpage.mk(); want = json.loads(fx.read_text()); got = v1_events(root / 'test' / 'out' / 'page.html')
        bad = [k for k in want if want[k] != got.get(k)]
        for k in bad[:6]: print('   differs:', k, want[k], got.get(k))
        ok(f'tracks saved before 6.3 (no v) play the same notes as 6.2.0 ({len(want)} specs, 36 s each, incl. a composed song)', not bad)

# ---------------------------------------------------------------- shared offline render
REND_JS = '''async ([secs, cfg, plan, sr]) => {
  const oc = new OfflineAudioContext(2, Math.ceil(sr * (secs + 1)), sr), M = SFX.music; SFX.offlineCtx(oc); M.setConfig(cfg); M.debug = true; M.setIntensity(0.55); M.start();
  const errs = []; window.addEventListener('error', e => errs.push(String(e.message)));
  const marks = [];
  for (let t = 0; t < secs; t += 0.25) oc.suspend(t).then(() => { try {
      for (const a of plan) if (Math.abs(a[0] - t) < 0.01) { if (a[1] === 'boss') M.setBoss(a[2], a[3] || 0, a[4]); else if (a[1] === 'jump') M.jump(a[2]); else if (a[1] === 'int') M.setIntensity(a[2]); }
      if (M.piece) marks.push([t, M.piece.name, M.piece.section, M.piece.boss]);
      for (let k = 0; k < 6; k++) M.schedule(t + 0.5); } catch (e) { errs.push(String(e && e.stack || e)); } oc.resume(); });
  const buf = await oc.startRendering();
  const Lc = buf.getChannelData(0), Rc = buf.getChannelData(1), n = Lc.length, i16 = new Int16Array(n * 2); let pk = 0;
  for (let i = 0; i < n; i++) { pk = Math.max(pk, Math.abs(Lc[i]), Math.abs(Rc[i])); i16[2 * i] = Math.max(-1, Math.min(1, Lc[i])) * 32767; i16[2 * i + 1] = Math.max(-1, Math.min(1, Rc[i])) * 32767; }
  let str = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 32768) str += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  if (SFX.errors) errs.push('music: ' + SFX.errors + ' ' + JSON.stringify(SFX.lastError));
  return { wav: btoa(str), peak: pk, ev: M.events.length > 200000 ? [] : M.events, marks, errs, log: M.log };
}'''
def render(pg, secs, cfg, plan, sr=44100):
    import numpy as np
    pg.reload(); pg.wait_for_timeout(200)
    r = pg.evaluate(REND_JS, [secs, cfg, plan, sr])
    raw = base64.b64decode(r['wav']); a = np.frombuffer(raw, dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768
    return r, a, raw
def save_mp3(raw, path, sr=44100):
    wp = str(path) + '.wav'
    with wave.open(wp, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(raw)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wp, '-b:a', '128k', str(path)]); os.unlink(wp)
def lufs(a):
    import numpy as np, scipy.signal as ss
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]
    y = ss.lfilter(b2, a2, ss.lfilter(b1, a1, a, axis=0), axis=0)
    blk = 17640; ms = [np.mean(y[i:i + blk] ** 2, axis=0).sum() for i in range(0, len(y) - blk, blk // 4)]
    ms = np.array([m for m in ms if m > 0]); l = -0.691 + 10 * np.log10(ms + 1e-12); ms = ms[l > -70]
    if not len(ms): return -99
    g = -0.691 + 10 * np.log10(ms.mean()) - 10; ms2 = ms[-0.691 + 10 * np.log10(ms) > g]
    return round(-0.691 + 10 * np.log10(ms2.mean()), 1)
def rms_db(a, t0, t1, sr=44100):
    import numpy as np
    x = a[int(t0 * sr):int(t1 * sr)]; return 20 * math.log10(float(np.sqrt(np.mean(x ** 2))) + 1e-9)

# ---------------------------------------------------------------- boss themes
def hook_sig(h):
    toks = [t.split(':') for t in h.split()]; return [(int(a[0]), int(a[1])) for a in toks]
if mode in ('bosses', 'all'):
    import numpy as np
    mkpage.mk(); page = root / 'test' / 'out' / 'page.html'; ref = {}
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(page)); pg.wait_for_timeout(300)
        TH = pg.evaluate('() => { const T = SFX.music.BOSS_THEMES, o = {}; for (const k in T) o[k] = { name: T[k].name, title: T[k].title, bpm: T[k].bpm, mode: T[k].mode, lead: T[k].lead.kind, kit: T[k].kit, hook: T[k].hook }; return o; }')
        ok('13 boss themes, one per boss in BOSSES', pg.evaluate('() => BOSSES.every(B => SFX.music.BOSS_THEMES[B.id]) && SFX.music.BOSS_IDS.length === BOSSES.length'))
        # hooks: 4-8 notes in the first bar, and all different (interval and rhythm shape, so a transposed copy counts as the same)
        shapes = {}
        for k, t in TH.items():
            sg = hook_sig(t['hook']); bar1 = [x for x in sg if x[0] < 16]
            shapes[k] = tuple((sg[i][0], sg[i + 1][1] - sg[i][1]) for i in range(len(sg) - 1))
            if not (3 <= len(bar1) <= 8): ok(f'{k}: hook cell has 3 to 8 notes ({len(bar1)})', False)
        ok('every hook cell has 3 to 8 notes', all(3 <= len([x for x in hook_sig(t["hook"]) if x[0] < 16]) <= 8 for t in TH.values()))
        def hd(a, b2): return lev([str(x) for x in a], [str(x) for x in b2])
        mind = min((hd(shapes[a], shapes[b2]), a, b2) for a, b2 in itertools.combinations(shapes, 2))
        print(f'   closest pair of hooks: {mind[1]} / {mind[2]}, distance {mind[0]:.2f} (interval + rhythm edit distance, 0..1)')
        ok('every hook is distinct (pairwise distance at least 0.5)', mind[0] >= 0.5)
        for k in ('bpm', 'lead'):
            vals = [t[k] for t in TH.values()]; ok(f'every theme has its own {k}', len(set(vals)) == len(vals))
        # reference loudness: the genres at the same energy
        for gf in ['lofi/jazzhop', 'synthwave/outrun', 'techno/detroit', 'dnb/liquid', 'house/deep', 'trance/uplifting']:
            g, f = gf.split('/')
            r, a, raw = render(pg, 30, { 'custom': True, 'genres': [g], 'energy': 0.75, 'follow': 0.3 }, [[0, 'jump', { 'genre': g, 'flav': f, 'seed': 11, 'v': 2, 'start': 16 }]], 44100)
            ref[gf] = float(lufs(a[44100 * 2:]))
        print('   genre reference LUFS (energy 0.75):', ref)
        med = sorted(ref.values())[len(ref) // 2]; lo, hi = med - 2.5, med + 2.5
        rows = []
        for k, t in TH.items():
            # a fight: radio playing, the boss arrives at 3 s, phase II at 30 s, killed at 50 s, the radio is back after the sting
            plan = [[0, 'jump', { 'genre': 'lofi', 'flav': 'jazzhop', 'seed': 5 }], [3, 'boss', k, 0], [30, 'boss', k, 1], [50, 'boss', None, 0, True]]
            r, a, raw = render(pg, 60, { 'custom': True, 'genres': ['lofi'], 'energy': 0.6, 'follow': 0.5 }, plan)
            if r['errs']: print('   errors', k, r['errs'][:3])
            secs_in = [m for m in r['marks'] if m[3] == k]; t_in = secs_in[0][0] if secs_in else 99; t_out = secs_in[-1][0] if secs_in else 0
            L = lufs(a[int(44100 * 6):int(44100 * 49)]); pk = 20 * math.log10(max(r['peak'], 1e-9))
            quiet = min(rms_db(a, s0, s0 + 1) for s0 in range(6, 48))
            final = any(m[2] in ('Final', 'Pounce', 'Surface') for m in secs_in if m[0] > 30)
            vic = any(e[1] == 'fx' and e[2] == 'victory' for e in r['ev']); sting = any(e[1] == 'fx' and e[2] == 'stinger' for e in r['ev'])
            back = r['marks'][-1][3] is None
            rows.append((k, L, pk, quiet))
            print(f"   {k:9s} {t['title']:17s} {t['bpm']:3d} BPM {t['mode']:10s} lead {t['lead']:9s} LUFS {L:6.1f}  peak {pk:5.1f}  quietest 1 s {quiet:6.1f} dB  in {t_in:4.1f}s out {t_out:4.1f}s", flush=True)
            ok(f'{k}: theme plays from the stinger to the kill, phase II reaches Final, victory sting, radio back, no errors',
               t_in <= 4 and t_out >= 49 and final and vic and sting and back and not r['errs'])
            ok(f'{k}: level sits with the genres ({lo:.1f}..{hi:.1f} LUFS), no clipping (peak under -1 dBFS), no silence', lo <= L <= hi and pk < -1 and quiet > -45)
            save_mp3(raw, out / f'boss_{k}.mp3')
        b.close()
    (out / 'bosses.json').write_text(json.dumps({ 'ref': ref, 'rows': rows }, indent=1))
