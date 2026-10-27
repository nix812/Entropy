# v1.21 space pirates: drop ship mid-flight, flagship, thief skiff, stowaway.
import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 34; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => { G.wave = 20; G.spawningDone = false; G.queue = [{ t: 999, type: 'drone', lane: G.map.lanes[0], hpm: 1, elite: 0 }];
      const R = G.region; G.pirates.push({ id: 1, x: R.x0 + 6, y: R.y0 + 5.5, vx: 14, tx: R.x1 - 5, ty: R.y0 + 5, kind: 'gold', dropped: false });
      G.pirates.push({ id: 2, x: R.x1 - 4, y: R.y1 - 4.5, vx: -18, tx: R.x0 + 4, ty: R.y1 - 5, kind: 'normal', dropped: false });
      const c = { x: R.x0 + 8, y: R.y0 + 10, t: 7, kind: 'normal', id: 5 }; G.caches.push(c); const th = spawnThief(c); th.d = th.pirate.grabD * 0.6;
      G.caches.push({ x: R.x0 + 14, y: R.y1 - 8, t: 15, kind: 'cursed', id: 6 }); claimCache(G.caches[G.caches.length - 1]);
      for (let i = 0; i < 6; i++) simStep(1/30); }''')
    pg.wait_for_timeout(250); pg.screenshot(path=str(out / 'pir01.png'))
    pg.evaluate('() => { const z = Render.zoom; Render.zoomAt(380, 200, 2.4); for (let i = 0; i < 3; i++) simStep(1/30); }'); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / 'pir02_zoom.png'))
    print('pirates', pg.evaluate('() => G.pirates.length'), 'thieves', pg.evaluate('() => G.enemies.filter(e => e.pirate).length'), 'stowaways', pg.evaluate('() => G.enemies.filter(e => e.stowaway).length'))
    b.close()
print('ERRORS:', errs)
