import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
tag = sys.argv[1] if len(sys.argv) > 1 else 'a'
W, H = int(sys.argv[2]) if len(sys.argv) > 2 else 852, int(sys.argv[3]) if len(sys.argv) > 3 else 393
SAFE = (sys.argv[4] if len(sys.argv) > 4 else '59,59,21').split(',')
import mkpage; mkpage.mk()
errs = []
def tap_tile(pg, x, y):
    c = pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({x}+0.5,{y}+0.5); return [r.left+p.x*UIS, r.top+p.y*UIS]; }}')
    pg.mouse.click(c[0], c[1])
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:%spx!important;--sar:%spx!important;--sab:%spx!important}' % tuple(SAFE)); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / f'{tag}01_hangar_new.png'))
    pg.evaluate('() => { PROF.bestWave = 34; PROF.xp = 160000; PROF.runs = 6; PROF.bestScore = 412000; PROF.seenHelp = true; PROF.settings.briefings = "brief"; PROF.runSnap = null; UI.renderHangar(); }')
    pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / f'{tag}02_hangar_vet.png'))
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}03_setup.png'))
    pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / f'{tag}04_game_start.png'))
    pg.evaluate('''() => {
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]);
      G.credits = 9000;
      const types=['pulse','cryo','rail','missile','coil','flame','lens','pylon','emp','grav'];
      for(let i=0;i<12;i++){ const t=buildTower(types[i%types.length], spots[i][1], spots[i][2]); if(t){ upgradeTower(t); upgradeTower(t); } }
      G.next = 0.1; for(let i=0;i<30*40;i++) simStep(1/30);
      grantVxp(G.towers[0], 120);
    }''')
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'{tag}05_game_mid.png'))
    pg.evaluate('() => { const t=G.towers[2]; const p=Render.tileToScreen(t.cx,t.cy); Render.zoomAt(p.x,p.y,2.6); for(let i=0;i<20;i++) simStep(1/30); }'); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}05b_zoom.png'))
    pg.evaluate('() => Render.resetCam()')
    xy = pg.evaluate('() => { for(let y=0;y<ROWS;y++)for(let x=6;x<COLS;x++) if(canBuildAt(x,y)) return [x,y]; }')
    tap_tile(pg, xy[0], xy[1]); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}06_build.png'))
    pick = pg.query_selector('[data-act=pick][data-type=missile]')
    if pick: pick.click(); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / f'{tag}07_build_pick.png'))
    pg.keyboard.press('Escape'); pg.evaluate('() => UI.closePanel()')
    t0 = pg.evaluate('() => [G.towers[0].x, G.towers[0].y]')
    tap_tile(pg, t0[0], t0[1]); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}08_tower.png'))
    pg.evaluate('() => UI.closePanel()')
    pg.evaluate('() => { const c=G.map.core; }')
    core = pg.evaluate('() => [G.map.core.x, G.map.core.y]')
    tap_tile(pg, core[0], core[1]); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}09_core.png'))
    pg.evaluate('() => { UI.closePanel(); G.entropy = 99; addEntropy(30); }'); pg.wait_for_timeout(200)
    pg.click('#bEnt'); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}10_anomaly.png'))
    pg.click('[data-act=stab]'); pg.wait_for_timeout(200)
    pg.click('#bPause'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / f'{tag}11_pause.png'))
    pg.click('[data-act=resume]'); pg.wait_for_timeout(100)
    pg.click('#bWeb'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / f'{tag}12_web.png'))
    pg.evaluate('() => Tree.close()')
    pg.evaluate('() => { gameOver(); }'); pg.wait_for_timeout(1300)
    pg.screenshot(path=str(out / f'{tag}13_over.png'))
    pg.click('[data-act=hangar]'); pg.wait_for_timeout(200)
    pg.click('#bArchive'); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}14_archive.png'))
    b.close()
print('ERRORS:', errs)
