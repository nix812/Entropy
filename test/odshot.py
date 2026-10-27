# v1.18: Node Link beam, Overdrive meter/button/shockwave, cursed + golden crates.
import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
import mkpage; mkpage.mk()
errs = []
def tap_tile(pg, x, y):
    c = pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({x}+0.5,{y}+0.5); return [r.left+p.x*UIS, r.top+p.y*UIS]; }}')
    pg.mouse.click(c[0], c[1])
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 34; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => { G.credits = 50000; const N = G.nodes; let best = null;
      for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) { const d = Math.hypot(N[i].x - N[j].x, N[i].y - N[j].y); if (!best || d < best[0]) best = [d, N[i], N[j]]; }
      buildTower('rail', best[1].x, best[1].y); buildTower('coil', best[2].x, best[2].y);
      G.core.od = 100; G.wave = 12; G.spawningDone = false; G.queue = [{ t: 999, type: 'drone', lane: G.map.lanes[0], hpm: 1, elite: 0 }];
      const R = G.region; let k = 0;
      for (const kind of ['normal', 'cursed', 'gold']) { for (let n = 0; n < 200; n++) { const x = R.x0 + 2 + ((n * 7 + k * 11) % (R.x1 - R.x0 - 4)), y = R.y0 + 2 + ((n * 5 + k * 3) % (R.y1 - R.y0 - 4)); if (G.map.tiles[y * COLS + x] === 0 && !G.towerAt[y * COLS + x] && !isNode(x, y)) { G.caches.push({ x, y, t: 18, kind, id: 900 + k }); break; } } k++; }
      for (let i = 0; i < 6; i++) { const e = spawnEnemy('tank', { lane: G.map.lanes[0] }); e.d = G.map.lanes[0].len - 2 - i * 0.6; }
      for (let i = 0; i < 4; i++) simStep(1/30);
      return G.links.length; }''')
    print('links', pg.evaluate('() => G.links.length'), 'caches', pg.evaluate('() => G.caches.map(c => c.kind)'))
    pg.wait_for_timeout(300); pg.screenshot(path=str(out / 'od01_field.png'))
    c = pg.evaluate('() => G.map.core'); tap_tile(pg, c['x'], c['y']); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'od02_core_panel.png'))
    pg.click('[data-act=od]'); pg.wait_for_timeout(120)
    pg.screenshot(path=str(out / 'od03_shockwave.png'))
    print('after release od', pg.evaluate('() => G.core.od'), 'panel', pg.evaluate('() => UI.modalOpen'))
    t = pg.evaluate('() => G.towers[0]'); tap_tile(pg, t['x'], t['y']); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / 'od04_link_panel.png'))
    b.close()
print('ERRORS:', errs)
