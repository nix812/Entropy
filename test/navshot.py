import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root/'test'/'audit'
import mkpage; mkpage.mk()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':852,'height':393},device_scale_factor=2,has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://'+str(root/'test'/'out'/'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('''() => { PROF.seenHelp=true; PROF.xp=9e7; const t=TREE.list.filter(n=>n.sector===3 && n.kind==='notable')[1]; for(const q of (treePathTo(t.id)||[])) treeAllocate(q); UI.renderHangar(); }''')
    pg.evaluate('() => Tree.open()'); pg.wait_for_timeout(600); pg.screenshot(path=str(out/'h1.png'))
    pg.click('[data-tact=here]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'h2.png'))
    pg.click('[data-tact=center]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'h3.png'))
    print(pg.evaluate('() => PROF.alloc.slice(-3)'))
    b.close()
print(errs or 'ok')
