# v4.2 Doctrines: web drawer + seal + locked notable, then each Doctrine on the field. usage: v42doc.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v42'
import mkpage; mkpage.mk()
errs = []
XP = 'let x=0; for (let i=0;i<LV;i++) x += 3000 + 250*i + 3*i*i; PROF.xp = x + 1;'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:3])))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { const LV = 60; ' + XP + ' PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; PROF.seenEvo = true; PROF.seenAssault = true; PROF.alloc = ["start"]; UI.renderHangar(); }')
    pg.evaluate('() => Tree.open()'); pg.wait_for_timeout(600)
    pg.click('[data-tact=docs]'); pg.wait_for_timeout(300)
    print('drawer rows:', pg.evaluate('() => document.querySelectorAll(".docrow").length'))
    pg.screenshot(path=str(out / f'{tag}01_drawer.png'))
    pg.click('[data-tact=docgo][data-n="d1"]'); pg.wait_for_timeout(900)
    print('selected info:', pg.inner_text('#tinfo')[:200].replace('\n', ' | '))
    pg.screenshot(path=str(out / f'{tag}02_seal.png'))
    pg.evaluate('() => { treeAllocate("d1"); Tree.select && Tree.select("c0_0n"); Tree.refresh(); }'); pg.wait_for_timeout(700)
    print('locked info:', pg.inner_text('#tinfo')[:220].replace('\n', ' | '))
    print('tDoc:', pg.inner_text('#tDoc'))
    pg.screenshot(path=str(out / f'{tag}03_locked.png'))
    pg.evaluate('() => Tree.close()'); pg.wait_for_timeout(300)
    # Wildfire + War Economy on the field (level 80: two seals)
    pg.evaluate('() => { const LV = 80; ' + XP + ' PROF.alloc = ["start"]; treeAllocate("d1"); treeAllocate("d5"); UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(600)
    pg.evaluate('''() => { const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<3) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); G.credits = 40000;
      for (let i = 0; i < 6; i++) buildTower(['flame','missile','flame','pulse','rail','flame'][i], spots[i][1], spots[i][2]);
      G.credits = 30000; G.wave = 12;
      for (let i = 0; i < 14; i++) { const e = spawnEnemy('drone', { lane: G.map.lanes[0], hpm: 200 }); e.d = 2 + i * 0.6; e.st.burn = { dps: 20, t: 30, src: null }; }
      G.next = 999; }''')
    pg.wait_for_timeout(2500)
    print('roadfire', pg.evaluate('() => G.zones.filter(z => z.k === "roadfire").length'), 'heat', pg.evaluate('() => +G.heat.toFixed(2)'), 'hot towers', pg.evaluate('() => G.towers.filter(t => t.hot).length'), 'war tier', pg.evaluate('() => warTier()'))
    print('chips:', pg.inner_text('#chips').replace('\n', ' | '))
    pg.screenshot(path=str(out / f'{tag}04_wildfire_chest.png'))
    pg.evaluate('() => { G.core.hp = 0; gameOver(); }'); pg.wait_for_timeout(1500)
    pg.click('[data-act=hangar]'); pg.wait_for_timeout(400)
    # Marksman
    pg.evaluate('() => { const LV = 60; ' + XP + ' PROF.alloc = ["start"]; treeAllocate("d0"); PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(600)
    pg.evaluate('''() => { const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); G.credits = 40000; let i = 0; while (gridFree() > 0 && i < 30) { buildTower(['rail','pulse','missile'][i%3], spots[i][1], spots[i][2]); i++; }
      for (let k = 0; k < 8; k++) { const e = spawnEnemy('drone', { lane: G.map.lanes[0], hpm: 300 }); e.d = 3 + k; } G.next = 999; }''')
    pg.wait_for_timeout(1500)
    print('marksman grid', pg.evaluate('() => gridUsed() + "/" + gridCap()'), 'towers', pg.evaluate('() => G.towers.length'))
    t = pg.evaluate('() => [G.towers[0].x, G.towers[0].y]')
    c = pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({t[0]}+0.5,{t[1]}+0.5); return [r.left+p.x*UIS, r.top+p.y*UIS]; }}')
    pg.screenshot(path=str(out / f'{tag}05_marksman.png'))
    pg.mouse.click(c[0], c[1]); pg.wait_for_timeout(400)
    print('oc row:', pg.evaluate('() => (document.querySelector(".modes.oc") || {}).innerText'))
    pg.screenshot(path=str(out / f'{tag}06_marksman_panel.png'))
    b.close()
print('ERRORS:', errs)
