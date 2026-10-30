# v4.3 web usability: zoomed-in culling (flat and 3D), crowded taps zoom in, Undo, Doctrine "Next" goal. usage: v43tree.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v43'
import mkpage; mkpage.mk()
errs = []
XP = 'let x=0; for (let i=0;i<LV;i++) x += 3000 + 250*i + 3*i*i; PROF.xp = x + 1;'
def node_xy(pg, nid):
    return pg.evaluate('''(id) => { const cv = document.querySelector("#tcv").getBoundingClientRect(); const p = Tree._screen(id); return p ? [cv.left + p.x * UIS, cv.top + p.y * UIS] : null; }''', nid)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:3])))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { const LV = 60; ' + XP + ' PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.alloc = ["start"]; PROF.settings.webView = "flat"; UI.renderHangar(); }')
    pg.evaluate('() => Tree.open()'); pg.wait_for_timeout(500)
    print('overview visible:', pg.evaluate('() => Tree._visCount()'))
    pg.click('[data-tact=rgn][data-v="s1"]'); pg.wait_for_timeout(1500)
    print('zoomed region visible:', pg.evaluate('() => Tree._visCount()'))
    pg.screenshot(path=str(out / f'{tag}01_flat_zoom.png'))
    # tap the gate twice to allocate, then undo
    xy = node_xy(pg, 'g1'); pg.mouse.click(*xy); pg.wait_for_timeout(700); xy = node_xy(pg, 'g1'); pg.mouse.click(*xy); pg.wait_for_timeout(400)
    print('g1 allocated:', pg.evaluate('() => PROF.alloc.includes("g1")'), 'undo shown:', pg.evaluate('() => !document.querySelector("#tUndo").hidden'))
    pg.screenshot(path=str(out / f'{tag}02_alloc.png'))
    pg.click('#tUndo'); pg.wait_for_timeout(300)
    print('after undo g1:', pg.evaluate('() => PROF.alloc.includes("g1")'), 'undo hidden:', pg.evaluate('() => document.querySelector("#tUndo").hidden'))
    # Doctrine next goal
    pg.evaluate('() => { treeAllocate("d1"); Tree.refresh(); }')
    pg.click('[data-tact=docs]'); pg.wait_for_timeout(300)
    print('next goal button:', pg.evaluate('() => [...document.querySelectorAll(".docrow .btn.primary")].map(b => b.textContent)'))
    pg.click('.docrow .btn.primary'); pg.wait_for_timeout(1300)
    print('selected:', pg.evaluate('() => Tree._sel()'))
    pg.screenshot(path=str(out / f'{tag}03_next_goal.png'))
    # 3D
    pg.click('[data-tact=view]'); pg.wait_for_timeout(900)
    pg.click('[data-tact=rgn][data-v="s3"]'); pg.wait_for_timeout(1600)
    print('3D zoomed visible:', pg.evaluate('() => Tree._visCount()'), pg.evaluate('() => Tree._dbg()'))
    pg.screenshot(path=str(out / f'{tag}04_3d_zoom.png'))
    b.close()
print('ERRORS:', errs)
