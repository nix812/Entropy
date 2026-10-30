# Overdrive rail button: locked before the wave, ready glow, arm then release, used state. usage: odbtn.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'odb'
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; PROF.seenEvo = true; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    st = lambda: pg.evaluate('() => { const b = document.querySelector("#bOD"); return { label: b.querySelector("span").textContent, cls: b.className, visible: b.offsetParent !== null }; }')
    print('before wave 35:', st())
    pg.click('#bOD'); pg.wait_for_timeout(200)
    print('toast:', pg.evaluate('() => (document.querySelector("#toasts .toast") || {}).textContent'))
    pg.screenshot(path=str(out / f'{tag}01_locked.png'))
    pg.evaluate('() => { G.wave = 36; G.charges.strike = 2; G.charges.nova = 1; for (let i = 0; i < 12; i++) spawnEnemy("drone", { lane: G.map.lanes[0], d: 2 + i * 0.4 }); }'); pg.wait_for_timeout(400)
    print('ready:', st())
    pg.screenshot(path=str(out / f'{tag}02_ready.png'))
    pg.click('#bOD'); pg.wait_for_timeout(200)
    print('armed:', st(), 'used yet', pg.evaluate('() => G.odUsed'))
    pg.screenshot(path=str(out / f'{tag}03_armed.png'))
    n0 = pg.evaluate('() => G.enemies.length')
    pg.click('#bOD'); pg.wait_for_timeout(500)
    print('released: enemies', n0, '->', pg.evaluate('() => G.enemies.filter(e => !e.dead).length'), 'odUsed', pg.evaluate('() => G.odUsed'), st())
    pg.screenshot(path=str(out / f'{tag}04_used.png'))
    b.close()
print('ERRORS:', errs)
