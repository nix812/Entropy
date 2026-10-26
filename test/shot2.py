import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'TUNNEL' not in m.text else None)
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 900000; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200)
    pg.click('[data-act=sw][data-v="30"]'); pg.click('[data-act=ch][data-v="3"]'); pg.wait_for_timeout(100)
    pg.click('[data-act=launch]'); pg.wait_for_timeout(300)
    pg.evaluate('''() => {
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<6) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]);
      G.credits = 60000;
      const types=['pulse','rail','cryo','missile','coil','flame','lens','emp','grav','pylon','forge'];
      for(let i=0;i<22;i++){ const t=buildTower(types[i%types.length], spots[i][1], spots[i][2]); if(t){ upgradeTower(t); upgradeTower(t); upgradeTower(t, 1+(i%2)); upgradeTower(t);} }
      G.next = 0;
      for(let i=0;i<30*14;i++) simStep(1/30);
      spawnStorm(['ion'], 10, 7, 0, 0); spawnStorm(['solar'], 11, 7, 0, 0);
      for(let i=0;i<30*2;i++) simStep(1/30);
    }''')
    pg.click('#bStats'); pg.wait_for_timeout(700)
    pg.screenshot(path=str(out / 'b1_midwave.png'))
    # build panel on an empty tile
    xy = pg.evaluate('() => { for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++) if(canBuildAt(x,y) && x<12){ const L=Render.layout; const r=document.querySelector("#cv").getBoundingClientRect(); return [r.left+L.ox+(x+0.5)*10*L.scale, r.top+L.oy+(y+0.5)*10*L.scale]; } }')
    pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(200)
    pg.click('[data-act=pick][data-type=missile]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'b2_build.png'))
    pg.click('[data-act=close]')
    pg.evaluate('() => { const n = G.storms.length; G.storms.push({id:77,types:STORM_KEYS.slice(),x:16,y:7,vx:0,vy:0,r:5.2,life:30,age:0,mael:true,spawnT:0,rot:0}); for(let i=0;i<30*3;i++) simStep(1/30); }')
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'b3_mael.png'))
    pg.evaluate('() => { const e = spawnBoss({boss:"titan", lane:G.map.lanes[0], hpm:1, elite:0}); e.hp = 1; hit(e, 10, "K", G.towers[0]); }')
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / 'b4_draft.png'))
    pg.click('[data-act=boon][data-v="0"]'); pg.wait_for_timeout(200)
    pg.evaluate('() => { gameOver(); }')
    pg.wait_for_timeout(1300)
    pg.screenshot(path=str(out / 'b5_over.png'))
    pg.click('[data-act=hangar]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'b6_hangar.png'))
    b.close()
print('ERRORS:', errs[:20])
