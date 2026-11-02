"""v5.8 tower character check: every tower and spec fires on a real map through the real renderer.
usage: python3 towerfx.py [outdir] [page.html]
 - per tower family: builds the base tower and both specs beside the road, parks tough enemies in range, steps the sim and
   saves a frame strip (PNG) and a GIF to outdir (default test/out/towerfx)
 - records which sounds fire (name + spec) and checks the new names arrive, with their sources
 - times Render.draw in a live 36-tower battle (ms per frame); pass an older build's page to compare
Prints FAIL lines and ERRORS: [...] like the other suites."""
import pathlib, sys, io, os, mkpage
from playwright.sync_api import sync_playwright
from PIL import Image
root = pathlib.Path(__file__).parent.parent
outd = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != '-' else root / 'test' / 'out' / 'towerfx'
page = sys.argv[2] if len(sys.argv) > 2 else None
if not page: mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
outd.mkdir(parents=True, exist_ok=True)
errs, fails = [], []
FAMS = os.environ.get('FAMS', '').split(',') if os.environ.get('FAMS') else ['pulse', 'rail', 'cryo', 'snare', 'missile', 'pylon', 'coil', 'forge', 'flame', 'lens', 'emp', 'grav']
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=3, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FILE' not in m.text and 'TUNNEL' not in m.text else None)
    pg.goto('file://' + page); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; PROF.settings.briefings = "brief"; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    newfx = pg.evaluate('''() => { if (UI.closeModal) UI.closeModal(); for (const s of ['#toasts', '#tip', '#bossIntro', '#feed']) { const el = document.querySelector(s); if (el) el.style.visibility = 'hidden'; }
      G.credits = 1e8; G.gridBonus = 300; G.wave = 30; G.paused = true;
      window.__snd = {}; const P0 = SFX.play.bind(SFX); SFX.play = (n, a, a2) => { const sp = a && a.spec ? a.spec : a2 && a2.type ? a2.type : a && a.src && a.src.spec ? 's' + a.src.spec : ''; const k = n + (sp ? ':' + sp : ''); __snd[k] = (__snd[k] || 0) + 1; return P0(n, a, a2); };
      const F0 = SFX.flames.bind(SFX), B0 = SFX.beams.bind(SFX); window.__fl = 0; window.__bm = []; SFX.flames = (n, i, pl) => { if (n) __fl = Math.max(__fl, n); return F0(n, i, pl); }; SFX.beams = (n, r, eh, pr) => { if (n) __bm.push([n, r, eh, pr]); return B0(n, r, eh, pr); };
      // a family's showcase: base + both specs on free tiles beside one stretch of road, tough enemies parked in range
      window.__setup = (type, D) => {
        for (const t of G.towers.slice()) sellTower(t); for (const e of G.enemies) e.dead = true; G.enemies = []; G.projs = []; G.zones = [];
        const L = G.map.lanes[0], at = {}; lanePos(L, D, at);
        const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
        spots.sort((a, b) => Math.hypot(a[0] + 0.5 - at.x, a[1] + 0.5 - at.y) - Math.hypot(b[0] + 0.5 - at.x, b[1] + 0.5 - at.y));
        const built = [];
        for (const sp of [0, 1, 2]) { const s = spots.shift(); const t = buildTower(type, s[0], s[1]); if (!t) continue; if (sp) { upgradeTower(t); upgradeTower(t); upgradeTower(t, sp); } built.push(t); }
        if (type === 'pylon' || type === 'forge') { for (let i = 0; i < 4; i++) { const s = spots.shift(); if (s) buildTower(['pulse', 'rail', 'coil', 'cryo'][i], s[0], s[1]); } }
        if (type === 'snare') { for (let i = 0; i < 9; i++) { const e = spawnEnemy('flyer', { d: 0 }); e.hp = e.maxHp = 1e9; const o = built[i % 3]; e.L = prepLane([{ x: o.cx + 3.5, y: o.cy - 2 + i * 0.3 }, { x: o.cx, y: o.cy }, { x: G.core.x, y: G.core.y }]); e.d = (i % 3) * 0.6; e.lured = o.id; e.lureT = o; } }
        else for (let i = 0; i < 7; i++) { const e = spawnEnemy(i === 3 && type !== 'flame' && type !== 'grav' ? 'flyer' : i % 2 ? 'tank' : 'drone', { d: Math.max(0.5, D - 1.8 + i * 0.6) }); e.hp = e.maxHp = 1e9; if (type !== 'grav') e.spd = 0; e.cloaked = false; }
        recomputeAuras();
        const xs = built.map(t => t.cx), ys = built.map(t => t.cy);
        return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, at: [at.x, at.y], n: built.length };
      };
      window.__step = (n, dtR) => { for (let i = 0; i < n; i++) { G.paused = false; simStep(1 / 30); G.paused = true; Render.draw(dtR || 1 / 30); } };
      return !!Render.fxCounts; }''')
    D = pg.evaluate('() => { const L = G.map.lanes[0]; return Math.min(L.len * 0.55, Math.max(4, L.len - 6)); }')
    shots = {}
    for fam in FAMS:
        info = pg.evaluate('([t, D]) => __setup(t, D)', [fam, D])
        ctr = pg.evaluate('''([x, y]) => { Render.resetCam(); let s = Render.tileToScreen(x, y); Render.zoomAt(s.x, s.y, 2.4);
          s = Render.tileToScreen(x, y); const L = Render.layout; Render.panBy(L.W / 2 - s.x, L.H / 2 - s.y); s = Render.tileToScreen(x, y);
          const r = document.querySelector('#cv').getBoundingClientRect(), k = r.width / L.W; return [r.left + s.x * k, r.top + s.y * k]; }''', [info['cx'], info['cy']])
        pg.evaluate('() => __step(45)')  # warm up: turrets aim, beams ramp
        if fam == 'forge': pg.evaluate('() => { let i = 0; for (const f of G.forges) { Hooks.fx("coin", { x: f.cx, y: f.cy, v: Math.round(f.s.income), forge: f }); Hooks.sfx("forge", f, i++); } }')
        frames = []
        NF = {'rail': 45, 'emp': 45, 'grav': 45, 'missile': 36}.get(fam, 30)
        for k in range(NF):
            pg.evaluate('() => __step(1)')
            if fam == 'forge' and k == 10: pg.evaluate('() => { let i = 0; for (const f of G.forges) { Hooks.fx("coin", { x: f.cx, y: f.cy, v: Math.round(f.s.income), forge: f }); Hooks.sfx("forge", f, i++); } }')
            png = pg.screenshot(clip={'x': max(0, min(852 - 300, ctr[0] - 150)), 'y': max(0, min(393 - 170, ctr[1] - 85)), 'width': 300, 'height': 170})
            frames.append(Image.open(io.BytesIO(png)).convert('RGB'))
        small = [f.resize((f.width // 2, f.height // 2), Image.LANCZOS) for f in frames]
        small[0].save(outd / f'{fam}.gif', save_all=True, append_images=small[1:], duration=40, loop=0)
        strip = Image.new('RGB', (small[0].width * 4, small[0].height))
        for i, k in enumerate([NF * j // 4 + 2 for j in range(4)]): strip.paste(small[k], (i * small[0].width, 0))
        strip.save(outd / f'{fam}_strip.png')
        shots[fam] = info['n']
    snd = pg.evaluate('() => __snd'); fl = pg.evaluate('() => __fl'); bm = pg.evaluate('() => __bm.slice(-3)')
    # live battle bench: every tower and spec (36) beside the roads, 90 enemies walking
    bench = pg.evaluate('''() => { for (const t of G.towers.slice()) sellTower(t); for (const e of G.enemies) e.dead = true; G.enemies = []; G.projs = []; G.zones = [];
      const spots = []; for (const L of G.map.lanes) for (const q of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (canBuildAt(q.x + dx, q.y + dy) && inRegion(q.x + dx, q.y + dy, G.region)) spots.push([q.x + dx, q.y + dy]);
      const c = G.map.core; spots.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
      const types = Object.keys(TOWERS); let i = 0;
      for (const ty of types) for (const sp of [0, 1, 2]) { let s; while ((s = spots.shift()) && !canBuildAt(s[0], s[1])); if (!s) break; const t = buildTower(ty, s[0], s[1]); if (t && sp) { upgradeTower(t); upgradeTower(t); upgradeTower(t, sp); } }
      for (let i = 0; i < 90; i++) { const e = spawnEnemy(['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic'][i % 6], { d: (i * 0.37) % 25 }); e.hp = e.maxHp = 1e7; }
      Render.resetCam(); for (let i = 0; i < 60; i++) { __step(1, 1 / 60); }
      let tot = 0; const N = 150; for (let i = 0; i < N; i++) { if (i % 2 === 0) { G.paused = false; simStep(1 / 30); G.paused = true; } const t0 = performance.now(); Render.draw(1 / 60); tot += performance.now() - t0; }
      return { ms: tot / N, fx: Render.fxCounts || null, towers: G.towers.length }; }''')
    b.close()
print('built per family:', shots)
print('sounds:', dict(sorted(snd.items())))
print('flames voice max n:', fl, ' lens hum samples:', bm)
print('live battle draw ms/frame:', round(bench['ms'], 2), 'towers', bench['towers'], 'fx', bench['fx'])
if newfx and not os.environ.get('FAMS'):
    need = ['coil', 'boomT', 'empboom', 'pop', 'ignite', 'lock', 'forge', 'hit:pulse', 'hit:rail', 'hit:cryo', 'hit:coil', 'hit:lens', 'rail:1', 'rail:2', 'pulse:1', 'pulse:2', 'grav:1', 'grav:2', 'mortar:2', 'shot:1', 'shot:2', 'net', 'lure']
    for n in need:
        if not any(k == n or k.startswith(n + ':') for k in snd): fails.append('missing sound ' + n)
    if any(k.startswith('zap') for k in snd): fails.append('the Arc Coil still plays zap')
    if any(k == 'boom' or k.startswith('boom:') for k in snd): fails.append('a tower still plays the shared boom')
    if fl < 1: fails.append('flames voice never ran')
    if not bm or max(x[1] for x in bm) <= 0: fails.append('lens hum never ramped')
for f in fails: print('FAIL', f)
print('FAILED:', fails)
print('ERRORS:', errs[:10])
print('frames:', outd)
