"""Times Render.draw on a busy mid-game scene. usage: python3 drawbench.py [page.html] -> ms per frame at z=1, zoomed in, zoomed out.
GENES=1: every enemy carries 1-3 evolved genes and a third are Strain Assault units (swarm overlay cost).
NUKE=1 (6.2): each timed section starts a Nuke detonation at the core (the first second, its busiest part).
ZONE=id (6.3): the run is in that zone (default: none, the plain board). ZFXAB=1: also times each view with Zone effects off,
interleaved in short blocks, and the zone layer itself (ambient particles, backdrop) per frame: <view>ZoneLayer. The board decals are baked
into the map layer and cost nothing per frame.
PROBE=1 (6.5): 5 loot sites (with their guards) around the core and the probe in flight, selected, with cargo."""
import os, pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
page = sys.argv[1] if len(sys.argv) > 1 else None
if not page: mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=3)
    pg.goto('file://' + page); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200)
    if os.environ.get('ZONE'): pg.evaluate('(z) => { const s = UI._dbg.setup(); s.secSeed = s.seed; s.secOffers = [z, "iron", "hive"]; s.sector = z; UI._dbg.renderSetup(); }', os.environ['ZONE'])
    pg.click('[data-act=launch]'); pg.wait_for_timeout(1800)
    pg.evaluate('''() => { const GENES = ''' + ('true' if os.environ.get('GENES') else 'false') + '''; if (UI.closeModal) UI.closeModal(); G.credits = 1e7; G.gridBonus = 200; G.wave = 30;
      const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
      const c = G.map.core; spots.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
      const types = Object.keys(TOWERS); for (let i = 0; i < 36 && spots.length; i++) { const s = spots.shift(); buildTower(types[i % types.length], s[0], s[1]); }
      const GS = GENES ? [['plating', 'shell'], ['haste', 'regen'], ['ward', 'bulk', 'shell'], ['cloak', 'haste'], ['wings', 'regen'], ['brood', 'ward'], ['shell'], ['plating', 'haste', 'regen']] : null;
      if (GENES) G.assault = { w: 30, genes: ['plating', 'haste'], el: null, key: 'haste+plating', state: 'live', n: 30, killed: 0, leaked: 0, name: 'Test Strain' };
      for (let i = 0; i < 90; i++) { const ty = ['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic'][i % 6];
        const q = { d: (i * 0.37) % 25 }; if (GENES) { q.genes = GS[i % GS.length].filter(g => geneOk(ty, g, 30)); q.gel = 'T'; if (i % 3 === 0) { q.assault = 1; q.genes = ['plating', 'haste'].filter(g => geneOk(ty, g, 30)); } }
        const e = spawnEnemy(ty, q); }
      G.paused = true; window.__stopLoop = true; }''')
    if os.environ.get('PROBE'): pg.evaluate('''() => { if (!G.probe) return; G.sites = []; for (let i = 0; i < 5; i++) { const s = siteSpawn(); if (!s) continue; const a = i * 1.3; s.x = G.core.x + Math.cos(a) * 6; s.y = G.core.y + Math.sin(a) * 4; for (const g of s.g) { g.x = s.x + 1; g.y = s.y; g.hx = g.x; g.hy = g.y; g.hp = g.max * 0.6; } }
      const P = G.probe; P.home = 0; P.x = G.core.x + 3; P.y = G.core.y + 2; P.tx = G.core.x - 6; P.ty = G.core.y; P.hp = P.max * 0.7; P.cargo.cr = 500; Render.prSel = true; }''')  # 6.5 PROBE=1: 5 loot sites with guards and the probe in flight, selected
    res = pg.evaluate('''async () => {
      const NUKE = ''' + ('true' if os.environ.get('NUKE') else 'false') + ''', nk = () => { if (NUKE) Render.fx('overdrive', { x: G.core.x, y: G.core.y, r: 60 }); };
      const t = (n) => { nk(); const t0 = performance.now(); for (let i = 0; i < n; i++) { for (const e of G.enemies) { e.x += 0.01; } for (const tw of G.towers) tw.angle = (tw.angle || 0) + 0.2; Render.draw(1 / 60); } return (performance.now() - t0) / n; };
      t(30); // warm caches
      const AB = ''' + ('true' if os.environ.get('ZFXAB') else 'false') + ''', L = Render.layout, out = {};
      const views = { home: () => Render.resetCam(), zoomIn: () => { Render.resetCam(); Render.zoomAt(L.W / 2, L.H / 2, 3); }, zoomOut: () => { Render.resetCam(); Render.zoomAt(L.W / 2, L.H / 2, 0.01); } };
      for (const k in views) { views[k]();
        if (!AB) { out[k] = t(60); continue; }
        window.__rdbg = (window.__rdbg || 0) | 16; Render.zoneMs = 0; t(60); out[k + 'ZoneLayer'] = Render.zoneMs / 60; window.__rdbg &= ~16;
        let on = 0, off = 0; for (let r = 0; r < 8; r++) { Render.zfx = true; on += t(10); Render.zfx = false; off += t(10); } Render.zfx = true;
        out[k] = on / 8; out[k + 'Off'] = off / 8; out[k + 'Extra'] = (on - off) / 8; }
      return out; }''')
    b.close()
print({k: round(v, 2) for k, v in res.items()})
