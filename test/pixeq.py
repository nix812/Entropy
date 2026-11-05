"""6.6 perf66: are two builds pixel-identical? Plays the same busy late-wave scene in both pages with a fake clock
(requestAnimationFrame, performance.now and Math.random are replaced by deterministic versions), runs the real game loop
(sim, render, UI.tick) and compares the battlefield canvas at several moments and camera views.
usage: [DPR=3] python3 pixeq.py BASE_PAGE [NEW_PAGE] [WxH ...]   (NEW_PAGE defaults to test/out/page.html after mkpage.mk())
Prints the number of differing pixels per checkpoint and 'PIXEQ OK' when every checkpoint matches exactly.
Scenes: 'late' (Wave 60, 48 towers, 220 enemies, a boss, storms, fog, a Black Hole, the probe out with loot sites),
then the same with fog off. Views: home, zoomed in, zoomed out, and a pan."""
import os, sys, pathlib, base64, io, mkpage
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
INIT = '''(() => { let s = 12345; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let T = 1000; performance.now = () => T; window.__q = []; window.requestAnimationFrame = f => { window.__q.push(f); return 1; };
  window.__pump = (n, dt) => { for (let i = 0; i < n; i++) { T += dt || 16.667; const q = window.__q; window.__q = []; for (const f of q) f(T); } }; })()'''
SCENE = '''(fog) => { if (UI.closeModal) UI.closeModal(); G.credits = 1e9; G.gridBonus = 300; G.wave = 60; G.capT = CAP_TOWERS.slice(); G.next = 1e9;
  const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
  const c = G.map.core; spots.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
  const types = Object.keys(TOWERS); for (let i = 0; i < 48 && spots.length; i++) { const s = spots.shift(); const t = buildTower(types[i % types.length], s[0], s[1]); if (t) for (let l = 1; l < 4; l++) upgradeTower(t, 1 + (i % 2)); }
  const ety = ['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic', 'shielder', 'phantom', 'reflector', 'carrier', 'sapper', 'leech'];
  for (let i = 0; i < 220; i++) { const e = spawnEnemy(ety[i % 12], { d: (i * 0.29) % 30 }); if (e) e.maxHp = e.hp = 1e12; }
  const bz = spawnBoss({ boss: BOSSES[2].id, lane: G.map.lanes[0], hpm: 1 }); if (bz) bz.maxHp = bz.hp = 1e13;
  spawnStorm(['ion', 'void'], c.x + 4, c.y - 2, 0, 0); spawnStorm(['solar'], c.x - 5, c.y + 2, 0, 0);
  G.hole = { x: c.x + 6, y: c.y + 1, tx: c.x + 6, ty: c.y + 1, dx: 1, dy: 0, ph: 1, t: 5, k: 1 };
  if (G.probe) { G.sites = []; for (let i = 0; i < 5; i++) { const s = siteSpawn(); if (!s) continue; const a = i * 1.3; s.x = c.x + Math.cos(a) * 6; s.y = c.y + Math.sin(a) * 4; for (const g of s.g) { g.x = s.x + 1; g.y = s.y; g.hx = g.x; g.hy = g.y; } }
    const P = G.probe; P.home = 0; P.x = c.x + 3; P.y = c.y + 2; P.tx = c.x - 6; P.ty = c.y; }
  if (!fog) G.fogEx = null; else if (fogOn()) fogMark(fogSources());
  G.core.max = G.core.hp = 1e12; G.paused = false; G.speed = 1; }'''
SIG = '''() => document.getElementById('cv').toDataURL('image/png')'''
def run(page, W, H):
    shots = {}
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=float(os.environ.get('DPR', 3)))
        pg.add_init_script(INIT); pg.goto('file://' + page); pg.evaluate('() => window.__pump(30)')
        pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; }')
        pg.click('#bLaunch'); pg.evaluate('() => window.__pump(10)')
        pg.evaluate('() => { const s = UI._dbg.setup(); s.seed = 4242; UI._dbg.renderSetup(); }')
        pg.click('[data-act=launch]'); pg.evaluate('() => window.__pump(60)')
        for fog in (True, False):
            pg.evaluate(SCENE, fog); pg.evaluate('() => { if (UI.closeModal) UI.closeModal(); Render.resetCam(); window.__pump(240); }')
            for view, js in (('home', 'Render.resetCam()'), ('in', 'Render.resetCam(); Render.zoomAt(Render.layout.W / 2, Render.layout.H / 2, 3)'),
                             ('out', 'Render.resetCam(); Render.zoomAt(Render.layout.W / 2, Render.layout.H / 2, 0.01)'), ('pan', 'Render.resetCam(); Render.panBy(-120, 60)')):
                pg.evaluate('() => { if (UI.closeModal) UI.closeModal(); ' + js + '; window.__pump(20); }')
                d = pg.evaluate(SIG); shots[f'{"fog" if fog else "nofog"}-{view}'] = Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA')
        b.close()
    return shots
if __name__ == '__main__':  # importable: INIT, SCENE and run() are reused by other scripts
  args = [a for a in sys.argv[1:] if 'x' not in a or a.endswith('.html')]
  sizes = [tuple(map(int, a.split('x'))) for a in sys.argv[1:] if 'x' in a and not a.endswith('.html')] or [(852, 393)]
  base = args[0]
  new = args[1] if len(args) > 1 else None
  if not new: mkpage.mk(); new = str(root / 'test' / 'out' / 'page.html')
  bad = 0
  for W, H in sizes:
      A, B = run(base, W, H), run(new, W, H)
      for k in A:
          a, bb = A[k], B[k]
          if a.size != bb.size: print(f'{W}x{H} {k}: DIFF size {a.size} vs {bb.size}'); bad += 1; continue
          df = ImageChops.difference(a, bb); bbox = df.getbbox()
          if not bbox: print(f'{W}x{H} {k}: identical ({a.size[0]}x{a.size[1]})'); (root / 'test' / 'out' / 'pixeq').mkdir(parents=True, exist_ok=True); bb.save(root / 'test' / 'out' / 'pixeq' / f'{W}x{H}_{k}.png'); a.save(root / 'test' / 'out' / 'pixeq' / f'{W}x{H}_{k}_base.png'); continue
          n = sum(1 for px in df.getdata() if any(px)); mx = max(max(ch) for ch in [df.getextrema()][0])
          out = root / 'test' / 'out' / 'pixeq'; out.mkdir(parents=True, exist_ok=True); a.save(out / f'{W}x{H}_{k}_base.png'); bb.save(out / f'{W}x{H}_{k}_new.png')
          print(f'{W}x{H} {k}: DIFF {n} px in {bbox} (max channel delta {mx})'); bad += 1
  print('PIXEQ OK' if not bad else f'PIXEQ FAILED: {bad} checkpoints differ')
