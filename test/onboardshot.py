"""v5.3 First Run: a fresh profile's first screen (build hints, welcome), the ability rail, an intro card, the core's
Command Uplink, and the death screen's 'why'. usage: python3 onboardshot.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'v51'; out.mkdir(parents=True, exist_ok=True)
mkpage.mk(); errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.seenVer = VERSION; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(1600)
    pg.screenshot(path=str(out / 'first.png'))
    # storm intro card
    pg.evaluate("() => document.querySelector(\"[data-act=brief]\") && document.querySelector(\"[data-act=brief]\").click()"); pg.wait_for_timeout(300)
    pg.evaluate("() => { const t = G.map.core; spawnStorm([\"solar\"], t.x + 2, t.y, 0, 0); }"); pg.wait_for_timeout(500); pg.screenshot(path=str(out / 'intro.png'))
    pg.evaluate('() => document.querySelector("[data-act=brief]") && document.querySelector("[data-act=brief]").click()')
    # core panel with Uplink
    pg.evaluate('() => { G.credits = 5000; G.core.uLvl = 3; }')
    c = pg.evaluate('() => { const p = Render.tileToScreen(G.core.x, G.core.y); const r = document.querySelector("#cv").getBoundingClientRect(); return [r.left + p.x * UIS, r.top + p.y * UIS]; }')
    pg.touchscreen.tap(c[0], c[1]); pg.wait_for_timeout(400); pg.screenshot(path=str(out / 'core.png'))
    pg.evaluate('() => { const pn = document.querySelector("#panel"); pn.scrollTop = 0; const t = [...pn.querySelectorAll("[data-act=tab]")].find(b => b.dataset.v === "info"); t && t.click(); }'); pg.wait_for_timeout(300); pg.screenshot(path=str(out / 'core_info.png'))
    # death screen: a Juggernaut leak wave
    pg.evaluate('() => { document.querySelector("[data-act=close]") && document.querySelector("[data-act=close]").click(); G.wave = 23; G.leakWave = { "tank+plating": 5, swarmer: 2 }; G.core.hp = 0; gameOver(); }'); pg.wait_for_timeout(1400); pg.screenshot(path=str(out / 'death.png'))
    b.close()
print('ERRORS:', errs[:5])
