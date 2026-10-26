import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root/'test'/'audit'
import mkpage; mkpage.mk()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':852,'height':393},device_scale_factor=2,has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://'+str(root/'test'/'out'/'page.html')); pg.wait_for_timeout(400)
    # allocate a path into Combustion fully, part of Cryo
    pg.evaluate('''() => { PROF.seenHelp=true; PROF.xp=9e7; const want=TREE.list.filter(n=>n.sector===1).map(n=>n.id); for(const id of want){ const pth=treePathTo(id)||[]; for(const q of pth) treeAllocate(q);} const c=TREE.list.filter(n=>n.sector===3).slice(0,8); for(const n of c){ for(const q of (treePathTo(n.id)||[])) treeAllocate(q);} UI.renderHangar(); }''')
    pg.click('#bWeb') if pg.query_selector('#bWeb:visible') else pg.evaluate('() => Tree.open()')
    pg.wait_for_timeout(600); pg.screenshot(path=str(out/'c1_flat.png'))
    pg.click('[data-v=s1]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'c2_phoenix.png'))
    pg.click('[data-v=zen]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'c3_zen.png'))
    pg.click('#tView'); pg.wait_for_timeout(1500); pg.click('[data-v=core]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'c4_3d.png'))
    pg.click('[data-v=nad]'); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'c5_nad3d.png'))
    b.close()
print(errs or 'ok')
