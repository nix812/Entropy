import pathlib, time
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'TUNNEL' not in m.text else None)
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200)
    pg.click('[data-act=mode][data-v=daily]'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / 'd1_daily.png'))
    pg.click('[data-act=launchDaily]'); pg.wait_for_timeout(300)
    # heavy late-game load test
    pg.evaluate('''() => {
      G.credits = 1e7; G.wave = 44; G.next = 0.1;
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]);
      const types=['pulse','cryo','rail','missile','coil','flame','lens','emp','pylon','grav'];
      for(let i=0;i<40;i++){ const t=buildTower(types[i%types.length], spots[i][1], spots[i][2]); if(t){ for(let k=0;k<4;k++) upgradeTower(t, 1+(i%2)); } }
      spawnStorm(['ion'], 8, 7, 0.05, 0); spawnStorm(['cryo'], 20, 5, -0.05, 0);
      for(let i=0;i<30*8;i++) simStep(1/30);
    }''')
    pg.evaluate('() => { G.speed = 3; }')
    t0 = pg.evaluate('() => performance.now()')
    frames = pg.evaluate('''() => new Promise(res => { let n=0, worst=0, last=performance.now(); function f(){ const t=performance.now(); worst=Math.max(worst,t-last); last=t; if(++n<120) requestAnimationFrame(f); else res([n, worst, G.enemies.length, G.projs.length, G.towers.length]); } requestAnimationFrame(f); })''')
    t1 = pg.evaluate('() => performance.now()')
    print('120 frames in', round(t1 - t0), 'ms; worst frame', round(frames[1]), 'ms; enemies', frames[2], 'projs', frames[3], 'towers', frames[4])
    pg.screenshot(path=str(out / 'd2_heavy.png'))
    b.close()
print('ERRORS:', errs[:20])
