import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.seenHelp = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(300)
    pg.evaluate('''() => {
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); G.credits=9000;
      for(let i=0;i<8;i++) buildTower(['pulse','cryo','rail','flame'][i%4], spots[i][1], spots[i][2]);
    }''')
    for i, bid in enumerate(['cat', 'gloop', 'whale', 'duck', 'fsm']):
        pg.evaluate('''(bid) => { G.enemies.length=0; G.bossAlive=null; const L=G.map.lanes[0]; const e=spawnBoss({boss:bid, lane:L, hpm:50}); const LL=e.L; e.d = LL.len*0.3; for(let i=0;i<30*7;i++) simStep(1/30); }''', bid)
        pg.wait_for_timeout(250)
        pg.evaluate('''() => { const e=G.bossAlive||G.enemies.find(e=>e.boss); if(!e) return; const p=Render.tileToScreen(e.x,e.y); Render.zoomAt(p.x,p.y,2.4); }''')
        pg.wait_for_timeout(250)
        pg.screenshot(path=str(out / f'boss_{bid}.png'))
        pg.evaluate('() => Render.resetCam()')
    # gloop split test
    r = pg.evaluate('''() => { G.enemies.length=0; G.bossAlive=null; const e=spawnBoss({boss:'gloop', lane:G.map.lanes[0], hpm:1}); e.d=3; kill(e); const k=G.enemies.filter(x=>x.boss==='gloop'); k.forEach(x=>kill(x)); return [k.length, G.enemies.filter(x=>x.boss==='gloop').length]; }''')
    print('split', r)
    b.close()
print('\n'.join(errs) or 'no errors')
