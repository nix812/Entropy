# Boss rework: intro card with portrait, boss bar phases, phase shift FX and the empowered ability, breach damage.
# usage: bossintro.py [W H tag boss]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'bi'
boss = sys.argv[4] if len(sys.argv) > 4 else 'overmind'
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('''() => {
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
      spots.sort((a,b)=>b[0]-a[0]); G.credits = 30000;
      for(let i=0;i<10;i++){ const t = buildTower(['pulse','rail','missile','coil','lens'][i%5], spots[i][1], spots[i][2]); if (t) { upgradeTower(t); upgradeTower(t); } }
      G.wave = 30; G.power = 2000; G.next = 999;
    }''')
    hp = pg.evaluate(f'''() => {{ const B = BOSSES.find(b => b.id === "{boss}"); const e = spawnBoss({{ boss: "{boss}", lane: G.map.lanes[0], L: B.fly ? G.map.lanes[0].fly : G.map.lanes[0], hpm: hpMult(30), d: 6 }}); window.__b = e; return [Math.round(e.maxHp), Math.round(30 * B.hp * hpMult(30) * bossHpX(30))]; }}''')
    print('boss hp (adaptive, fixed curve):', hp)
    pg.wait_for_timeout(450)
    print('intro visible:', pg.evaluate('() => !document.querySelector("#bossIntro").hidden'), 'slowmo', round(pg.evaluate('() => UI.slowmo'), 2))
    pg.screenshot(path=str(out / f'{tag}01_intro.png'))
    pg.wait_for_timeout(4200)
    print('intro hidden after:', pg.evaluate('() => document.querySelector("#bossIntro").hidden'))
    # phase II
    r = pg.evaluate('() => { const e = window.__b; hit(e, e.maxHp * 0.5, "K", null, { noStatus: 1 }); return { hpFrac: +(e.hp / e.maxHp).toFixed(3), phase: e.phase, phaseT: e.phaseT, disabled: G.towers.filter(t => t.disabled > 0).length }; }')
    print('after big hit:', r)
    pg.wait_for_timeout(250)
    r2 = pg.evaluate('() => { const e = window.__b; const before = e.hp; hit(e, e.maxHp * 0.1, "K", null, { noStatus: 1 }); return { tookFrac: +((before - e.hp) / e.maxHp).toFixed(4), disabledTowers: G.towers.filter(t => t.disabled > 0).length, enemies: G.enemies.length }; }')
    print('during phase shift:', r2)
    pg.screenshot(path=str(out / f'{tag}02_phase2.png'))
    pg.wait_for_timeout(3000)
    pg.evaluate('() => { const e = window.__b; hit(e, e.hp - e.maxHp * 0.2, "K", null, { noStatus: 1 }); }')
    pg.wait_for_timeout(300)
    print('final phase:', pg.evaluate('() => ({ phase: window.__b.phase, hp: +(window.__b.hp / window.__b.maxHp).toFixed(2) })'))
    pg.screenshot(path=str(out / f'{tag}03_final.png'))
    # breach
    br = pg.evaluate('() => { const e = window.__b; G.core.shield = 0; G.core.hp = G.core.max; const h0 = G.core.hp; e.d = e.L.len; simStep(1/30); return { coreLost: +((h0 - G.core.hp) / G.core.max).toFixed(2), over: G.over }; }')
    print('breach:', br)
    b.close()
print('ERRORS:', errs)
