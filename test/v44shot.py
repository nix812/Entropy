"""v4.4: Black Market (Exchange panel, a purchase, Node Beacon placement), Red Alert on a boss at the gate,
the spare-power pulse with one-tap Overcharge, and Help opened from Pause returning to Pause.
usage: python3 v44shot.py [W H tag]"""
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v44'
import mkpage; mkpage.mk()
errs, fails = [], []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def tile_xy(pg, x, y):
    return pg.evaluate(f'() => {{ const r=document.querySelector("#cv").getBoundingClientRect(); const p=Render.tileToScreen({x}+0.5,{y}+0.5); return [r.left+p.x*UIS, r.top+p.y*UIS]; }}')
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 14; PROF.seenHelp = true; PROF.seenEvo = true; PROF.seenAssault = true; PROF.runs = 3; PROF.seenVer = VERSION; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(300)
    # a mid-run state with four towers and some credits
    pg.evaluate('''() => { G.credits = 9000; G.wave = 12; G.spawningDone = true; G.next = 30; G.prep = null; prepareWave(13);
      const sp=[]; for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++) if(canBuildAt(x,y)) sp.push([x,y]);
      for(let i=0;i<4;i++){ const t=buildTower(['pulse','rail','cryo','missile'][i], sp[i*7][0], sp[i*7][1]); if (t) t.dmgDone = 100*(i+1); }
      for(let i=0;i<60;i++) simStep(1/30); UI.closePanel(); }''')
    # --- Black Market ---
    pg.click('#bCash'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'{tag}01_market.png'))
    n = pg.evaluate('() => document.querySelectorAll(".mkt").length')
    ok(n == 3, f'market shows {n} items')
    r = pg.evaluate('''() => { const M = marketEnsure(); const id = M.stock.find(i => i !== "beacon"); const before = G.credits; const m = marketBuy(id); return { id, m, paid: before - G.credits, bought: M.bought.slice() }; }''')
    ok(r['m'] and r['paid'] > 0 and r['id'] in r['bought'], f"bought {r['id']} for {r['paid']}: {r['m']}")
    r2 = pg.evaluate(f'''() => marketBuy("{r['id']}")''')
    ok(r2 is None, 'the same item cannot be bought twice from one stock')
    pg.evaluate('() => UI.renderPanel()'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / f'{tag}02_market_bought.png'))
    # Node Beacon: force it into stock, buy, place by tapping
    pg.evaluate('() => { const M = marketEnsure(); M.stock = ["beacon", "tokens", "crate"]; M.bought = []; UI.renderPanel(); }'); pg.wait_for_timeout(100)
    pg.click('[data-act=buy][data-v=beacon]'); pg.wait_for_timeout(300)
    ok(pg.evaluate('() => G.placing') == 'beacon', 'beacon purchase enters placement mode')
    pg.screenshot(path=str(out / f'{tag}03_placing.png'))
    xy = pg.evaluate('() => { for(let y=2;y<ROWS;y++)for(let x=2;x<COLS;x++) if(canBuildAt(x,y) && !isNode(x,y) && Math.abs(x-G.map.core.x)+Math.abs(y-G.map.core.y)>3) return [x,y]; }')
    c = tile_xy(pg, xy[0], xy[1]); pg.mouse.click(c[0], c[1]); pg.wait_for_timeout(250)
    ok(pg.evaluate(f'() => isNode({xy[0]},{xy[1]}) && !G.placing && G.market.beacons === 1'), 'tapping a tile plants the Power Node')
    pg.screenshot(path=str(out / f'{tag}04_node_planted.png'))
    # snapshot keeps the market
    snap_ok = pg.evaluate('() => { snapshotNow(); const S = PROF.runSnap; return !!(S.market && S.market.stock.length === 3 && S.market.beacons === 1); }')
    ok(snap_ok, 'snapshot carries the market state')
    # --- spare power pulse and one-tap Overcharge ---
    pg.evaluate('() => { G.spawningDone = false; G.wave = 10; G.queue = [{ t: 999, type: "drone", lane: G.map.lanes[0], hpm: 1 }]; UI.closePanel(); }'); pg.wait_for_timeout(300)
    ok('spare' in pg.evaluate('() => document.querySelector(".hs.pwr").className'), 'power counter pulses with spare power mid-wave')
    pg.click('.hs.pwr'); pg.wait_for_timeout(300)
    oc = pg.evaluate('() => Math.max(...G.towers.map(t => t.oc || 0))')
    ok(oc >= 1, f'tapping it Overcharges the top tower (+{oc})')
    pg.screenshot(path=str(out / f'{tag}05_overcharge_tap.png'))
    pg.evaluate('() => UI.closePanel()')
    # --- Red Alert: a boss near the core ---
    pg.evaluate('''() => { G.wave = 20; G.spawningDone = false; const L = G.map.lanes[0];
      const e = spawnBoss({ boss: 'behemoth', lane: L, hpm: hpMult(20), elite: 0 }); e.d = L.len - 12; e.hp = e.maxHp * 0.5; e.phase = 1;
      for (let i = 0; i < 30 * 12; i++) simStep(1/30); }''')
    pg.wait_for_timeout(300)
    red = pg.evaluate('() => ({ ra: !!G.redAlert, boss: G.enemies.some(e => e.boss && e.redAlert) })')
    ok(red['ra'] and red['boss'], 'Red Alert raised when the boss is within 8 tiles of the core')
    pg.screenshot(path=str(out / f'{tag}06_red_alert.png'))
    # the core deals ×2.5 to that boss
    mult = pg.evaluate('''() => { const e = G.enemies.find(x => x.boss); G.core.s = coreStats(); e.phaseT = 0; const h0 = e.hp; hit(e, 1000, 'K', G.core, { noStatus: 1 }); const a = h0 - e.hp; e.redAlert = 0; const h1 = e.hp; hit(e, 1000, 'K', G.core, { noStatus: 1 }); const b = h1 - e.hp; e.redAlert = 1; return a / b; }''')
    ok(mult > 2, f'core shells hit the boss at ×{mult:.1f}')
    # --- Help from Pause goes back to Pause ---
    pg.click('#bPause'); pg.wait_for_timeout(150); pg.click('[data-act=help]'); pg.wait_for_timeout(200); pg.click('[data-act=close2]'); pg.wait_for_timeout(200)
    ok(pg.evaluate('() => UI.modalOpen') == 'pause' and pg.evaluate('() => G.paused'), 'closing Help returns to the Pause menu, still paused')
    pg.click('[data-act=resume]'); pg.wait_for_timeout(100)
    ok(pg.evaluate('() => !G.paused && !UI.modalOpen'), 'Resume unpauses')
    b.close()
print('ERRORS:', errs)
if errs or fails: sys.exit(1)
