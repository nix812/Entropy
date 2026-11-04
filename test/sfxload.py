"""6.2 camera-distance mix: a fixed stream of tower sounds (12 every 50 ms, seeded spots across the sector): how many voices
start and the JS time spent starting them, at home, zoomed in on the middle and zoomed in on a corner. Pass another build's page.html to compare.
usage: python3 sfxload.py [page.html] [secs]"""
import sys, pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
page = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].endswith('.html') else None
secs = float(sys.argv[2]) if len(sys.argv) > 2 else 5
if not page: mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2)
    pg.add_init_script('(() => { let a = 12345; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()')  # the same map in both builds
    pg.on('pageerror', lambda e: print('PAGE ERROR', e)); pg.goto('file://' + page); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; }')
    pg.mouse.click(300, 200); pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); pg.wait_for_timeout(800)
    pg.evaluate('''() => { if (UI.closeModal) UI.closeModal(); G.credits = 1e7; G.gridBonus = 200; G.wave = 30; G.core.hp = G.core.max = 1e9;
      const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
      const L = G.map.lanes[0].tiles; const near = (x, y) => Math.min(...L.map(p => Math.abs(p.x - x) + Math.abs(p.y - y)));
      spots.sort((a, b) => near(a[0], a[1]) - near(b[0], b[1]));
      const types = ['pulse', 'rail', 'missile', 'cryo', 'coil', 'flame', 'emp']; for (let i = 0; i < 30 && spots.length; i++) { const s = spots.shift(); buildTower(types[i % types.length], s[0], s[1]); }
      window._spawn = () => { for (let i = 0; i < 40; i++) { const e = spawnEnemy(['drone', 'swarmer', 'tank', 'flyer'][i % 4], { lane: G.map.lanes[0], d: (i * 0.53) % 20 }); e.hp = e.maxHp = 3e4; } };
      const pl = SFX.play; window._sfxT = 0; window._sfxN = 0; SFX.play = function () { const t = performance.now(); const r = pl.apply(this, arguments); window._sfxT += performance.now() - t; window._sfxN++; return r; };
      Hooks.sfx = (n, a, a2) => SFX.play(n, a, a2); }''')
    out = {}
    # a fixed stream, the same in every build: 12 tower sounds every 50 ms (shots, impacts, deaths) at seeded spots across the sector
    for view in ['home', 'zoom middle', 'zoom corner']:
        r = pg.evaluate('''async ([v, secs]) => { G.enemies.length = 0; G.paused = true; const L = Render.layout; Render.resetCam();
          if (v === 'zoom middle') Render.zoomAt(L.W / 2, L.H / 2, 3); if (v === 'zoom corner') { Render.zoomAt(L.W / 2, L.H / 2, 3); Render.lookAt(G.region.x0 + 2, G.region.y0 + 2); }
          let a = 777; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; const R = G.region;
          const p0 = SFX.stats().played; let ms = 0, n = 0; const names = ['shot', 'rail', 'missile', 'hit', 'hit', 'die'];
          for (let k = 0; k < secs * 20; k++) { for (let j = 0; j < 12; j++) { const x = R.x0 + rnd() * (R.x1 - R.x0), y = R.y0 + rnd() * (R.y1 - R.y0), nm = names[j % names.length];
              const arg = nm === 'die' ? { x, y, type: 'drone' } : nm === 'hit' ? { x, y } : { cx: x, cy: y, s: { el: 'K' }, spec: 0, type: nm === 'shot' ? 'pulse' : nm };
              const t0 = performance.now(); SFX.play(nm, arg, nm === 'hit' ? { type: 'pulse' } : undefined); ms += performance.now() - t0; n++; }
            await new Promise(res => setTimeout(res, 50)); }
          return { calls: n, played: SFX.stats().played - p0, ms, state: SFX.state }; }''', [view, secs])
        c = max(1, r['calls'])
        print(f"{view:12s} sound requests {r['calls']:5d}  voices started {r['played']:5d} ({100 * r['played'] / c:5.1f} per 100)  JS in SFX.play {r['ms'] / secs:6.2f} ms/s  [{r['state']}]", flush=True)
    b.close()
