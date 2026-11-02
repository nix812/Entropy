"""5.5.8 musician's pass: (1) the radio never pairs a chord loop with a mode that turns one of its chords diminished or augmented
by accident (2000 pieces across all genres); (2) in the Composer every mood offers only fitting progressions, a mood change keeps
the chords fitting, and the chord names carry no ° or +; (3) 'Fixed notes' melodies keep their pitch across chord changes while
'Follow chords' melodies move with them. usage: python3 harmony.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; mkpage.mk(); errs = []; checks = []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name)
def act(pg, sel): pg.evaluate('(s) => { const b = document.querySelector(s); if (!b) throw new Error("missing " + s); b.click(); }', sel); pg.wait_for_timeout(60)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 852, 'height': 393}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    r = pg.evaluate('''() => { const M = SFX.music, oc = new OfflineAudioContext(2, 44100, 44100); SFX.offlineCtx(oc); M.start(); M.renderAhead(0.5);
      let bad = [], n = 0;
      for (let i = 0; i < 200; i++) for (const g of M.GENRE_IDS) { M.setConfig({ custom: true, genres: [g] }); M.jump(null); const p = M.piece; n++;
        if (!M.loopOK({ degs: p.loop, q: p.loopQ }, p.mode)) bad.push(p.genre + '/' + p.flav + ' ' + p.mode + ' ' + M.numerals(p.loop, p.mode, p.loopQ)); }
      return { n, bad: [...new Set(bad)] }; }''')
    print('   radio pieces:', r['n'], 'bad:', r['bad'][:5])
    ok('the radio never lands on an accidental diminished or augmented chord', r['n'] >= 2000 and not r['bad'])
    b.close()
    # the Composer
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 852, 'height': 393}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; SFX.music.config.composer = true; }')
    pg.click('#bStudio'); pg.wait_for_timeout(500); act(pg, '[data-act=stTab][data-v=compose]')
    act(pg, '[data-act=cpStart][data-g=lofi][data-f=jazzhop]')
    seen, bad = 0, []
    for m in range(7):
        names = set()
        for k in range(14):
            st = pg.evaluate('() => { const d = SFX.music.config.draft; return [d.mode, SFX.music.loopOK(d.loop, d.mode), SFX.music.numerals(d.loop.degs, d.mode, d.loop.q)]; }')
            if k == 0 and m > 0 and st[0] == 'lydian' and 'V7' in st[2]: bad.append(['carried a forced-quality loop into a mood it was not written for'] + st)
            seen += 1; names.add(st[2])
            if not st[1] or '°' in st[2] or '+' in st[2]: bad.append(st)
            act(pg, '[data-act=cpStep][data-k=loop][data-v="1"]')
        print('   ', st[0], '·', len(names), 'progressions ·', ' | '.join(sorted(names))[:150])
        act(pg, '[data-act=cpStep][data-k=mood][data-v="1"]')
    ok('every mood offers only fitting progressions', seen >= 90 and not bad)
    if bad: print('   bad:', bad[:5])
    ok('Lydian offers its I–II', pg.evaluate('''() => { const d = SFX.music.config.draft; d.mode = 'lydian'; return SFX.music.numerals([0, 1], 'lydian', []) === 'I · II'; }'''))
    ok('chord names read like a musician writes them', pg.evaluate('''() => SFX.music.numerals([1, 4, 0, 0], 'ionian', ['m7', '7', 'M7', 'M7']) === 'ii7 · V7 · Imaj7 · Imaj7' && SFX.music.numerals([0, 5, 2, 6], 'aeolian', []) === 'i · ♭VI · ♭III · ♭VII' && SFX.music.numerals([0, 3], 'lydian', []) === 'I · ♯iv°' '''))
    # fixed notes
    act(pg, '[data-act=cpGrid][data-v=melody]')
    act(pg, '[data-act=cpMelAbs]')
    ok('Fixed notes names the rows after the key', pg.evaluate('() => { const d = SFX.music.config.draft, lab = [...document.querySelectorAll("#cpGridBox .cprow:not(.cph) > span")].map(e => e.textContent); return d.melAbs && lab.length === 8 && lab[7] === SFX.music.NOTE[d.key % 12]; }'))
    b.close()
    # pitch behaviour, offline
    b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    r = pg.evaluate('''() => { const M = SFX.music, oc = new OfflineAudioContext(2, 44100, 44100); SFX.offlineCtx(oc); let clock = 1; M.start(); M.renderAhead(clock);
      const run = abs => { const cp = { v: 1, genre: 'lofi', flav: 'jazzhop', seed: 9, name: 'T', mode: 'ionian', key: 0, loop: { degs: [0, 3, 4, 5], q: [], bars: 1 }, drums: M.drumsFor('lofi', 'jazzhop'), bass: ['sub', 'long'], lead: 'piano', mel: [2, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], melAbs: abs, melSeed: 1, bpm: 90 };
        M.setConfig({ custom: true, genres: ['lofi'], energy: 0.1 }); M.skip({ genre: 'lofi', flav: 'jazzhop', seed: 9, name: 'T', comp: cp, start: 8 }); clock += 4; M.renderAhead(clock);
        M.debug = true; clock += 14; M.renderAhead(clock); const ev = M.events.filter(e => e[1] === 'lead' && e[7] === 'lofi/jazzhop' && e[6] === 0); M.debug = false;
        return [...new Set(ev.map(e => e[3] % 12))]; };
      return { fixed: run(true), follow: run(false) }; }''')
    print('   pitch classes on step 1 across C · F · G · Am:', r)
    ok('a fixed note keeps its pitch across chord changes (E in C major)', r['fixed'] == [4])
    ok('a following note moves with the chords', len(r['follow']) >= 3)
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', [n for n, v in checks if not v])
