# Sector expansion: start a Normal run, trigger the first wormhole detection and capture the camera pulling back.
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
chaos = sys.argv[3] if len(sys.argv) > 3 else '1'
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 34; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    pg.click(f'[data-act=ch][data-v="{chaos}"]'); pg.wait_for_timeout(150)
    pg.screenshot(path=str(out / 'x01_setup.png'))
    pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / 'x02_start.png'))
    info = pg.evaluate('''() => {
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); G.credits = 9000;
      for(let i=0;i<8;i++) buildTower(['pulse','cryo','rail','missile'][i%4], spots[i][1], spots[i][2]);
      const before = Object.assign({}, G.region);
      G.wave = G.laneWaves[G.lanesOpened] - 2; prepareWave(G.wave + 1);
      return { before, after: G.region, lanes: G.map.lanes.length };
    }''')
    print(info)
    for i, ms in enumerate([60, 900, 1500, 2900]):
        pg.wait_for_timeout(ms - (0 if i == 0 else [60, 900, 1500, 2900][i - 1]))
        pg.screenshot(path=str(out / f'x03_expand_{i}.png'))
    # jump to the full map
    pg.evaluate('() => { while (G.lanesOpened < G.laneWaves.length) { G.wave = G.laneWaves[G.lanesOpened] - 2; prepareWave(G.wave + 1); } }')
    pg.wait_for_timeout(3000)
    pg.screenshot(path=str(out / 'x04_full.png'))
    print(pg.evaluate('() => ({ region: G.region, cols: COLS, rows: ROWS, lanes: G.map.lanes.length })'))
    # zoom + minimap on the full sector
    pg.evaluate('() => { Render.zoomAt(300, 180, 2.4); }'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / 'x05_zoom.png'))
    b.close()
print('ERRORS:', errs)
