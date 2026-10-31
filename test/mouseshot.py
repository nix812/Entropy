"""v5.0.1 mouse and keyboard: hover cursor and corners, wheel zoom, right-drag pan, right-click closes the panel and cancels an
aimed ability, keyboard pan/zoom/next wave/talents/upgrade. usage: python3 mouseshot.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out'
mkpage.mk(); errs, fails = [], []
def check(c, m):
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1440, 'height': 860})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 3; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    scr = lambda x, y: pg.evaluate(f'() => {{ const r = document.querySelector("#cv").getBoundingClientRect(), q = Render.tileToScreen({x} + 0.5, {y} + 0.5); return [r.left + q.x * UIS, r.top + q.y * UIS]; }}')
    xy = pg.evaluate('() => { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y)) { const q = Render.tileToScreen(x + .5, y + .5), L = Render.layout; if (q.x > 40 && q.y > 40 && q.x < L.W - 40 && q.y < L.H - 40) return [x, y]; } }')
    sx, sy = scr(*xy)
    pg.mouse.move(sx, sy); pg.wait_for_timeout(100)
    check(pg.evaluate('() => document.querySelector("#cv").style.cursor') == 'pointer', 'hover cursor on a buildable tile')
    pg.screenshot(path=str(out / 'mouse_hover.png'))
    z0 = pg.evaluate('() => Render.zoom'); pg.mouse.wheel(0, -300); pg.wait_for_timeout(100)
    check(pg.evaluate('() => Render.zoom') > z0, 'wheel zooms in')
    sx, sy = scr(*xy)
    pg.mouse.click(sx, sy); pg.wait_for_timeout(150)
    check(pg.evaluate('() => !document.querySelector("#panel").hidden'), 'left click opens build panel')
    pg.mouse.click(sx, sy, button='right'); pg.wait_for_timeout(150)
    check(pg.evaluate('() => document.querySelector("#panel").hidden'), 'right click closes the panel')
    c0 = pg.evaluate('() => [Render.layout.W, Render.tileToScreen(10, 10).x]')
    pg.mouse.move(sx, sy); pg.mouse.down(button='right'); pg.mouse.move(sx - 120, sy, steps=5); pg.mouse.up(button='right'); pg.wait_for_timeout(100)
    c1 = pg.evaluate('() => Render.tileToScreen(10, 10).x')
    check(abs(c1 - c0[1]) > 20, f'right drag pans ({c0[1]} -> {c1})')
    check(pg.evaluate('() => document.querySelector("#panel").hidden'), 'right drag does not open anything')
    a = pg.evaluate('() => Render.tileToScreen(10, 10).x'); pg.keyboard.press('d'); pg.wait_for_timeout(50)
    check(pg.evaluate('() => Render.tileToScreen(10, 10).x') < a, 'D pans right')
    z1 = pg.evaluate('() => Render.zoom'); pg.keyboard.press('-'); pg.wait_for_timeout(50)
    check(pg.evaluate('() => Render.zoom') < z1, 'minus zooms out')
    pg.keyboard.press('t'); pg.wait_for_timeout(150)
    check(pg.evaluate('() => Tree.isOpen'), 'T opens talents')
    pg.keyboard.press('Escape'); pg.evaluate('() => Tree.close()'); pg.wait_for_timeout(100)
    # aim an ability, then right-click cancels it
    pg.evaluate('() => { G.charges.strike = 1; UI.refreshAll && UI.refreshAll(); G.aimAbility = "strike"; }')
    pg.mouse.click(sx, sy, button='right'); pg.wait_for_timeout(100)
    check(pg.evaluate('() => !G.aimAbility'), 'right click cancels aim')
    w0 = pg.evaluate('() => G.wave'); pg.evaluate('() => { G.next = 10; G.spawningDone = true; }'); pg.keyboard.press('n'); pg.wait_for_timeout(200)
    check(pg.evaluate('() => G.wave') > w0 or pg.evaluate('() => G.next') <= 0.5, 'N calls the next wave')
    b.close()
print('FAILS:', fails); print('ERRORS:', errs[:5])
