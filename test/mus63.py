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
def lufs_sr(a, sr):
    import scipy.signal as ss
    return lufs(ss.resample_poly(a, 44100 // sr, 1, axis=0)) if sr != 44100 else lufs(a)
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
            notes = [e[3] for e in r['ev'] if e[1] == 'lead' and e[2] == t['lead'] and e[7] == 'boss/' + k and 4 < e[0] < 30]
            hk = [int(x.split(':')[1]) for x in t['hook'].split() if not x.endswith(':m')][:4]; want = [hk[i + 1] - hk[i] for i in range(3)]
            got = [notes[i + 1] - notes[i] for i in range(len(notes) - 1)]; reps = sum(1 for i in range(len(got) - 2) if got[i:i + 3] == want)
            ok(f'{k}: the hook is heard, and it repeats ({reps} times in 26 s)', reps >= 2)
            rows.append((k, L, pk, quiet))
            print(f"   {k:9s} {t['title']:17s} {t['bpm']:3d} BPM {t['mode']:10s} lead {t['lead']:9s} LUFS {L:6.1f}  peak {pk:5.1f}  quietest 1 s {quiet:6.1f} dB  in {t_in:4.1f}s out {t_out:4.1f}s", flush=True)
            ok(f'{k}: theme plays from the stinger to the kill, phase II reaches Final, victory sting, radio back, no errors',
               t_in <= 4 and t_out >= 49 and final and vic and sting and back and not r['errs'])
            ok(f'{k}: level sits with the genres ({lo:.1f}..{hi:.1f} LUFS), no clipping (peak under -1 dBFS), no silence', lo <= L <= hi and pk < -1 and quiet > -45)
            save_mp3(raw, out / f'boss_{k}.mp3')
        b.close()
    (out / 'bosses.json').write_text(json.dumps({ 'ref': ref, 'rows': rows }, indent=1))

# ---------------------------------------------------------------- ui: a real run
SPAWN = '''(id) => { const B = BOSSES.find(b => b.id === id), L = G.map.lanes[0]; const e = spawnBoss({ boss: id, lane: L, L: B.fly ? L.fly || L : L, hpm: 1, d: 4 }); return !!e; }'''
KILL = '''(id) => { for (let k = 0; k < 8; k++) for (const e of G.enemies.slice()) if (e.boss === id && !e.dead) { e.phaseT = 0; e.asleep = 0; hit(e, e.hp + e.shield + 1e9, "K", null, { noStatus: 1 }); } return true; }''' # phases hold the hp at each threshold: hit until dead
def dismiss(pg):
    pg.evaluate('() => { const b = document.querySelector("#modal [data-act=brief], #modal [data-act=close]"); if (b) b.click(); }')
if mode in ('ui', 'all'):
    mkpage.mk(); page = root / 'test' / 'out' / 'page.html'
    for W, H in [(852, 393), (667, 375)]:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
            pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True); pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto('file://' + str(page)); pg.wait_for_timeout(400)
            pg.evaluate('() => { PROF.bestWave = 40; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; PROF.codex.bosses = {}; PROF.settings.briefs = "off"; UI.renderHangar(); }')
            if W == 667: # 6.6.1: a boss reported before the music starts (no tap yet) plays its theme once the music starts
                pg.evaluate('() => SFX.music.setBoss("cat", 0)'); pg.mouse.click(300, 200); pg.wait_for_timeout(500)
                ok('a boss that came before the first tap gets its theme when the music starts', pg.evaluate('() => SFX.music.piece && SFX.music.piece.boss') == 'cat')
                pg.evaluate('() => SFX.music.setBoss(null, 0)'); pg.wait_for_timeout(300)
            else: pg.mouse.click(300, 200)
            pg.wait_for_timeout(300)
            if W == 852:
                pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(600); dismiss(pg)
                pg.evaluate('() => { G.next = 999; G.paused = false; }'); pg.wait_for_timeout(1500)
                radio = pg.evaluate('() => SFX.music.piece.name'); v = pg.evaluate('() => SFX.music.piece.v')
                ok(f'a run plays the radio ({radio}), new songs are version 2', v == 2 and not pg.evaluate('() => SFX.music.piece.boss'))
                pg.evaluate(SPAWN, 'cat'); pg.wait_for_timeout(1200); dismiss(pg)
                st = pg.evaluate('() => { const p = SFX.music.piece; return [p.boss, p.name, p.genreName, p.flavName, SFX.music.boss]; }')
                ok(f'Leia on the field switches to her theme ({st[1]})', st[0] == 'cat' and st[1] == 'Couch Shredder' and st[2] == 'Boss theme')
                pg.evaluate('() => { document.querySelector("#bMusic").click(); }'); pg.wait_for_timeout(300)
                ok('the battlefield music deck names the boss theme', 'Couch Shredder' in pg.evaluate('() => document.querySelector("#mdName").textContent'))
                pg.screenshot(path=str(out / f'ui_deck_{W}.png'))
                pg.evaluate('() => { const e = G.enemies.find(e => e.boss === "cat"); hit(e, e.maxHp * 0.5, "K", null, { noStatus: 1 }); }'); pg.wait_for_timeout(600)
                ok('a boss phase reaches the music', pg.evaluate('() => SFX.music.bossPhase') >= 1)
                # 6.6.1: leaving Compose during the fight goes back to the boss theme, not a new radio song
                pg.evaluate('() => UI._dbg.openStudio("game")'); pg.wait_for_timeout(500)
                pg.evaluate('() => { const b = [...document.querySelectorAll("#modal [data-act]")].find(b => /tab/i.test(b.dataset.act) && b.dataset.v === "compose"); b && b.click(); }'); pg.wait_for_timeout(400)
                pg.evaluate('() => { const b = document.querySelector("#modal [data-act=stClose]"); b && b.click(); }'); pg.wait_for_timeout(600); dismiss(pg)
                ok('leaving Compose mid-fight returns to the boss theme', pg.evaluate('() => SFX.music.piece.boss') == 'cat')
                pg.evaluate('() => { SFX.music.debug = true; }')
                pg.evaluate(KILL, 'cat'); pg.wait_for_timeout(1500); dismiss(pg)
                st = pg.evaluate('() => { const p = SFX.music.piece; return [p.boss, p.name, (SFX.music.events || []).some(e => e[2] === "victory")]; }'); pg.evaluate('() => { SFX.music.debug = false; }')
                ok(f'after the kill: victory sting, and the interrupted song comes back ({st[1]})', st[0] is None and st[1] == radio and st[2])
                ok('the kill unlocks the theme (PROF.codex.bosses)', pg.evaluate('() => PROF.codex.bosses.cat >= 1'))
                # Gloop splits keep one theme; two bosses: the first one's theme
                pg.evaluate(SPAWN, 'gloop'); pg.wait_for_timeout(1000); dismiss(pg)
                pg.evaluate('() => { const e = G.enemies.find(e => e.boss === "gloop" && !e.gen); e.phaseT = 0; hit(e, e.hp + 1e9, "K", null, { noStatus: 1 }); }'); pg.wait_for_timeout(800); dismiss(pg)
                st = pg.evaluate('() => [SFX.music.piece.boss, G.enemies.filter(e => e.boss === "gloop" && !e.dead).length]')
                ok(f'Gloop splits ({st[1]} on the field) keep the Gloop theme playing', st[0] == 'gloop' and st[1] >= 1)
                for _ in range(3): pg.evaluate(KILL, 'gloop'); pg.wait_for_timeout(500); dismiss(pg)
                pg.wait_for_timeout(800)
                ok('the last Gloop down ends the theme', pg.evaluate('() => !SFX.music.piece.boss && !G.enemies.some(e => e.boss && !e.dead)'))
                pg.evaluate(SPAWN, 'behemoth'); pg.wait_for_timeout(500); pg.evaluate(SPAWN, 'titan'); pg.wait_for_timeout(1000); dismiss(pg)
                ok('two bosses: the first one\'s theme plays', pg.evaluate('() => SFX.music.piece.boss') == 'behemoth')
                pg.evaluate(KILL, 'behemoth'); pg.wait_for_timeout(1200); dismiss(pg)
                ok('the first boss down: the second boss\'s theme takes over', pg.evaluate('() => SFX.music.piece.boss') == 'titan')
                pg.evaluate(KILL, 'titan'); pg.wait_for_timeout(1200); dismiss(pg)
                # switch off: the radio keeps playing
                pg.evaluate('() => { SFX.music.config.bossThemes = false; }'); name0 = pg.evaluate('() => SFX.music.piece.name')
                pg.evaluate(SPAWN, 'duck'); pg.wait_for_timeout(1200); dismiss(pg)
                ok('Boss themes off: the radio keeps playing during a boss', pg.evaluate('() => !SFX.music.piece.boss') and pg.evaluate('() => SFX.music.piece.name') == name0)
                pg.evaluate(KILL, 'duck'); pg.wait_for_timeout(800); dismiss(pg)
                pg.evaluate('() => { SFX.music.config.bossThemes = true; }')
                # a kept track from before 6.3 (no v) and a boss theme as a kept track and a code
                pg.evaluate('() => { const M = SFX.music; M.config.custom = true; M.config.favs.unshift({ seed: 4242, genre: "lofi", flav: "jazzhop", name: "Old Keep", at: 1 }); M.jump(M.config.favs[0]); }'); pg.wait_for_timeout(300)
                ok('a track kept before 6.3 plays on the old generator (v 1)', pg.evaluate('() => SFX.music.piece.v === 1 && SFX.music.piece.name === "Old Keep"'))
                pg.evaluate('() => { const M = SFX.music; M.jump({ boss: "cat" }); }'); pg.wait_for_timeout(300)
                r = pg.evaluate('''async () => { const M = SFX.music, f = M.save(); if (!f) return 'no save'; const code = await UI._trackCode(f); const back = await UI._readTrackCode(code); return [f.boss, back && back.boss, M.isSaved()]; }''')
                ok(f'a boss theme can be kept, and its code keeps the boss ({r})', r == ['cat', 'cat', True])
                pg.evaluate('() => { G.paused = true; }')
                pg.evaluate('() => { UI.act ? 0 : 0; }')
            # Studio: list and switch (from the hangar; Leia and Gloop beaten in the run above at 852, fixed codex at 667)
            if W != 852: pg.evaluate('() => { PROF.codex.bosses = { cat: 1, gloop: 2, duck: 1 }; }')
            pg.evaluate('() => { Save.save(); }'); pg.reload(); pg.wait_for_timeout(500)
            pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; }')
            pg.evaluate('() => { const b = document.querySelector("#bStudio"); if (b) b.click(); }'); pg.wait_for_timeout(500)
            n_on = pg.evaluate('() => document.querySelectorAll(".stboss [data-act=stBossP]").length'); n_all = pg.evaluate('() => document.querySelectorAll(".stboss .cpsty").length')
            ok(f'{W}x{H}: Studio Listen lists 13 boss themes, the beaten ones playable ({n_on})', n_all == 13 and n_on >= 2)
            pg.evaluate('() => document.querySelector(".stboss").scrollIntoView()'); pg.wait_for_timeout(150)
            pg.screenshot(path=str(out / f'ui_studio_{W}.png'))
            spill = pg.evaluate('() => { const b = document.querySelector(".stboss").getBoundingClientRect(), c = document.querySelector(".stlisten").getBoundingClientRect(); return b.right - c.right; }')
            ok(f'{W}x{H}: the boss list fits the Studio (no sideways spill: {spill:.0f}px)', spill <= 1)
            pg.evaluate('() => document.querySelector(".stboss [data-act=stBossP]").click()'); pg.wait_for_timeout(500)
            ok(f'{W}x{H}: tapping a theme plays it', pg.evaluate('() => !!SFX.music.piece.boss'))
            pg.evaluate('() => document.querySelector("[data-act=stBossT]").click()'); pg.wait_for_timeout(200)
            ok(f'{W}x{H}: the switch turns boss themes off and saves it', pg.evaluate('() => PROF.settings.studio.bossThemes === false && /Off/.test(document.querySelector("[data-act=stBossT]").textContent)'))
            pg.evaluate('() => document.querySelector("[data-act=stBossT]").click()'); pg.wait_for_timeout(200)
            pg.evaluate('() => document.querySelector("[data-act=stHelp]").click()'); pg.wait_for_timeout(300)
            txt = pg.evaluate('() => (document.querySelector(".sthelp") || {}).textContent || ""')
            ok(f'{W}x{H}: the ? help explains boss themes and variety', 'Play in boss fights' in txt and 'Variety' in txt)
            pg.screenshot(path=str(out / f'ui_help_{W}.png'))
            b.close()

# ---------------------------------------------------------------- perf: boss themes (same measure as perfcheck.py)
if mode in ('perf', 'all'):
    import time
    mkpage.mk(); worst = 0
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
        for k in pg.evaluate('() => SFX.music.BOSS_IDS'):
            pg.reload(); pg.wait_for_timeout(200)
            r = pg.evaluate('''async ([secs, k]) => { const sr = 44100, oc = new OfflineAudioContext(2, sr * secs, sr); SFX.offlineCtx(oc);
              SFX.music.setConfig({ custom: true, genres: ['lofi'], energy: 0.85, follow: 0 }); SFX.music.start(); SFX.music.jump({ boss: k, start: 8 });
              const t0 = performance.now(); let js = 0;
              for (let t = 0; t < secs; t += 0.25) oc.suspend(t).then(() => { const a = performance.now(); for (let q = 0; q < 6; q++) SFX.music.schedule(t + 0.5); js += performance.now() - a; oc.resume(); });
              await oc.startRendering(); return { total: (performance.now() - t0) / 1000, js: js / 1000 }; }''', [16, k])
            x = r['total'] / 16; worst = max(worst, x)
            print(f"   {k:9s} render {x:5.2f}x realtime   (JS scheduling {r['js'] / 16 * 100:4.1f}%)", flush=True)
        b.close()
    ok(f'boss themes render well under realtime (worst {worst:.2f}x; genres measure 0.15 to 0.42x)', worst < 0.45)

# ---------------------------------------------------------------- samples: before / after, two songs of one genre back to back
if mode in ('samples',):
    before = os.environ.get('BEFORE'); mkpage.mk()
    pages = [('after', root / 'test' / 'out' / 'page.html')] + ([('before', wrap(before, out / 'page_before.html'))] if before else [])
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, page in pages:
            pg = b.new_page(); pg.goto('file://' + str(page)); pg.wait_for_timeout(300)
            for g in ['lofi', 'synthwave', 'house', 'dnb']:
                plan = [[0, 'jump', { 'genre': g, 'start': 16 }], [24, 'jump', { 'genre': g, 'start': 16 }], [48, 'jump', { 'genre': g, 'start': 16 }]]
                r, a, raw = render(pg, 72, { 'custom': True, 'genres': [g], 'energy': 0.7, 'follow': 0 }, plan)
                names = []; [names.append(f"{m[1]}") for m in r['marks'] if not names or names[-1] != m[1]]
                save_mp3(raw, out / f'genre_{g}_{label}.mp3'); print(f'   {label:6s} {g:9s} three songs, 24 s each:', ' / '.join(names), flush=True)
            pg.close()
        b.close()

# ---------------------------------------------------------------- levels: v2 songs keep the genre's loudness (spread vs version 1)
if mode in ('levels', 'all'):
    import statistics
    mkpage.mk(); rows = {}
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
        for g in (args[1].split(',') if len(args) > 1 else ['lofi', 'synthwave', 'techno', 'trance', 'dnb', 'dub']):
            for v in (1, 2):
                Ls = []
                for sd in range(8):
                    flav = pg.evaluate('(g) => Object.keys(SFX.music.GENRES[g].flavours)', g)[sd % 4] # the same flavours and seeds on both generators
                    r, a, raw = render(pg, 20, { 'custom': True, 'genres': [g], 'energy': 0.65, 'follow': 0 }, [[0, 'jump', { 'genre': g, 'flav': flav, 'seed': 77 + sd * 13, 'v': v, 'start': 16 }]], 22050)
                    Ls.append(float(lufs_sr(a, 22050)))
                rows[(g, v)] = Ls
            d1, d2 = rows[(g, 1)], rows[(g, 2)]
            print(f'   {g:9s} v1 mean {statistics.mean(d1):6.1f} range {max(d1) - min(d1):4.1f} dB   v2 mean {statistics.mean(d2):6.1f} range {max(d2) - min(d2):4.1f} dB   v1', [round(x, 1) for x in d1], 'v2', [round(x, 1) for x in d2], flush=True)
        b.close()
    rng = lambda x: max(x) - min(x)
    ok('v2 songs keep the loudness of version 1 (same flavours and seeds): mean within 2 dB; spread under 6 dB or at most 3 dB wider than v1',
       all(abs(statistics.mean(rows[(g, 2)]) - statistics.mean(rows[(g, 1)])) < 2 and rng(rows[(g, 2)]) <= max(6, rng(rows[(g, 1)]) + 3) for g, v in rows if v == 2))
