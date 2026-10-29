# v3.1: notification queue (one at a time), DNA chip + evolution panel + first-time intro, reactor expansion (build and
# core panels), run log stored at game over with Copy / Save buttons. usage: v31shot.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v31'
import mkpage; mkpage.mk()
errs = []
def tap_tile(pg, x, y):
    c = pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({x}+0.5,{y}+0.5); return [r.left+p.x*UIS, r.top+p.y*UIS]; }}')
    pg.mouse.click(c[0], c[1])
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:3])))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; PROF.seenEvo = false; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    # notification spam: only one visible at a time
    pg.evaluate('() => { for (let i = 0; i < 6; i++) UI.toast(i % 2 ? "NEW COMBO" : "WAVE " + i, "message number " + i, "#ffb03a"); }')
    pg.wait_for_timeout(200)
    print('toasts visible after spam:', pg.evaluate('() => document.querySelectorAll("#toasts .toast").length'))
    pg.screenshot(path=str(out / f'{tag}01_toast.png'))
    # evolution intro: seed genes, prepare a wave that crosses 35%
    pg.evaluate('''() => { G.wave = 24; G.credits = 20000;
      G.geneFit = { 'plating': { s: 6, n: 10 }, 'haste': { s: 5, n: 10 }, '': { s: -3, n: 10 } };
      G.prep = null; G.enemies.length = 0; G.queue.length = 0; G.spawningDone = true; prepareWave(25); }''')
    pg.wait_for_timeout(1200)
    print('evo intro modal:', pg.evaluate('() => UI.modalOpen'))
    pg.screenshot(path=str(out / f'{tag}02_evo_intro.png'))
    if pg.evaluate('() => UI.modalOpen === "evo"'): pg.click('[data-act=evoDone]'); pg.wait_for_timeout(300)
    print('seenEvo', pg.evaluate('() => PROF.seenEvo'), 'paused', pg.evaluate('() => G.paused'))
    # start the wave so the DNA chip shows, then open the panel from it
    pg.evaluate('() => { G.next = 0.1; G.speed = 2; }'); pg.wait_for_timeout(3500)
    print('dna chip:', pg.evaluate('() => (document.querySelector("#chips [data-evo]") || {}).textContent'))
    pg.evaluate('() => document.querySelector("#chips [data-evo]") && document.querySelector("#chips [data-evo]").click()'); pg.wait_for_timeout(300)
    print('evo panel:', pg.evaluate('() => UI.modalOpen'))
    pg.screenshot(path=str(out / f'{tag}03_evo_panel.png'))
    pg.evaluate('() => document.querySelector("[data-act=close2]").click()'); pg.wait_for_timeout(200)
    # fill the grid, then the build panel offers a reactor expansion
    pg.evaluate('''() => { const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y) || isNode(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); window.__spots = spots; let i = 0; while (gridFree() > 0 && i < spots.length) { buildTower(['pulse','rail','missile','cryo'][i%4], spots[i][1], spots[i][2]); i++; } }''')
    sp = pg.evaluate('() => window.__spots.find(s => canBuildAt(s[1], s[2]))')
    tap_tile(pg, sp[1], sp[2]); pg.wait_for_timeout(300)
    pg.click('[data-act=pick][data-type=lens]'); pg.wait_for_timeout(250)
    cap0 = pg.evaluate('() => gridCap()')
    print('build foot:', pg.inner_text('.pfoot .btn').replace('\n', ' | '))
    pg.screenshot(path=str(out / f'{tag}04_reactor_build.png'))
    pg.click('[data-act=reactor]'); pg.wait_for_timeout(300)
    print('cap', cap0, '->', pg.evaluate('() => gridCap()'), 'foot now:', pg.inner_text('.pfoot .btn').replace('\n', ' | ')[:40])
    pg.evaluate('() => UI.closePanel()')
    c = pg.evaluate('() => G.map.core'); tap_tile(pg, c['x'], c['y']); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'{tag}05_reactor_core.png'))
    pg.evaluate('() => UI.closePanel()')
    # game over: log stored, buttons work
    pg.evaluate('() => { G.core.hp = 0; gameOver(); }'); pg.wait_for_timeout(1600)
    n = pg.evaluate('() => (localStorage.getItem("entropy.runlog") || "").length')
    print('over modal', pg.evaluate('() => UI.modalOpen'), 'stored log bytes', n, 'lines', pg.evaluate('() => (localStorage.getItem("entropy.runlog") || "").split("\\n").length'))
    pg.screenshot(path=str(out / f'{tag}06_over_log.png'))
    pg.click('[data-act=logCopy]'); pg.wait_for_timeout(500)
    clip = pg.evaluate('() => navigator.clipboard.readText().then(t => t.length).catch(e => "err " + e)')
    print('clipboard length', clip)
    b.close()
print('ERRORS:', errs)
