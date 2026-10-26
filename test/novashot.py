import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root/'test'/'audit'
import mkpage; mkpage.mk()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':852,'height':393},device_scale_factor=2,has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://'+str(root/'test'/'out'/'page.html')); pg.wait_for_timeout(300)
    pg.evaluate('''() => { PROF.seenHelp=true; PROF.xp=6e6; for (const r of ['s1','zen','s3']) for (const id of REGION_NODES[r]) treeAllocate(id); UI.renderHangar(); }''')
    pg.wait_for_timeout(300); pg.screenshot(path=str(out/'n1_hangar.png'))
    pg.evaluate('() => Tree.open()'); pg.wait_for_timeout(700); pg.screenshot(path=str(out/'n2_web.png'))
    pg.click('[data-v=s1]'); pg.wait_for_timeout(1200); pg.click('[data-tact=star][data-v="5"]'); pg.wait_for_timeout(300); pg.screenshot(path=str(out/'n3_star.png'))
    pg.evaluate('() => Tree.close()'); pg.wait_for_timeout(200)
    pg.click('#bNova'); pg.wait_for_timeout(300); pg.screenshot(path=str(out/'n4_nova0.png'))
    pg.click('[data-act=novaNext]'); pg.wait_for_timeout(200); pg.click('[data-act=novaR][data-v=s1]'); pg.wait_for_timeout(200); pg.screenshot(path=str(out/'n5_rem.png'))
    pg.click('[data-act=novaNext]'); pg.wait_for_timeout(200); pg.click('[data-act=novaL]'); pg.wait_for_timeout(200); pg.screenshot(path=str(out/'n6_law.png'))
    pg.click('[data-act=novaGo]'); pg.wait_for_timeout(500); pg.screenshot(path=str(out/'n7_burst.png')); pg.wait_for_timeout(1500); pg.screenshot(path=str(out/'n8_after.png'))
    print(pg.evaluate('() => [PROF.nova, PROF.remnants, PROF.laws, profLevel().level, PROF.alloc.length]'))
    pg.evaluate('() => Tree.open()'); pg.wait_for_timeout(700); pg.click('[data-v=s1]'); pg.wait_for_timeout(1300); pg.screenshot(path=str(out/'n9_remweb.png'))
    b.close()
print(errs or 'ok')
