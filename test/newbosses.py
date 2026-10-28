# The v2.3 oddballs on the live page: intro cards, the worm burrowing and swallowing (and spitting back on death),
# the Auditor's drain and refund, the Snail's slime and regen. usage: newbosses.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'nb'
import mkpage; mkpage.mk()
errs = []
SETUP = '''() => {
  const spots=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ if(!canBuildAt(x,y))continue; let c=0; for(const L of G.map.lanes) for(const p of L.pts) if((p.x-x-.5)**2+(p.y-y-.5)**2<5) c++; spots.push([c,x,y]); }
  spots.sort((a,b)=>b[0]-a[0]); G.credits = 30000;
  for(let i=0;i<14;i++){ const t = buildTower(['pulse','rail','missile','coil','cryo'][i%5], spots[i][1], spots[i][2]); if (t) { upgradeTower(t); t.dmgDone = 1000 * i; } }
  G.wave = 40; G.power = 500; G.next = 999; G.credits = 5000;
}'''
def spawn(pg, id, d=4):
    return pg.evaluate(f'() => {{ const B = BOSSES.find(b => b.id === "{id}"); const e = spawnBoss({{ boss: "{id}", lane: G.map.lanes[0], L: G.map.lanes[0], hpm: hpMult(40), d: {d} }}); window.__b = e; return Math.round(e.maxHp); }}')
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:4])))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate(SETUP)
    # --- worm
    spawn(pg, 'worm', 3); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / f'{tag}01_worm_intro.png'))
    pg.evaluate('() => document.querySelector("#bossIntro").click()'); pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out / f'{tag}02_worm_walk.png'))
    n0 = pg.evaluate('() => G.towers.length')
    pg.evaluate('() => { const e = window.__b; e.timer = 0; }'); pg.wait_for_timeout(600)
    print('worm burrowed:', pg.evaluate('() => window.__b.burrowT > 0'), 'targetable:', pg.evaluate('() => enemyTargetable(window.__b)'))
    pg.screenshot(path=str(out / f'{tag}03_worm_burrow.png'))
    pg.wait_for_timeout(2500)
    print('towers before/after surfacing:', n0, pg.evaluate('() => G.towers.length'), 'gut', pg.evaluate('() => window.__b.gut.length'))
    pg.screenshot(path=str(out / f'{tag}04_worm_surface.png'))
    pg.evaluate('() => { const e = window.__b; e.gut.push(...G.towers.slice(0, 1)); G.towerAt[G.towers[0].y * COLS + G.towers[0].x] = undefined; delete G.towerAt[G.towers[0].y * COLS + G.towers[0].x]; G.towers.shift(); recomputeAuras(); }')
    gut = pg.evaluate('() => window.__b.gut.length'); nmid = pg.evaluate('() => G.towers.length')
    pg.evaluate('() => { const e = window.__b; for (let i = 0; i < 6 && !e.dead; i++) { e.phaseT = 0; e.burrowT = 0; hit(e, e.hp + 1e12, "K", null, { noStatus: 1 }); } }'); pg.wait_for_timeout(400)
    print('worm killed: gut', gut, 'towers', nmid, '->', pg.evaluate('() => G.towers.length'), 'towerAt synced', pg.evaluate('() => G.towers.every(t => G.towerAt[t.y * COLS + t.x] === t)'))
    pg.evaluate('() => { if (G.draft) takeBoon(G.draft[0]); UI.closePanel && 0; }'); pg.wait_for_timeout(300)
    if pg.evaluate('() => UI.modalOpen === "draft"'): pg.click('[data-act=boon][data-v="0"]'); pg.wait_for_timeout(300)
    # --- auditor
    spawn(pg, 'auditor', 3); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / f'{tag}05_auditor_intro.png'))
    pg.evaluate('() => document.querySelector("#bossIntro").click()')
    c0 = pg.evaluate('() => G.credits'); pg.wait_for_timeout(3500)
    c1 = pg.evaluate('() => G.credits'); aud = pg.evaluate('() => window.__b.audited')
    pg.evaluate('() => { window.__b.timer = 0; }'); pg.wait_for_timeout(300)
    print('auditor drained', round(c0 - c1), 'held', aud, 'frozen towers', pg.evaluate('() => G.towers.filter(t => t.disabled > 0).length'))
    pg.screenshot(path=str(out / f'{tag}06_auditor.png'))
    c2 = pg.evaluate('() => G.credits'); held = pg.evaluate('() => window.__b.audited')
    pg.evaluate('() => { const e = window.__b; for (let i = 0; i < 6 && !e.dead; i++) { e.phaseT = 0; hit(e, e.hp + 1e12, "K", null, { noStatus: 1 }); } }'); pg.wait_for_timeout(300)
    print('refund', round(pg.evaluate('() => G.credits') - c2), 'expected about', round(held * 1.25))
    if pg.evaluate('() => UI.modalOpen === "draft"'): pg.click('[data-act=boon][data-v="0"]'); pg.wait_for_timeout(300)
    # --- snail
    spawn(pg, 'snail', 5); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / f'{tag}07_snail_intro.png'))
    pg.evaluate('() => document.querySelector("#bossIntro").click()'); pg.evaluate('() => { G.speed = 3; }'); pg.wait_for_timeout(4000)
    pg.evaluate('() => { const e = window.__b; e.hp = e.maxHp * 0.8; e.lastHit = G.time - 5; }'); h0 = pg.evaluate('() => window.__b.hp / window.__b.maxHp'); pg.wait_for_timeout(1500)
    print('snail regen', round(h0, 3), '->', round(pg.evaluate('() => window.__b.hp / window.__b.maxHp'), 3), 'slime points', pg.evaluate('() => (G.slime || []).length'))
    pg.screenshot(path=str(out / f'{tag}08_snail.png'))
    b.close()
print('ERRORS:', errs)
