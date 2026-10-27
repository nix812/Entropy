# v1.17: random core, Power Nodes, Salvage caches through the real UI.
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
seeds = [int(a) for a in sys.argv[1:]] or [3, 8, 13]
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
    for k, seed in enumerate(seeds):
        if k == 0:
            pg.click('#bLaunch'); pg.wait_for_timeout(200)
            pg.evaluate(f'() => {{ Math.random = mulberry32({seed}); }}')
            pg.click('[data-act=reroll]'); pg.wait_for_timeout(150)
            pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
        else:
            pg.evaluate(f'() => {{ newRun({{ seed: {seed}, chaos: 1, startWave: 1, cols: COLS }}); Render.resetCam(); }}'); pg.wait_for_timeout(500)
        info = pg.evaluate('() => ({ core: G.map.core, cols: COLS, rows: ROWS, nodes: G.nodes.length, main: G.map.lanes[0].tiles.length, start: G.map.lanes[0].tiles[0] })')
        print('seed', seed, info)
        pg.screenshot(path=str(out / f'n{seed}_start.png'))
        if k == 0:
            q = pg.evaluate('() => G.nodes[0]'); tap_tile(pg, q['x'], q['y']); pg.wait_for_timeout(250)
            pg.screenshot(path=str(out / 'n_build_on_node.png'))
            pg.click('[data-act=pick][data-type=pulse]'); pg.wait_for_timeout(100); pg.click('[data-act=build]'); pg.wait_for_timeout(250)
            print('tower on node:', pg.evaluate('() => { const t = G.towers[0]; return { node: t.s.node, dmg: +t.s.dmg.toFixed(2), range: +t.s.range.toFixed(2) }; }'))
            pg.screenshot(path=str(out / 'n_tower_on_node.png'))
            pg.evaluate('() => UI.closePanel()')
            # a cache mid-wave
            pg.evaluate('() => { G.wave = 4; G.spawningDone = false; G.queue = [{ t: 999, type: "drone", lane: G.map.lanes[0], hpm: 1, elite: 0 }]; G.cacheT = 0; for (let i = 0; i < 3; i++) simStep(1/30); }')
            c = pg.evaluate('() => G.caches[0]'); print('cache', c)
            pg.wait_for_timeout(300); pg.screenshot(path=str(out / 'n_cache.png'))
            cr = pg.evaluate('() => [G.credits, G.tokens, G.entropy, G.score]')
            tap_tile(pg, c['x'], c['y']); pg.wait_for_timeout(300)
            print('claimed; caches left', pg.evaluate('() => G.caches.length'), 'before', cr, 'after', pg.evaluate('() => [G.credits, G.tokens, G.entropy, G.score]'))
            pg.screenshot(path=str(out / 'n_claimed.png'))
    b.close()
print('ERRORS:', errs)
