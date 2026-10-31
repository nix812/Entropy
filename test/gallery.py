"""Visual gallery for art work: every tower (incl. specs and elements), every enemy and boss, on a real map.
usage: python3 gallery.py [tag] [W H]   -> test/out/gal_<tag>_*.png
Shots: towers (zoomed), enemies (zoomed), bosses (zoomed), battle (z=1, mid-fight), wide (zoomed all the way out)."""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
tag = sys.argv[1] if len(sys.argv) > 1 else 'cur'
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (852, 393)
mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=3, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FILE' not in m.text and 'TUNNEL' not in m.text else None)
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; PROF.settings.shake = false; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200)
    pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    pg.evaluate('''() => { if (UI.closeModal) UI.closeModal(); document.querySelector('#toasts').style.display = 'none';
      const tp = document.querySelector('#tip'); if (tp) tp.style.display = 'none'; const bi = document.querySelector('#bossIntro'); if (bi) bi.style.visibility = 'hidden'; G.credits = 1e7; G.wave = 30; }''')
    # build a showcase: every tower type, base + both specs, in rows of buildable tiles near the core
    info = pg.evaluate('''() => {
      const types = Object.keys(TOWERS), spots = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
      const c = G.map.core; spots.sort((a, b) => (Math.hypot(a[0] - c.x, a[1] - c.y)) - (Math.hypot(b[0] - c.x, b[1] - c.y)));
      G.gridBonus = 200; const built = [];
      for (const ty of types) for (const sp of [0, 1, 2]) {
        const s = spots.shift(); if (!s) break; const t = buildTower(ty, s[0], s[1]); if (!t) continue;
        if (sp) { upgradeTower(t); upgradeTower(t); upgradeTower(t, sp); }
        built.push([ty, sp, s[0], s[1]]);
      }
      return { built, core: [c.x, c.y] };
    }''')
    def zoom_to(x, y, z):
        pg.evaluate('''([x, y, z]) => { Render.resetCam(); const s = Render.tileToScreen(x, y); Render.zoomAt(s.x, s.y, z); }''', [x, y, z])
        pg.wait_for_timeout(400)
    cx, cy = info['core']
    zoom_to(cx + 0.5, cy + 0.5, 2.6)
    pg.screenshot(path=str(out / f'gal_{tag}_towers.png'))
    # enemies: one of each type (plus some genes and an elite) parked along the main lane
    pg.evaluate('''() => {
      const L = G.map.lanes[0], types = ['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'phantom', 'medic', 'shielder', 'voidling', 'pirate'];
      const n = L.len || 30; let d = 2;
      for (const t of types) { const e = spawnEnemy(t, { d, pirate: t === 'pirate' }); e.spd = 0; e.hp = e.maxHp * 0.6; d += 1.3; }
      const gs = [['plating'], ['wings'], ['haste'], ['shell'], ['regen'], ['ward'], ['bulk']];
      for (const g of gs) { const e = spawnEnemy('drone', { d, genes: g, gel: 'T' }); e.spd = 0; d += 1.3; }
      const el = spawnEnemy('tank', { d, elite: 1 }); el.spd = 0; d += 1.5;
      for (const e of G.enemies) e.cloaked = false;
      G.paused = true; window.__galD = 2;
    }''')
    lp = pg.evaluate('() => { const o = {}; lanePos(G.map.lanes[0], 8, o); return [o.x, o.y]; }')
    zoom_to(lp[0], lp[1], 3.2)
    pg.screenshot(path=str(out / f'gal_{tag}_enemies.png'))
    lp2 = pg.evaluate('() => { const o = {}; lanePos(G.map.lanes[0], 18, o); return [o.x, o.y]; }')
    zoom_to(lp2[0], lp2[1], 3.2)
    pg.screenshot(path=str(out / f'gal_{tag}_enemies2.png'))
    # bosses: a few at once, stationary
    pg.evaluate('''() => { for (const e of G.enemies) e.dead = true; G.enemies = [];
      const ids = ['behemoth', 'queen', 'wraith', 'overmind', 'titan', 'cat'];
      let d = 3; for (const id of ids) { const e = spawnBoss({ boss: id, lane: G.map.lanes[0], hpm: 1, elite: 0 }); e.d = d; lanePos(e.L, e.d, e); e.spd = 0; d += 3.2; }
      G.bossAlive = null; }''')
    pg.wait_for_timeout(300)
    bp = pg.evaluate('() => { const o = {}; lanePos(G.map.lanes[0], 10, o); return [o.x, o.y]; }')
    zoom_to(bp[0], bp[1], 1.8)
    pg.screenshot(path=str(out / f'gal_{tag}_bosses.png'))
    pg.evaluate('''() => { for (const e of G.enemies) e.dead = true; G.enemies = [];
      const ids = ['gloop', 'whale', 'duck', 'fsm', 'worm', 'auditor', 'snail'];
      let d = 3; for (const id of ids) { const e = spawnBoss({ boss: id, lane: G.map.lanes[0], hpm: 1, elite: 0 }); e.d = d; lanePos(e.L, e.d, e); e.spd = 0; d += 3.2; }
      G.bossAlive = null; }''')
    pg.wait_for_timeout(300)
    zoom_to(bp[0], bp[1], 1.8)
    pg.screenshot(path=str(out / f'gal_{tag}_bosses2.png'))
    # a live battle at default zoom
    pg.evaluate('''() => { for (const e of G.enemies) e.dead = true; G.enemies = []; G.paused = false; G.wave = 24; G.next = 0;
      for (let i = 0; i < 30 * 9; i++) simStep(1 / 30); }''')
    pg.evaluate('() => Render.resetCam()'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / f'gal_{tag}_battle.png'))
    zoom_to(cx + 0.5, cy + 0.5, 2.2)
    pg.screenshot(path=str(out / f'gal_{tag}_battle_zoom.png'))
    # as far out as the camera allows
    pg.evaluate('() => { Render.resetCam(); const L = Render.layout; Render.zoomAt(L.W / 2, L.H / 2, 0.01); }'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / f'gal_{tag}_wide.png'))
    perf = pg.evaluate('''() => new Promise(res => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(n / 1.5); } requestAnimationFrame(f); })''')
    b.close()
print('fps(headless, rough):', round(perf))
print('ERRORS:', errs[:10])
