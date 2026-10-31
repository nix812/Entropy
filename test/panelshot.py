"""v4.5 panel tabs: tower and core panels on a phone, Actions and Details, and whether Actions needs scrolling.
usage: python3 panelshot.py [W H]"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (852, 393)
mkpage.mk()
errs, report = [], []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => { if (UI.closeModal) UI.closeModal(); document.querySelector('#toasts').style.display = 'none'; G.credits = 50000; G.wave = 40; G.paused = true;
      const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
      const t = buildTower('pulse', spots[0][0], spots[0][1]); upgradeTower(t); upgradeTower(t); upgradeTower(t, 1); upgradeTower(t);
      window.__t = t; const f = buildTower('forge', spots[5][0], spots[5][1]); window.__f = f; }''')
    def scroll_need():
        return pg.evaluate('() => { const el = document.querySelector("#panel"); return el.scrollHeight - el.clientHeight; }')
    pg.evaluate('() => { UI.openTowerForTest ? 0 : 0; }')
    for name, js in [('tower', '__t'), ('forge', '__f')]:
        pos = pg.evaluate(f'() => {{ const t = window.{js}, s = Render.tileToScreen(t.x + 0.5, t.y + 0.5), r = document.querySelector("#cv").getBoundingClientRect(); return [r.left + s.x, r.top + s.y]; }}')
        pg.mouse.click(*pos); pg.wait_for_timeout(300)
        report.append((name, 'actions overflow px', scroll_need()))
        pg.screenshot(path=str(out / f'panel_{name}_act.png'))
        pg.click('#panel [data-act=tab][data-v=info]'); pg.wait_for_timeout(200)
        report.append((name, 'details overflow px', scroll_need()))
        pg.screenshot(path=str(out / f'panel_{name}_info.png'))
        pg.click('#panel [data-act=close]'); pg.wait_for_timeout(200)
    core = pg.evaluate('() => { const c = G.map.core, s = Render.tileToScreen(c.x + 0.5, c.y + 0.5), r = document.querySelector("#cv").getBoundingClientRect(); return [r.left + s.x, r.top + s.y]; }')
    pg.mouse.click(*core); pg.wait_for_timeout(300)
    report.append(('core', 'actions overflow px', scroll_need()))
    pg.screenshot(path=str(out / 'panel_core_act.png'))
    pg.click('#panel [data-act=tab][data-v=info]'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / 'panel_core_info.png'))
    b.close()
for r in report: print(*r)
print('ERRORS:', errs[:10])
