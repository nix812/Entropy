# v5.7 studio splash: renders, blinks, ends by itself, a tap skips it, and nothing is left covering the hangar.
# python3 splashshot.py [W H]   (default: phone 852x393, iPhone SE 667x375 and iPad 1180x820)
import sys, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; sys.path.insert(0, str(root / 'test')); import mkpage; mkpage.mk()
out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
sizes = [(int(sys.argv[1]), int(sys.argv[2]))] if len(sys.argv) > 2 else [(852, 393), (667, 375), (1180, 820)]
FAILED = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: FAILED.append(what)
with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H in sizes:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(800)
        check(pg.evaluate("!document.getElementById('splash')"), f'{W}x{H} no splash under automation by default')
        t = pg.evaluate('UI.splash(true)'); check(t > 2000, f'{W}x{H} splash reports its length ({t} ms)')
        pg.wait_for_timeout(900); pg.screenshot(path=str(out / f'splash_{W}x{H}_a.png'))
        r = pg.evaluate("(() => { const c = document.querySelector('#splash .spc').getBoundingClientRect(); return [c.top, c.bottom, c.left, c.right]; })()")
        check(r[0] >= 0 and r[1] <= H and r[2] >= 0 and r[3] <= W, f'{W}x{H} splash content fits the screen {[round(v) for v in r]}')
        blinked = pg.evaluate("new Promise(r => { const t0 = performance.now(); (function poll() { const i = document.querySelector('#splash .spcat'); if (i && i.src === NIGEL_PX[1]) return r(true); if (performance.now() - t0 > 2000) return r(false); setTimeout(poll, 25); })(); })")
        if blinked: pg.screenshot(path=str(out / f'splash_{W}x{H}_blink.png'))
        check(blinked, f'{W}x{H} Nigel blinks')
        pg.wait_for_timeout(2800); check(pg.evaluate("!document.getElementById('splash')"), f'{W}x{H} splash ends by itself')
        pg.evaluate('UI.splash(true)'); pg.wait_for_timeout(700); pg.mouse.click(W / 2, H / 2); pg.wait_for_timeout(650)
        check(pg.evaluate("!document.getElementById('splash')"), f'{W}x{H} a tap skips it')
        pg.click('#bLaunch'); pg.wait_for_timeout(250)
        check(pg.evaluate("UI.modalOpen") is not None, f'{W}x{H} hangar buttons work after the splash')
        check(not errs, f'{W}x{H} no page errors {errs[:2]}')
        pg.close()
    b.close()
print('FAILED:', FAILED)
