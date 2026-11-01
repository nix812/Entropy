"""v5.1.2 notices: the ticker (one line, left of Map), homed news demoted, urgent cut-in with an edge flash, and the
Field Report's recent notices. usage: python3 tickershot.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'v51'; out.mkdir(parents=True, exist_ok=True)
mkpage.mk(); errs = []; fails = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 900000; PROF.seenVer = VERSION; PROF.zoomHint = 1; PROF.settings.briefings = "off"; PROF.seenSys = {storm:1,crate:1,vet:1,abil:1}; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(3500)
    pg.evaluate('() => { document.querySelector("#ticker").hidden = true; }')
    pg.evaluate('() => { Hooks.toast("STRAIN ASSAULT", "Plated Bulletproof Strain attacks in Wave 14. Selling is free until then", "#ff4d6a", true); Hooks.toast("MAELSTROM", "+75% Damage inside · Collapses in 30s", "#ff4d6a"); }')
    pg.wait_for_timeout(300)
    if not pg.evaluate('() => document.querySelector("#ticker").hidden'): fails.append('homed news still showed in the ticker')
    pg.evaluate('() => Hooks.toast("PIRATES", "Captain Rustbeard\'s skiff is after your salvage. Shoot it down for a bounty, or grab the crate first", "#ff4d6a")')
    pg.wait_for_timeout(500); pg.screenshot(path=str(out / 'ticker.png'))
    pg.wait_for_timeout(2500); pg.screenshot(path=str(out / 'ticker_scrolled.png'))
    pg.evaluate('() => Hooks.toast("RED ALERT", "Behemoth is 5 tiles from the core. Last Stand: core shells hit it ×3. Stasis, Strike and Overcharge now", "#ff4d6a", true)')
    pg.wait_for_timeout(250); pg.screenshot(path=str(out / 'ticker_urgent.png'))
    if not pg.evaluate('() => document.querySelector("#ticker").classList.contains("urgent")'): fails.append('urgent did not cut in')
    pg.click("#ticker .tkb"); pg.wait_for_timeout(400); pg.screenshot(path=str(out / 'ticker_report.png'))
    if not pg.evaluate('() => !!document.querySelector(".nlog")'): fails.append('no recent notices in the report')
    b.close()
print('FAILS:', fails); print('ERRORS:', errs[:5])
