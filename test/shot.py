import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
body = (root / 'dist' / 'entropy.html').read_text()
page_html = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
             '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>'
             '</head><body>' + body + '</body></html>')
out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
(out / 'page.html').write_text(page_html)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, has_touch=True)
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(out / 'page.html'))
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(out / '1_hangar.png'))
    pg.click('#bLaunch'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / '2_setup.png'))
    pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.click('[data-act=close2]'); pg.wait_for_timeout(200)
    # place towers via sim API and fast-forward
    pg.evaluate('''() => {
      PROF.bestWave = 32;
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const p of G.map.lanes[0].pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<6) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]);
      G.credits = 6000;
      const types=['pulse','rail','cryo','missile','coil','flame','lens','emp','grav','pylon','forge'];
      for(let i=0;i<14;i++){ const t=buildTower(types[i%types.length], spots[i][1], spots[i][2]); if(t && i<6){ upgradeTower(t); upgradeTower(t); upgradeTower(t, 1);} }
      G.storms.push({id:999,types:['ion'],x:12,y:7,vx:0.1,vy:0,r:3.5,life:60,age:0,mael:false,spawnT:0,rot:0});
      for(let i=0;i<30*70;i++) simStep(1/30);
    }''')
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(out / '3_game.png'))
    # tap a tower
    t = pg.evaluate('() => { const t=G.towers[0]; const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen(t.x+0.5,t.y+0.5); return [r.left+p.x, r.top+p.y]; }')
    pg.mouse.click(t[0], t[1]); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / '4_tower.png'))
    pg.click('#bStats'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / '5_fullhud.png'))
    pg.evaluate('() => { PROF.xp = 400000; }')
    pg.click('#bWeb'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / '6_tree.png'))
    pg.evaluate('() => { treeAllocate("c0_0n"); treeAllocate("h0"); }')
    pg.mouse.click(422, 195); pg.wait_for_timeout(300)
    pg.click('[data-tact=builds]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / '7_tree2.png'))
    pg.click('[data-tact=close]'); pg.wait_for_timeout(200)
    pg.evaluate('() => { G.core.hp = 1; G.enemies.forEach(e=>{e.d=e.L.len}); for(let i=0;i<10;i++) simStep(1/30); }')
    pg.wait_for_timeout(1400)
    pg.screenshot(path=str(out / '8_over.png'))
    pg2 = b.new_page(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True)
    pg2.on('pageerror', lambda e: errs.append('PAGEERROR2 ' + str(e)))
    pg2.goto('file://' + str(out / 'page.html')); pg2.wait_for_timeout(500)
    pg2.screenshot(path=str(out / '9_portrait.png'))
    b.close()
print('ERRORS:', errs[:20])
