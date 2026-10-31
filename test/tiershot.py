"""v4.8: tower level tiers (LV 1..18 colours), the affordable arrows and the tier-coloured upgrade button, at phone home zoom.
usage: python3 tiershot.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out'
mkpage.mk(); errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 3; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    pg.evaluate('''() => { G.credits = 1e6; const c = G.map.core; const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y)) spots.push([Math.hypot(x - c.x, y - c.y), x, y]);
      spots.sort((a, b) => a[0] - b[0]); const types = ['pulse', 'rail', 'cryo', 'missile', 'coil'];
      const lv = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 16, 18];
      lv.forEach((L, i) => { const t = buildTower(types[i % types.length], spots[i][1], spots[i][2]); if (!t) return; for (let k = 1; k < L; k++) upgradeTower(t, 1); });
      G.credits = 2500; for (let i = 0; i < 5; i++) simStep(1 / 30); G.paused = true; }''')
    pg.wait_for_timeout(500); pg.screenshot(path=str(out / 'tier_home.png'))
    t = pg.evaluate('() => { const t = G.towers.find(t => towerLevel(t) === 8); return [t.x, t.y]; }')
    pg.evaluate('([x, y]) => { const p = Render.tileToScreen(x + 0.5, y + 0.5); Render.zoomAt(p.x, p.y, 1.8); }', t); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'tier_zoom.png'))
    pg.evaluate('() => Render.resetCam()')
    c = pg.evaluate('([x, y]) => { const r = document.querySelector("#cv").getBoundingClientRect(); const p = Render.tileToScreen(x + 0.5, y + 0.5); return [r.left + p.x * UIS, r.top + p.y * UIS]; }', t)
    pg.mouse.click(c[0], c[1]); pg.wait_for_timeout(300); pg.screenshot(path=str(out / 'tier_panel.png'))
    pg.evaluate('() => UI.closePanel()'); pg.click('#bZoom'); pg.wait_for_timeout(300); pg.screenshot(path=str(out / 'tier_map.png'))
    b.close()
print('ERRORS:', errs[:5])
