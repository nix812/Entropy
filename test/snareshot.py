import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root/'test'/'audit'
import mkpage; mkpage.mk()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':852,'height':393},device_scale_factor=2,has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://'+str(root/'test'/'out'/'page.html')); pg.wait_for_timeout(300)
    pg.evaluate('() => { PROF.seenHelp=true; PROF.bestWave=30; PROF.runSnap=null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(300)
    pg.evaluate('''() => { G.credits=5000; const L=G.map.lanes[0].fly; const a=L.pts[0]; const cx=Math.round(a.x+(G.core.x-a.x)*0.55), cy=Math.round(a.y+(G.core.y-a.y)*0.55);
      let t=null; for(let r=0;r<6&&!t;r++) for(let dx=-r;dx<=r&&!t;dx++) for(let dy=-r;dy<=r&&!t;dy++) if(canBuildAt(cx+dx,cy+dy)) t=buildTower('snare',cx+dx,cy+dy);
      for(let dx=-2;dx<=2;dx++) for(let dy=-2;dy<=2;dy++) if(Math.abs(dx)+Math.abs(dy)===2 && canBuildAt(t.x+dx,t.y+dy)) buildTower('coil',t.x+dx,t.y+dy);
      for(let i=0;i<8;i++){ spawnEnemy('flyer',{}); for(let k=0;k<12;k++) simStep(1/30); }
      for(let k=0;k<30*6;k++) simStep(1/30); }''')
    pg.wait_for_timeout(300); pg.screenshot(path=str(out/'sn1.png'))
    tile=pg.evaluate('() => { const t=G.towers.find(t=>t.type==="snare"); const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen(t.cx,t.cy); return [r.left+p.x, r.top+p.y]; }')
    pg.mouse.click(tile[0], tile[1]); pg.wait_for_timeout(300); pg.screenshot(path=str(out/'sn2.png'))
    pg.click('#bBuild') if pg.query_selector('#bBuild') else None
    b.close()
print(errs or 'ok')
