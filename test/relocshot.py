# Core affixes + relocation through the real UI: core panel, relocation mode, preview, confirm, paid second move.
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'r'
import mkpage; mkpage.mk()
errs = []
def tap_tile(pg, x, y):
    c = pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({x}+0.5,{y}+0.5); return [r.left+p.x*UIS, r.top+p.y*UIS]; }}')
    pg.mouse.click(c[0], c[1])
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 34; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => {
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); G.credits = 30000;
      for(let i=0;i<8;i++) buildTower(['pulse','cryo','rail','missile'][i%4], spots[i][1], spots[i][2]);
      for (let i=0;i<7;i++) coreUpgrade(i%3===2 ? 'shield' : 'weapon');
    }''')
    # core panel before a checkpoint
    c = pg.evaluate('() => G.map.core'); tap_tile(pg, c['x'], c['y']); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}01_core_panel.png'))
    print('affixes:', pg.evaluate('() => G.core.affixes.map(a => RARITY[a.tier].name + " " + affixText(a))'))
    pg.click('[data-act=crr]'); pg.wait_for_timeout(150)
    print('after reroll:', pg.evaluate('() => G.core.affixes.length'), 'rerolls', pg.evaluate('() => G.core.rerolls'))
    # reach the first wormhole checkpoint with the field clear
    pg.evaluate('() => { G.wave = G.laneWaves[0] - 2; G.prep = null; prepareWave(G.wave + 1); G.enemies.length = 0; G.queue.length = 0; G.spawningDone = true; G.cpDue = G.wave + 1; }')
    pg.wait_for_timeout(500)
    print('checkpoint', pg.evaluate('() => G.checkpoint'), 'canRelocate', pg.evaluate('() => canRelocate()'))
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'{tag}02_core_panel_cp.png'))
    pg.click('[data-act=reloc]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'{tag}03_reloc_mode.png'))
    # pick the candidate with the longest total road
    best = pg.evaluate('''() => { let best = null; for (const i of G.reloc.cands) { const P = planRelocation(i % COLS, (i / COLS) | 0); if (P && (!best || P.after.reduce((a,b)=>a+b,0) > best.after.reduce((a,b)=>a+b,0))) best = P; } return { x: best.x, y: best.y, before: best.before, after: best.after }; }''')
    print('plan', best)
    tap_tile(pg, best['x'], best['y']); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'{tag}04_preview.png'))
    cpT0 = pg.evaluate('() => G.cpT')
    pg.click('[data-act=rgo]'); pg.wait_for_timeout(500)
    print('moved to', pg.evaluate('() => G.map.core'), 'relocUsed', pg.evaluate('() => G.relocUsed'), 'cpT paused', pg.evaluate('() => G.cpT') - cpT0 < 0.2, 'reloc mode', pg.evaluate('() => !!G.reloc'))
    pg.screenshot(path=str(out / f'{tag}05_moved.png'))
    # second move costs credits
    c = pg.evaluate('() => G.map.core'); tap_tile(pg, c['x'], c['y']); pg.wait_for_timeout(250)
    print('second move button:', pg.inner_text('[data-act=reloc]').replace('\n', ' | '))
    cr0 = pg.evaluate('() => G.credits')
    pg.click('[data-act=reloc]'); pg.wait_for_timeout(200)
    i = pg.evaluate('() => [...G.reloc.cands].find(i => planRelocation(i % COLS, (i / COLS) | 0))')
    tap_tile(pg, i % pg.evaluate('COLS'), i // pg.evaluate('COLS')); pg.wait_for_timeout(200)
    pg.click('[data-act=rgo]'); pg.wait_for_timeout(300)
    print('paid', cr0 - pg.evaluate('() => G.credits'))
    # resume: lanes open, enemies walk the new roads
    pg.evaluate('() => resumeCheckpoint()'); pg.wait_for_timeout(2500)
    print('after resume: wave', pg.evaluate('() => G.wave'), 'enemies', pg.evaluate('() => G.enemies.length'), 'over', pg.evaluate('() => G.over'))
    pg.screenshot(path=str(out / f'{tag}06_running.png'))
    b.close()
print('ERRORS:', errs)
