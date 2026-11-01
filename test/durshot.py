"""v5.1.1: the rail counts down running abilities. usage: python3 durshot.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'v51'; out.mkdir(parents=True, exist_ok=True)
mkpage.mk(); errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 900000; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; PROF.seenSys = {storm:1,crate:1,vet:1,abil:1}; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    pg.evaluate('() => { G.abilOn = { strike: 1, nova: 1, stasis: 1, overclock: 1, scan: 1 }; G.charges = { strike: 2, nova: 1, stasis: 3, overclock: 4, scan: 2 }; }')
    pg.click('[data-abil=overclock]'); pg.wait_for_timeout(300); pg.click('[data-abil=overclock]'); pg.wait_for_timeout(200)
    pg.click('[data-abil=stasis]'); pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out / 'duration.png'))
    b.close()
print('ERRORS:', errs[:5])
