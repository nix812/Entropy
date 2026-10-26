import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
errs = []
def tile_xy(pg, x, y):
    return pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({x}+0.5,{y}+0.5); return [r.left+p.x, r.top+p.y]; }}')
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'TUNNEL' not in m.text else None)
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 300000; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200)
    pg.click('[data-act=sw][data-v="20"]'); pg.wait_for_timeout(100)
    pg.click('[data-act=launch]'); pg.wait_for_timeout(300)
    pg.evaluate('''() => {
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]);
      G.credits = 90000;
      const types=['pulse','cryo','rail','missile','coil','flame','lens','emp','pylon','grav'];
      for(let i=0;i<16;i++){ const t=buildTower(types[i%types.length], spots[i][1], spots[i][2]); if(t){ upgradeTower(t); upgradeTower(t); } }
      G.next = 0.1;
      for(let i=0;i<30*25;i++) simStep(1/30);
      const t0 = G.towers[0]; grantVxp(t0, 200);
      G.entropy = 99; addEntropy(30);
      for(let i=0;i<30*2;i++) simStep(1/30);
    }''')
    pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / 'c1_game.png'))
    xy = pg.evaluate('() => [G.towers[0].x, G.towers[0].y]')
    c = tile_xy(pg, xy[0], xy[1]); pg.mouse.click(c[0], c[1]); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'c2_vet.png'))
    pg.click('#panel [data-act=vet][data-v="0"]'); pg.wait_for_timeout(200)
    pg.click('#panel [data-act=close]')
    pg.click('#bEnt'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'c3_anom.png'))
    pg.click('[data-act=anom]'); pg.wait_for_timeout(300)
    # wait for countdown & preview
    pg.evaluate('() => { G.queue = []; for(let i=0;i<30*2;i++) simStep(1/30); }')
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / 'c4_preview.png'))
    pg.click('#bPause'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / 'c5_pause.png'))
    pg.click('[data-act=resume]')
    pg.evaluate('() => { gameOver(); }'); pg.wait_for_timeout(1300)
    pg.screenshot(path=str(out / 'c6_over.png'))
    pg.click('[data-act=hangar]'); pg.wait_for_timeout(200)
    pg.click('#bArchive'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'c7_archive.png'))
    b.close()
print('ERRORS:', errs[:20])
