import pathlib
from playwright.sync_api import sync_playwright
out = pathlib.Path(__file__).parent / 'out'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2)
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(300)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(100); pg.click('[data-act=launch]'); pg.wait_for_timeout(200)
    r = pg.evaluate('''() => {
      G.credits = 1e7; G.wave = 44; G.next = 0.1;
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]);
      const types=['pulse','cryo','rail','missile','coil','flame','lens','emp','pylon','grav'];
      for(let i=0;i<40;i++){ const t=buildTower(types[i%types.length], spots[i][1], spots[i][2]); if(t){ for(let k=0;k<4;k++) upgradeTower(t, 1+(i%2)); } }
      spawnStorm(['ion'], 8, 7, 0.05, 0); spawnStorm(['cryo'], 20, 5, -0.05, 0);
      for(let i=0;i<30*8;i++) simStep(1/30);
      const res={}; for (const dbg of [0,2,8,10,0,2,8,10]) { window.__rdbg=dbg; let t0=performance.now(); for(let f=0;f<30;f++) Render.draw(1/60); res[dbg]=((res[dbg]||0)+(performance.now()-t0)/30)/(res[dbg]?2:1); } window.__rdbg=0;
      let ts=0, tr=0;
      for (let f=0; f<60; f++) { let a=performance.now(); for(let k=0;k<3;k++) simStep(1/30); let b2=performance.now(); Render.draw(1/60); let c=performance.now(); ts+=b2-a; tr+=c-b2; }
      return [ts/60, tr/60, G.enemies.length, G.storms.length, JSON.stringify(res)];
    }''')
    print('sim ms/frame (3x)', round(r[0],2), 'render ms/frame', round(r[1],2), 'enemies', r[2], 'storms', r[3], r[4])
    b.close()
