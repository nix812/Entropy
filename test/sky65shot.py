"""6.5 sky65: fog of war and the Black Hole event in the real page. For each size: a Frontier run on the full map with towers
and a wave spread down every road; the fog's three states (visible near the core and towers, explored where a probe stub has
been, unseen elsewhere), enemies hidden in fog and shown in vision, a boss shown through fog, the probe stub's vision, the Black
Hole at full strength beside the towers (tower frames and the two numbers), and its edge warning while it drifts in.
Screenshots in test/out/sky65/. usage: python3 sky65shot.py [WxH ...]  (default 667x375 1180x820)"""
import pathlib, sys
from playwright.sync_api import sync_playwright
from PIL import Image
import mkpage
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out' / 'sky65'; out.mkdir(parents=True, exist_ok=True)
sizes = [tuple(int(v) for v in a.split('x')) for a in sys.argv[1:]] or [(667, 375), (1180, 820)]
mkpage.mk(); errs = []; fails = []
def check(cond, msg, tag):
    print(('ok   ' if cond else 'FAIL ') + f'{tag}: {msg}')
    if not cond: fails.append(f'{tag}: {msg}')
SEEN = '{v58:1,storm:1,crate:1,vet:1,abil:1,upg:1,power:1,spare:1,wormhole:1,anomaly:1,boss:1,market:1,support:1,tech:1,frontier:1,fog:1,hole:1}'
PREP = f'''() => {{ PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.bestWave = 40; PROF.runs = 6; PROF.runSnap = null; PROF.seenSys = {SEEN};
  PROF.settings.briefings = "off"; PROF.settings.notes = "off"; PROF.tut = Object.assign(PROF.tut || {{}}, {{ seen: 1, done: 1 }}); UI.renderHangar(); }}'''
# a run on the full map (every wormhole open), towers around the core, enemies down every road, the camera pulled out
SCENE = '''() => { document.querySelectorAll("#modal [data-act=brief], #modal [data-act=close]").forEach(b => b.click());
  G.credits = 1e6; G.wave = 30;
  while (G.laneWaves[G.lanesOpened] !== undefined) { growRegion(G.lanesOpened + 1, true); genExtraLane(G.r); G.lanesOpened++; }
  for (const L of G.map.lanes) L.openWave = 0; G.mapRev = (G.mapRev || 0) + 1;
  const c = G.map.core, sp = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) sp.push([x, y]);
  sp.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
  const ty = ['pulse', 'rail', 'cryo', 'missile', 'coil', 'emp', 'pulse', 'rail']; for (let i = 0; i < 8 && sp.length; i++) { const s = sp.splice(i * 3, 1)[0]; if (s) window.act('build', ty[i % ty.length], s[0], s[1]); }
  G.enemies = []; let n = 0;
  for (const L of G.map.lanes) for (let d = 1; d < L.len - 2; d += 2.2) { const e = spawnEnemy(['drone', 'tank', 'swarmer', 'flyer', 'splitter'][n++ % 5], { d }); e.L = L; e.d = d; lanePos(L, d, e); }
  fogMark(fogSources()); G.paused = true; window.__stopLoop = false; return { cols: COLS, rows: ROWS, lanes: G.map.lanes.length, enemies: G.enemies.length, towers: G.towers.length }; }'''
def dark_share(path, box):
    im = Image.open(path).convert('L'); w, h = im.size
    c = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h))); px = list(c.getdata())
    return sum(1 for v in px if v < 22) / max(1, len(px))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W, H in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
        pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
        pg.evaluate(PREP)
        pg.click('#bLaunch'); pg.wait_for_timeout(250)
        pg.evaluate('() => { const s = UI._dbg.setup(); s.seed = 4242; s.map = genMap(mulberry32(4242)); UI._dbg.renderSetup(); }')
        pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); pg.wait_for_timeout(600)
        info = pg.evaluate(SCENE); print(tag, info)
        check(pg.evaluate('() => G.frV') == 5 and pg.evaluate('() => fogOn()'), 'a new run is frV 5 with fog on', tag)
        # 1. the whole map: home visible, everything else unseen (roads remembered)
        pg.evaluate('() => { Render.resetCam(); Render.zoomAt(Render.layout.W / 2, Render.layout.H / 2, 0.01); }'); pg.wait_for_timeout(300)
        st = pg.evaluate('''() => { const c = G.core, far = [[1, 1], [COLS - 2, 1], [1, ROWS - 2], [COLS - 2, ROWS - 2]].sort((a, b) => Math.hypot(b[0] - c.x, b[1] - c.y) - Math.hypot(a[0] - c.x, a[1] - c.y))[0];
          const road = G.map.lanes.map(L => L.tiles[1]).find(t => Render.fogAt(t.x + 0.5, t.y + 0.5) !== 0);
          return { core: Render.fogAt(c.x, c.y), far: Render.fogAt(far[0] + 0.5, far[1] + 0.5), farAt: far, road: road ? Render.fogAt(road.x + 0.5, road.y + 0.5) : null,
            hidden: G.enemies.filter(e => e._fogH).length, shown: G.enemies.filter(e => !e._fogH).length }; }''')
        print(tag, st)
        check(st['core'] == 0, 'the core stands in vision', tag)
        check(st['far'] == 2, f'a far corner {st["farAt"]} is unseen', tag)
        check(st['road'] in (1, None), 'a road out in the fog is remembered (explored, not unseen)', tag)
        check(st['hidden'] > 0 and st['shown'] > 0, f'enemies in fog are hidden ({st["hidden"]}), enemies in vision show ({st["shown"]})', tag)
        pg.screenshot(path=str(out / f's01_fog_full_{tag}.png'))
        # 2. a probe stub out in the fog: vision around it; after it moves on, the ground stays explored (dim) and enemies hide again
        pr = pg.evaluate('''() => { const c = G.core; let best = null; for (const L of G.map.lanes) for (const t of L.tiles) { const d = Math.hypot(t.x - c.x, t.y - c.y); if (Render.fogAt(t.x + 0.5, t.y + 0.5) !== 0 && (!best || d > best.d) && t.x > 4 && t.y > 4 && t.x < COLS - 5 && t.y < ROWS - 5) best = { x: t.x + 0.5, y: t.y + 0.5, d }; }
          G.probe = { x: best.x, y: best.y, alive: true, vis: 5 }; fogMark(fogSources()); return best; }''')
        pg.wait_for_timeout(250)
        sp = pg.evaluate('''(p) => ({ at: Render.fogAt(p.x, p.y), near: G.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 4).map(e => e._fogH) })''', pr)
        check(sp['at'] == 0, 'the probe stub sees around itself', tag)
        check(len(sp['near']) > 0 and not any(sp['near']), f'enemies near the probe show ({len(sp["near"])})', tag)
        pg.screenshot(path=str(out / f's02_probe_vision_{tag}.png'))
        pg.evaluate('() => { G.probe.alive = false; }'); pg.wait_for_timeout(250)
        sp2 = pg.evaluate('''(p) => ({ at: Render.fogAt(p.x, p.y), near: G.enemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 3).map(e => e._fogH) })''', pr)
        check(sp2['at'] == 1, 'where the probe was is explored (dim) once it is gone', tag)
        check(len(sp2['near']) > 0 and all(sp2['near']), 'enemies there hide again', tag)
        # a boss out in the fog still shows
        bs = pg.evaluate("""(p) => { let L = null, d = 0; for (const M of G.map.lanes) for (let i = 0; i < M.tiles.length; i++) { const t = M.tiles[i]; if (Math.abs(t.x + 0.5 - p.x) < 0.1 && Math.abs(t.y + 0.5 - p.y) < 0.1) { L = M; d = M.cum[i]; } }
            if (!L) return null; const e = spawnBoss({ boss: 'behemoth', L, d }); e.d = d; lanePos(L, d, e); return e.id; }""", pr)
        pg.wait_for_timeout(250)
        bf = pg.evaluate('(id) => { const e = G.enemies.find(e => e.id === id); return e ? [!!e._fogB, !!e._fogH] : null; }', bs)
        check(bf == [True, False], f'a boss out in the fog still shows ({bf})', tag)
        pg.screenshot(path=str(out / f's03_explored_{tag}.png'))
        dk = dark_share(str(out / f's03_explored_{tag}.png'), (0.05, 0.1, 0.95, 0.9))
        check(dk > 0.12, f'part of the zoomed-out map is dark (unseen): {dk:.2f}', tag)
        # 3. the Black Hole at full strength next to the towers (home view)
        hl = pg.evaluate('''() => { G.probe = null; const t0 = G.towers[0], L = G.map.lanes[0]; let best = null;
            for (const p of L.tiles) { const d = Math.hypot(p.x + 0.5 - t0.cx, p.y + 0.5 - t0.cy); if (d > 3 && d < 5 && (!best || d < best.d)) best = { x: p.x + 0.5, y: p.y + 0.5, d }; }
            if (!best) best = { x: t0.cx + 3.5, y: t0.cy };
            G.hole = { x: best.x, y: best.y, tx: best.x, ty: best.y, dx: 1, dy: 0, ph: 1, t: 5, k: 1 };
            return { ring: G.towers.filter(t => holeZone(t) > 0).length, inner: G.towers.filter(t => holeZone(t) < 0).length, rates: G.towers.map(t => +holeRate(t).toFixed(2)) }; }''')
        print(tag, 'hole', hl)
        check(hl['ring'] + hl['inner'] > 0, f'towers sit in the hole\'s reach (ring {hl["ring"]}, horizon {hl["inner"]})', tag)
        pg.evaluate('() => { Render.resetCam(); Render.lookAt(G.hole.x, G.hole.y); }'); pg.wait_for_timeout(600)
        pg.screenshot(path=str(out / f's04_hole_{tag}.png'))
        pg.evaluate('() => { Render.resetCam(); Render.lookAt(G.hole.x, G.hole.y); Render.zoomAt(Render.layout.W / 2, Render.layout.H / 2, 2.2); Render.lookAt(G.hole.x, G.hole.y); }'); pg.wait_for_timeout(500)
        pg.screenshot(path=str(out / f's05_hole_close_{tag}.png'))
        # 4. the edge warning: a hole drifting in from past the sector edge, camera at home
        aw = pg.evaluate('''() => { G.hole = null; G.wave = 30; holeSpawn(); Render.resetCam(); return { ph: G.hole.ph, x: G.hole.x, y: G.hole.y }; }''')
        pg.wait_for_timeout(500)
        arr = pg.evaluate('() => Render.frArrows.filter(a => a.hole).length')
        check(arr == 1, 'a hole drifting in shows one edge arrow', tag)
        pg.screenshot(path=str(out / f's06_hole_warning_{tag}.png'))
        pg.close()
    b.close()
print('ERRORS:', errs)
print('FAILED:', fails)
