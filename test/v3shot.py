# v3.0: power grid (HUD readout, build panel full state, overcharge buttons and pips), evolved enemies with gene markings,
# next-wave gene chips and the evolution toast. usage: v3shot.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v3'
import mkpage; mkpage.mk()
errs = []
def tap_tile(pg, x, y):
    c = pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({x}+0.5,{y}+0.5); return [r.left+p.x*UIS, r.top+p.y*UIS]; }}')
    pg.mouse.click(c[0], c[1])
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:3])))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => { G.wave = 24; G.credits = 20000;
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y) || isNode(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); window.__spots = spots;
      let i = 0; while (gridFree() > 0 && i < spots.length) { buildTower(['pulse','rail','missile','cryo','flame','coil'][i%6], spots[i][1], spots[i][2]); i++; }
      return [gridUsed(), gridCap()]; }''')
    print('grid after filling:', pg.evaluate('() => [gridUsed(), gridCap(), G.towers.length]'))
    # build panel when full
    sp = pg.evaluate('() => { const s = window.__spots.find(s => canBuildAt(s[1], s[2])); return s; }')
    tap_tile(pg, sp[1], sp[2]); pg.wait_for_timeout(300)
    pg.click('[data-act=pick][data-type=lens]'); pg.wait_for_timeout(250)
    print('build button:', pg.inner_text('.pfoot .btn').replace('\n', ' | '))
    pg.screenshot(path=str(out / f'{tag}01_grid_full.png'))
    pg.evaluate('() => UI.closePanel()')
    # overcharge: sell one tower, overcharge another twice
    pg.evaluate('() => { sellTower(G.towers[G.towers.length - 1]); sellTower(G.towers[G.towers.length - 1]); }')
    t0 = pg.evaluate('() => { const t = G.towers[1]; return [t.x, t.y, Math.round(t.s.dmg)]; }')
    tap_tile(pg, t0[0], t0[1]); pg.wait_for_timeout(300)
    pg.click('[data-act=oc][data-v="2"]'); pg.wait_for_timeout(300)
    print('overcharged dmg', t0[2], '->', pg.evaluate('() => Math.round(G.towers[1].s.dmg)'), 'grid', pg.evaluate('() => [gridUsed(), gridCap()]'), 'buttons', pg.inner_text('.modes.oc').replace('\n', ' '))
    pg.screenshot(path=str(out / f'{tag}02_overcharge.png'))
    pg.evaluate('() => UI.closePanel()')
    # evolution: seed the gene pool so plating + wings spread, prepare a wave, show chips, then let it spawn
    pg.evaluate('''() => { G.geneFit = { 'plating': { s: 6, n: 10 }, 'wings': { s: 5, n: 10 }, 'plating+wings': { s: 7, n: 10 }, '': { s: -3, n: 10 } };
      G.prep = null; G.enemies.length = 0; G.queue.length = 0; G.spawningDone = true; prepareWave(25); G.next = 3; }''')
    pg.wait_for_timeout(400)
    print('next-wave genes:', pg.evaluate('() => Object.fromEntries(Object.entries(G.prep.genes).map(([k, v]) => [k, Math.round(v * 100)]))'))
    print('chips:', pg.evaluate('() => [...document.querySelectorAll("#chips .evchip")].map(c => c.textContent)'))
    pg.screenshot(path=str(out / f'{tag}03_gene_chips.png'))
    pg.evaluate('() => document.querySelector("#chips [data-gene]") && document.querySelector("#chips [data-gene]").click()'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'{tag}04_gene_tip.png'))
    pg.evaluate('() => { G.speed = 2; }'); pg.wait_for_timeout(9000)
    print('enemies with genes on field:', pg.evaluate('() => G.enemies.filter(e => e.genes && e.genes.length).length'), 'fliers', pg.evaluate('() => G.enemies.filter(e => e.fly).length'))
    pg.evaluate('() => { G.speed = 1; Render.setZoom && 0; }')
    pg.screenshot(path=str(out / f'{tag}05_evolved.png'))
    b.close()
print('ERRORS:', errs)
