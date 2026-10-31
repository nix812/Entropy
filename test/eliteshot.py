"""v4.7: elites vs normal enemies side by side, zoomed and at the default view. usage: python3 eliteshot.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out'
mkpage.mk(); errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 3; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    pg.evaluate('''() => { const L = G.map.lanes[0]; const types = ['grunt', 'runner', 'tank', 'swarmer'].filter(t => ENEMIES[t]);
      let k = 0; for (const t of types) { for (const el of [0, 1, 2]) { const e = spawnEnemy(t, { lane: L, elite: el, hpm: 1 }); if (e) { e.d = 2 + k * 0.9; k++; } } }
      for (let i = 0; i < 3; i++) simStep(1/30); G.paused = true;
      const e = G.enemies[4]; const p = Render.tileToScreen(e.x, e.y); Render.zoomAt(p.x, p.y, 2.2); }''')
    pg.wait_for_timeout(400); pg.screenshot(path=str(out / 'elite_zoom.png'))
    pg.evaluate('() => Render.resetCam()'); pg.wait_for_timeout(300); pg.screenshot(path=str(out / 'elite_fit.png'))
    b.close()
print('ERRORS:', errs[:5])
