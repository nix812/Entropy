"""Times Render.draw on a busy mid-game scene. usage: python3 drawbench.py [page.html] -> ms per frame at z=1, zoomed in, zoomed out.
GENES=1: every enemy carries 1-3 evolved genes and a third are Strain Assault units (swarm overlay cost).
NUKE=1 (6.2): each timed section starts a Nuke detonation at the core (the first second, its busiest part).
ZONE=id (6.3): the run is in that zone (default: none, the plain board). ZFXAB=1: also times each view with Zone effects off,
interleaved in short blocks, and the zone layer itself (ambient particles, backdrop) per frame: <view>ZoneLayer. The board decals are baked
into the map layer and cost nothing per frame.
PROBE=1 (6.5): 5 loot sites (with their guards) around the core and the probe in flight, selected, with cargo.
LATE=1 (6.6 perf66): a late-wave stress scene: Wave 60, 48 towers (every type, the 7 capstone tier towers included) at LV 4,
220 tanky enemies and a boss, 2 storms, fog on, a Black Hole beside the core, the probe out with 5 loot sites. The sim runs one
tick every other frame (not timed) so towers fire and the effects are live. SEED=n fixes the map (default 4242)."""
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
    pg.evaluate('(sd) => { const s = UI._dbg.setup(); s.seed = sd; UI._dbg.renderSetup(); }', int(os.environ.get('SEED', '4242')))  # perf66: a fixed map so runs compare
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
    LATE = bool(os.environ.get('LATE'))
    if LATE: pg.evaluate('''() => { G.wave = 60; G.capT = CAP_TOWERS.slice(); for (const t of G.towers.slice()) sellTower(t);
      G.enemies.length = 0;
      const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
      const c = G.map.core; spots.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
      const types = Object.keys(TOWERS); for (let i = 0; i < 48 && spots.length; i++) { const s = spots.shift(); const t = buildTower(types[i % types.length], s[0], s[1]); if (t) for (let l = 1; l < 4; l++) upgradeTower(t, 1 + (i % 2)); }
      for (let i = 0; i < 220; i++) { const ty = ['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic', 'shielder', 'phantom', 'reflector', 'carrier', 'sapper', 'leech'][i % 12]; if (!ENEMIES[ty]) continue;
        const e = spawnEnemy(ty, { d: (i * 0.29) % 30 }); if (e) { e.maxHp = e.hp = 1e12; } }
      const L = G.map.lanes[0]; const bz = spawnBoss({ boss: BOSSES[2].id, lane: L, hpm: 1 }); if (bz) { bz.maxHp = bz.hp = 1e13; }
      spawnStorm(['ion', 'void'], G.core.x + 4, G.core.y - 2, 0, 0); spawnStorm(['solar'], G.core.x - 5, G.core.y + 2, 0, 0);
      G.hole = { x: G.core.x + 6, y: G.core.y + 1, tx: G.core.x + 6, ty: G.core.y + 1, dx: 1, dy: 0, ph: 1, t: 5, k: 1 };
      if (G.probe) { G.sites = []; for (let i = 0; i < 5; i++) { const s = siteSpawn(); if (!s) continue; const a = i * 1.3; s.x = G.core.x + Math.cos(a) * 6; s.y = G.core.y + Math.sin(a) * 4; for (const g of s.g) { g.x = s.x + 1; g.y = s.y; g.hx = g.x; g.hy = g.y; g.hp = g.max * 0.6; } }
        const P = G.probe; P.home = 0; P.x = G.core.x + 3; P.y = G.core.y + 2; P.tx = G.core.x - 6; P.ty = G.core.y; P.hp = P.max * 0.7; P.cargo.cr = 500; }
      if (typeof fogOn === 'function' && fogOn()) fogMark(fogSources());
      window.__lateSim = () => { G.next = 1e9; simStep(1 / 30); G.core.hp = G.core.max; if (G.hole) { G.hole.t = 5; G.hole.ph = 1; } for (const e of G.enemies) if (e.hp < 1e11 && !e.boss) e.hp = e.maxHp; };
      for (let i = 0; i < 60; i++) window.__lateSim();
      return { towers: G.towers.length, enemies: G.enemies.length, fog: typeof fogOn === 'function' && fogOn() }; }''')
    if os.environ.get('DRAWSTATS'):  # perf66: per-frame drawImage calls and destination device pixels, by target canvas and call site
        print(pg.evaluate('''() => { Render.resetCam(); for (let i = 0; i < 20; i++) { if (window.__lateSim && i % 2 === 0) window.__lateSim(); Render.draw(1 / 60); }
          const P = CanvasRenderingContext2D.prototype, o = P.drawImage, st = {}; let N = 0;
          P.drawImage = function (img, ...a) { const m = this.getTransform(), w = a.length >= 4 ? a[a.length - 2] : img.width, h = a.length >= 4 ? a[a.length - 1] : img.height;
            const area = Math.abs(w * m.a * h * m.d); const site = (new Error().stack.split('\\n')[2] || '').replace(/.*page.html:/, '').replace(/\\).*/, '');
            const k = (this.canvas.id || (this.canvas.width + 'x' + this.canvas.height)) + ' <- ' + img.width + 'x' + img.height + ' @' + site.split(':')[0];
            const e = st[k] || (st[k] = [0, 0]); e[0]++; e[1] += area; return o.call(this, img, ...a); };
          for (let i = 0; i < 20; i++) { if (window.__lateSim && i % 2 === 0) window.__lateSim(); Render.draw(1 / 60); N++; }
          P.drawImage = o; return Object.entries(st).sort((a, b) => b[1][1] - a[1][1]).slice(0, 25).map(([k, v]) => (v[1] / N / 1e6).toFixed(2) + ' Mpx  ' + (v[0] / N).toFixed(1) + ' calls  ' + k).join('\\n'); }'''))
    CPU = os.environ.get('CPUPROF')  # perf66: CPUPROF=n prints the n functions with the most self time over the timed frames
    if CPU: cdp = pg.context.new_cdp_session(pg); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 200}); cdp.send('Profiler.start')
    res = pg.evaluate('''async () => {
      const NUKE = ''' + ('true' if os.environ.get('NUKE') else 'false') + ''', nk = () => { if (NUKE) Render.fx('overdrive', { x: G.core.x, y: G.core.y, r: 60 }); };
      const SIM = !!window.__lateSim;
      const t = (n) => { nk(); let ms = 0; for (let i = 0; i < n; i++) { if (SIM) { if (i % 2 === 0) window.__lateSim(); } else { for (const e of G.enemies) { e.x += 0.01; } for (const tw of G.towers) tw.angle = (tw.angle || 0) + 0.2; } const t0 = performance.now(); Render.draw(1 / 60); const d = performance.now() - t0; ms += d; FR.push(d); } return ms / n; };
      let FR = []; const NF = ''' + os.environ.get('FRAMES', '60') + '''; // perf66: FRAMES=n frames per view; MED=1 also prints the median frame
      window.__rdbg = ''' + os.environ.get('RDBG', '0') + '''; // perf66: RDBG=n sets the render debug bits (2: no lights, 8: no sharp upscale)
      t(30); // warm caches
      const AB = ''' + ('true' if os.environ.get('ZFXAB') else 'false') + ''', L = Render.layout, out = {};
      const views = { home: () => Render.resetCam(), zoomIn: () => { Render.resetCam(); Render.zoomAt(L.W / 2, L.H / 2, 3); }, zoomOut: () => { Render.resetCam(); Render.zoomAt(L.W / 2, L.H / 2, 0.01); } };
      for (const k in views) { views[k]();
        if (!AB) { FR = []; out[k] = t(NF); if (''' + ('true' if os.environ.get('MED') else 'false') + ''') { FR.sort((a, b) => a - b); out[k + 'Med'] = FR[FR.length >> 1]; } continue; }
        window.__rdbg = (window.__rdbg || 0) | 16; Render.zoneMs = 0; t(60); out[k + 'ZoneLayer'] = Render.zoneMs / 60; window.__rdbg &= ~16;
        let on = 0, off = 0; for (let r = 0; r < 8; r++) { Render.zfx = true; on += t(10); Render.zfx = false; off += t(10); } Render.zfx = true;
        out[k] = on / 8; out[k + 'Off'] = off / 8; out[k + 'Extra'] = (on - off) / 8; }
      return out; }''')
    if CPU:
        prof = cdp.send('Profiler.stop')['profile']; nodes = {n['id']: n for n in prof['nodes']}; dts = prof['timeDeltas']; self_t = {}
        for sid, dt in zip(prof['samples'], dts):
            cf = nodes[sid]['callFrame']; k = (cf['functionName'] or '(anon)') + ':' + str(cf['lineNumber'] + 1); self_t[k] = self_t.get(k, 0) + dt
        tot = sum(self_t.values()) or 1
        for k, v in sorted(self_t.items(), key=lambda kv: -kv[1])[:int(CPU)]: print(f'{v / tot * 100:5.1f}%  {k}')
    if os.environ.get('SHOT'): pg.evaluate('() => { if (UI.closeModal) UI.closeModal(); document.querySelectorAll(".modal, #modal").forEach(m => m.hidden = true); Render.resetCam(); Render.draw(1 / 60); }'); pg.screenshot(path=os.environ['SHOT'])
    b.close()
print({k: round(v, 2) for k, v in res.items()})
