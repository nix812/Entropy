# v1.20 Core Battery: long-range shells mid-wave and the battery panel.
import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
import mkpage; mkpage.mk()
errs = []
def tap_tile(pg, x, y):
    c = pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({x}+0.5,{y}+0.5); return [r.left+p.x*UIS, r.top+p.y*UIS]; }}')
    pg.mouse.click(c[0], c[1])
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 34; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => { G.credits = 99999; for (let i = 0; i < 5; i++) coreUpgrade('weapon'); G.core.el = 'A';
      G.wave = 8; for (let i = 0; i < 14; i++) { const e = spawnEnemy(['drone','tank','flyer'][i % 3], { lane: G.map.lanes[0] }); e.d = 4 + i * 2.2; }
      for (let i = 0; i < 70; i++) simStep(1/30); }''')
    pg.wait_for_timeout(200); pg.screenshot(path=str(out / 'core01_shells.png'))
    c = pg.evaluate('() => G.map.core'); tap_tile(pg, c['x'], c['y']); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'core02_panel.png'))
    print('LV', pg.evaluate('() => G.core.wLvl'), 'range', pg.evaluate('() => coreStats().range.toFixed(1)'), 'shells', pg.evaluate('() => 1 + coreStats().multi'), 'core kills', pg.evaluate('() => G.core.kills || 0'))
    b.close()
print('ERRORS:', errs)
