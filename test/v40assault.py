# v4.0 Strain Assault: first-time intro, HUD chip, free refit on the sell button, assault enemies with their aura,
# live chip, and the outcome alert. usage: v40assault.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v40a'
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
    pg.evaluate('() => { PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; PROF.seenEvo = true; PROF.seenAssault = false; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    pg.evaluate('''() => { const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); G.credits = 30000; window.__spots = spots;
      for (let i = 0; i < 9; i++) { const t = buildTower(['pulse','pulse','rail','pulse','missile','pulse','cryo','pulse','rail'][i], spots[i][1], spots[i][2]); if (t) { upgradeTower(t); t.dmgDone = [900, 800, 300, 700, 200, 600, 50, 650, 250][i]; } }
      G.wave = 13; G.prep = null; G.enemies.length = 0; G.queue.length = 0; G.spawningDone = true; G.assaultNext = 14; intelUpdate(); prepareWave(13); }''')
    pg.wait_for_timeout(1300)
    print('assault:', pg.evaluate('() => G.assault && { w: G.assault.w, name: G.assault.name, genes: G.assault.genes, el: G.assault.el, why: G.assault.why }'))
    print('modal:', pg.evaluate('() => UI.modalOpen'), 'paused', pg.evaluate('() => G.paused'))
    pg.screenshot(path=str(out / f'{tag}01_intro.png'))
    if pg.evaluate('() => UI.modalOpen === "assault"'): pg.click('[data-act=assaultDone]'); pg.wait_for_timeout(300)
    print('seenAssault', pg.evaluate('() => PROF.seenAssault'), 'chip:', pg.evaluate('() => (document.querySelector("#chips [data-assault]") || {}).textContent'))
    t0 = pg.evaluate('() => [G.towers[0].x, G.towers[0].y, G.towers[0].invested, sellRefund(G.towers[0])]')
    tap_tile(pg, t0[0], t0[1]); pg.wait_for_timeout(300)
    print('invested', t0[2], 'refund', t0[3], 'sell btn:', pg.inner_text('[data-act=sell]').replace('\n', ' | '))
    pg.screenshot(path=str(out / f'{tag}02_refit.png'))
    pg.evaluate('() => UI.closePanel()')
    # play wave 13 out instantly, then start the assault wave
    pg.evaluate('() => { G.prep = null; prepareWave(14); startWave(); G.speed = 1; }')
    pg.wait_for_timeout(5000)
    print('state', pg.evaluate('() => G.assault.state'), 'n', pg.evaluate('() => G.assault.n'), 'refit', pg.evaluate('() => G.refit'), 'assault enemies', pg.evaluate('() => G.enemies.filter(e => e.assault).length'))
    print('chip live:', pg.evaluate('() => (document.querySelector("#chips [data-assault]") || {}).textContent'))
    pg.screenshot(path=str(out / f'{tag}03_live.png'))
    # finish: everything killed
    pg.evaluate('() => { for (const q of G.queue) if (q.assault) G.assault.killed++; G.queue = G.queue.filter(q => !q.assault); for (const e of G.enemies.slice()) if (e.assault && !e.dead) kill(e, null, {}); }')
    pg.wait_for_timeout(600)
    print('resolved', pg.evaluate('() => ({ state: G.assault.state, won: G.assault.won, cap: gridCap(), bonus: G.gridBonus, stats: G.stats.assaults && [G.stats.assaults.won, G.stats.assaults.lost] })'))
    pg.screenshot(path=str(out / f'{tag}04_broken.png'))
    b.close()
print('ERRORS:', errs)
