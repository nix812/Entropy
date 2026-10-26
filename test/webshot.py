import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root/'test'/'audit'
import mkpage; mkpage.mk()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':852,'height':393},device_scale_factor=2,has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # simulate old save
    pg.goto('file://'+str(root/'test'/'out'/'page.html')); pg.wait_for_timeout(300)
    pg.evaluate('''() => { const k='entropy.save.v1'; const p=JSON.parse(JSON.stringify(PROF)); p.webV=undefined; delete p.webV; p.alloc=['start','g1','s1_0','s1_5']; p.xp=4e6; p.seenHelp=true; localStorage.setItem(k, JSON.stringify(p)); return k; }''')
    pg.reload(); pg.wait_for_timeout(1300); pg.screenshot(path=str(out/'w0_migrate.png'))
    print(pg.evaluate('() => [PROF.webV, PROF.alloc.length, pointsFree()]'))
    pg.evaluate('''() => { PROF.xp=4e6; const t=TREE.list.filter(n=>n.sector===1 && n.kind==='notable')[2]; for(const q of (treePathTo(t.id)||[])) treeAllocate(q); Tree.open(); }''')
    pg.wait_for_timeout(700); pg.screenshot(path=str(out/'w1_over.png'))
    pg.click('[data-tact=here]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'w2_here.png'))
    pg.click('[data-v=s3]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'w3_cryo.png'))
    pg.click('[data-v=zen]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'w4_zen.png'))
    b.close()
print(errs or 'ok')
