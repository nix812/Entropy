# v4.0 notifications: alerts (centre, rare, wrapped), tips (instant feedback, bottom), feed (corner, fades).
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v40n'
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:3])))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; PROF.seenEvo = true; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(600)
    pg.evaluate('''() => { const T = UI.toast;
      T('NEW COMBO · Shatter', 'Cryo then a heavy hit deals bonus damage', '#6ae2ff'); T('SALVAGE', '+120 credits', '#ffb03a'); T('VETERAN II', 'Pulse · Tap to choose a mutation', '#ffe14d');
      T('PHASE II', 'Overmind unleashes a psychic storm', '#ff4d6a'); T('MILESTONE', '+1 Orbital Strike', '#ffe14d');
      T('WORMHOLE DETECTED', 'Sector expanding · Lane opens at Wave 13', '#b86cff'); T('PIRATES', 'A skiff is after your salvage. Shoot it down', '#ff4d6a');
      T('NOT ENOUGH POWER', 'Free some power: lower another Overcharge or sell a tower', '#ff4d6a'); }''')
    pg.wait_for_timeout(400)
    print('alerts visible', pg.evaluate('() => document.querySelectorAll("#toasts .toast").length'), 'feed lines', pg.evaluate('() => document.querySelectorAll("#log .fl").length'), 'tip', pg.evaluate('() => !document.querySelector("#tip").hidden'))
    pg.screenshot(path=str(out / f'{tag}01.png'))
    pg.wait_for_timeout(8500)
    print('after 9s: alerts', pg.evaluate('() => document.querySelectorAll("#toasts .toast").length'), 'feed shown', pg.evaluate('() => [...document.querySelectorAll("#log .fl")].filter(e => !e.classList.contains("old")).length'))
    pg.screenshot(path=str(out / f'{tag}02.png'))
    b.close()
print('ERRORS:', errs)
