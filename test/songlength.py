"""5.5.9 song length: per genre and setting, how long a piece lasts; a seeded piece keeps its key, chords and name at every length;
a Standard trance piece runs intro, breakdown, drop and outro in order; the Shape tab switch persists. usage: python3 songlength.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; mkpage.mk(); errs = []; checks = []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    r = pg.evaluate('''() => { const M = SFX.music, oc = new OfflineAudioContext(2, 44100, 44100); SFX.offlineCtx(oc); M.start(); M.renderAhead(0.5);
      const rows = [], same = [];
      for (const g of M.GENRE_IDS) { const row = { g }; let ref = null;
        for (const L of ['short', 'standard', 'long']) { M.setConfig({ custom: true, genres: [g], length: L }); M.jump({ genre: g, flav: Object.keys(M.GENRES[g].flavours)[0], seed: 4242 }); const p = M.piece;
          row[L] = Math.round(p.bars * 4 * 60 / p.bpm); const sig = [p.key, p.loop.join(), p.name, p.flav].join('|'); if (ref && sig !== ref) same.push(g + ' ' + L); ref = ref || sig; }
        rows.push(row); }
      // a trance piece at Standard, section by section
      M.setConfig({ custom: true, genres: ['trance'], length: 'standard', energy: 0.6 }); M.jump({ genre: 'trance', flav: 'uplifting', seed: 7 });
      const secs = []; let clock = 1, guard = 0; const name0 = M.piece.name;
      while (M.piece.name === name0 && guard++ < 400) { const s = M.piece.section; if (secs[secs.length - 1] !== s) secs.push(s); clock += 1; M.renderAhead(clock); }
      return { rows, same, secs }; }''')
    fmt = lambda s: f'{s // 60}:{s % 60:02d}'
    for row in r['rows']: print(f"   {row['g']:10s} short {fmt(row['short'])}  standard {fmt(row['standard'])}  long {fmt(row['long'])}")
    ok('Standard is a radio edit (about 1:40 to 4:30) in every genre', all(95 <= row['standard'] <= 270 for row in r['rows']))
    ok('Short is the old length, Long the longest', all(row['short'] < row['standard'] < row['long'] for row in r['rows']))
    ok('a seeded piece keeps its key, chords and name at every length', not r['same'])
    print('   trance sections:', ' > '.join(r['secs']))
    ok('a Standard trance piece runs intro, breakdown, drop and outro in order', r['secs'][0] == 'Intro' and 'Breakdown · build' in r['secs'] and 'Drop' in r['secs'] and r['secs'][-1] == 'Outro' and r['secs'].index('Drop') > r['secs'].index('Breakdown · build'))
    b.close()
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg = b.new_page(viewport={'width': 852, 'height': 393}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; }')
    pg.click('#bStudio'); pg.wait_for_timeout(500); pg.evaluate('() => document.querySelector("[data-act=stTab][data-v=shape]").click()'); pg.wait_for_timeout(200)
    ok('Standard is the default', pg.evaluate('() => document.querySelector("[data-act=stLen].on").dataset.v === "standard" && SFX.music.piece.length === "standard"'))
    pg.evaluate('() => document.querySelector("[data-act=stLen][data-v=long]").click()'); pg.wait_for_timeout(200)
    ok('Long applies to the playing piece and is saved', pg.evaluate('() => SFX.music.config.length === "long" && PROF.settings.studio.length === "long" && SFX.music.piece.bars > 100'))
    pg.screenshot(path=str(root / 'test' / 'out' / 'songlength_shape.png'))
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', [n for n, v in checks if not v])
