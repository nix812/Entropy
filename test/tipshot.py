import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root/'test'/'audit'
import mkpage; mkpage.mk()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':852,'height':393},device_scale_factor=2,has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://'+str(root/'test'/'out'/'page.html')); pg.wait_for_timeout(300)
    pg.evaluate('() => { PROF.seenHelp=true; PROF.xp=6e6; Tree.open(); Tree.select("c1_2n"); }'); pg.wait_for_timeout(900)
    pg.screenshot(path=str(out/'t1.png'))
    tips = pg.query_selector_all('#tinfo .tip'); print('tips', len(tips), [t.inner_text() for t in tips])
    if tips: tips[0].click(); pg.wait_for_timeout(200); pg.screenshot(path=str(out/'t2.png'))
    pg.mouse.click(400,200); pg.wait_for_timeout(100); print('hidden', pg.evaluate("() => document.querySelector('#tipbox').hidden"))
    b.close()
print(errs or 'ok')
