"""Times Render.draw on a busy mid-game scene. usage: python3 drawbench.py [page.html] -> ms per frame at z=1, zoomed in, zoomed out."""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
page = sys.argv[1] if len(sys.argv) > 1 else None
if not page: mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=3)
    pg.goto('file://' + page); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => { if (UI.closeModal) UI.closeModal(); G.credits = 1e7; G.gridBonus = 200; G.wave = 30;
      const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
      const c = G.map.core; spots.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
      const types = Object.keys(TOWERS); for (let i = 0; i < 36 && spots.length; i++) { const s = spots.shift(); buildTower(types[i % types.length], s[0], s[1]); }
      for (let i = 0; i < 90; i++) { const e = spawnEnemy(['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic'][i % 6], { d: (i * 0.37) % 25 }); }
      G.paused = true; window.__stopLoop = true; }''')
    res = pg.evaluate('''async () => {
      const t = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) { for (const e of G.enemies) { e.x += 0.01; } for (const tw of G.towers) tw.angle = (tw.angle || 0) + 0.2; Render.draw(1 / 60); } return (performance.now() - t0) / n; };
      t(30); // warm caches
      const out = {}; Render.resetCam(); out.home = t(60);
      const L = Render.layout; Render.zoomAt(L.W / 2, L.H / 2, 3); out.zoomIn = t(60);
      Render.resetCam(); Render.zoomAt(L.W / 2, L.H / 2, 0.01); out.zoomOut = t(60);
      return out; }''')
    b.close()
print({k: round(v, 2) for k, v in res.items()})
