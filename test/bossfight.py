# Play a real boss wave through the live UI loop (RAF) and report how the boss kill ends.
# usage: bossfight.py [seed] [wave] [chaos]
import pathlib, sys, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
seed = int(sys.argv[1]) if len(sys.argv) > 1 else 7
wave = int(sys.argv[2]) if len(sys.argv) > 2 else 10
chaos = int(sys.argv[3]) if len(sys.argv) > 3 else 1
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=1, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.wait_for_timeout(300)
    pg.evaluate('() => { PROF.bestWave = 34; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200)
    pg.click(f'[data-act=ch][data-v="{chaos}"]'); pg.wait_for_timeout(100)
    pg.evaluate(f'() => {{ Math.random = mulberry32({seed}); }}')
    pg.click('[data-act=launch]'); pg.wait_for_timeout(300)
    pg.evaluate(f'''() => {{
      const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){{ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }}
      spots.sort((a,b)=>b[0]-a[0]); G.credits = 6000;
      const types=['coil','cryo','pulse','flame','rail','missile','coil','cryo','pulse','coil'];
      for(let i=0;i<10;i++){{ const t=buildTower(types[i], spots[i][1], spots[i][2]); if(t){{ upgradeTower(t); }} }}
      for (const t of G.towers) grantVxp(t, 200);
      G.wave = {wave} - 1; G.prep = null; prepareWave({wave}); G.speed = 3; G.next = 0.2;
    }}''')
    state = None
    for i in range(240):
        pg.wait_for_timeout(250)
        s = pg.evaluate('() => ({ w: G.wave, t: Math.round(G.time), boss: G.enemies.filter(e => e.boss && !e.dead).length, bossSeen: !!G.bossAlive || G.stats.bossKills > 0, kills: G.stats.bossKills, draft: !!G.draft, modal: UI.modalOpen, en: G.enemies.length, over: G.over, cp: G.checkpoint, spawningDone: G.spawningDone })')
        if s['modal'] == 'draft' or s['over'] or (s['kills'] and not s['draft']) or errs:
            state = s; break
        if s['draft'] and not s['modal']:
            state = s; state['STUCK'] = True; pg.wait_for_timeout(600); state['modalLater'] = pg.evaluate('() => UI.modalOpen'); break
        state = s
    print('seed', seed, 'final', state)
    pg.screenshot(path=str(out / f'fight_{seed}.png'))
    b.close()
print('ERRORS:', errs[:5])
