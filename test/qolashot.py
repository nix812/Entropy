"""6.2 qolA screenshots and checks: the Nuke detonation (frames), no Home button (the right column), yellow treasure arrows and
tapping one, a chest claimed by a tap beside it, a support tower growing with its towers (panel line, free Specialization in
Ready), and the camera-distance sound gain. Screens: test/out/qa_*.png. usage: python3 qolashot.py [W H tag]"""
import sys, pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out'; mkpage.mk()
SIZES = [(int(sys.argv[1]), int(sys.argv[2]), sys.argv[3])] if len(sys.argv) > 3 else [(667, 375, 'p'), (1180, 820, 'i')]
errs, fails = [], []
def check(c, msg, tag): print(('ok   ' if c else 'FAIL ') + f'[{tag}] {msg}', flush=True); (None if c else fails.append(f'{tag}: {msg}'))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W, H, tag in SIZES:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
        pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.settings.briefings = "off"; PROF.bestWave = 60; PROF.xp = 900000; PROF.runs = 5; PROF.seenSys = Object.assign(PROF.seenSys || {}, { frontier: 1, vet: 1, support: 1, upg: 1, power: 1 }); }')
        pg.mouse.click(10, 10); pg.click('#bLaunch'); pg.wait_for_timeout(300); pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); pg.wait_for_timeout(1500)
        pg.evaluate('() => { document.querySelectorAll("[data-act=brief]").forEach(b => b.click()); if (UI.closeModal) UI.closeModal(); G.credits = 1e7; G.gridBonus = 60; G.core.hp = G.core.max = 1e9; }')
        cv = pg.evaluate('() => { const r = document.querySelector("#cv").getBoundingClientRect(); return [r.left, r.top]; }'); u = pg.evaluate('UIS')
        # 1. no Home button; the right column starts with Lift Off
        top = pg.evaluate('''() => { const s = document.querySelector('#stage').getBoundingClientRect(), l = document.querySelector('#bLift').getBoundingClientRect(); return [!document.querySelector('#bZoom'), Math.round(l.top - s.top), Math.round(s.right - l.right)]; }''')
        check(top[0] and top[1] <= 8 * u and top[2] <= 8 * u, f'no Home button; Lift Off tops the right column ({top[1]} px, {top[2]} px)', tag)
        pg.evaluate('() => { const L = Render.layout; Render.resetCam(); Render.zoomAt(L.W / 2, L.H / 2, 2.4); }'); pg.wait_for_timeout(300)
        # 2. treasure arrows: crates off screen on three sides
        pg.evaluate('''() => { const R = G.region, ok = (x, y) => G.map.tiles[tIdx(x, y)] === 0 && !G.towerAt[tIdx(x, y)];
          const want = [[R.x0 + 2, R.y0 + 2], [R.x1 - 3, (R.y0 + R.y1) >> 1], [(R.x0 + R.x1) >> 1, R.y1 - 3], [R.x0 + 3, R.y0 + 2]];
          G.caches = want.map(([x, y], i) => { while (!ok(x, y)) x++; return { x, y, t: 999, id: 8000 + i, kind: i === 1 ? 'gold' : 'normal' }; }); G.cacheT = 999; }''')
        pg.wait_for_timeout(600)
        arr = pg.evaluate('() => Render.frArrows.filter(a => a.tre).map(a => [a.sx, a.sy, a.x, a.y])')
        check(2 <= len(arr) <= 3, f'{len(arr)} yellow treasure arrows (two crates side by side merge into one)', tag)
        pg.screenshot(path=str(out / f'qa_treasure_{tag}.png'))
        if arr:
            a = arr[0]; pg.mouse.click(cv[0] + a[0] * u, cv[1] + a[1] * u); pg.wait_for_timeout(300)
            on = pg.evaluate(f'() => {{ const p = Render.tileToScreen({a[2]}, {a[3]}), L = Render.layout; return p.x > 0 && p.y > 0 && p.x < L.W && p.y < L.H; }}')
            check(on, 'tapping a treasure arrow brings that crate on screen', tag)
            pg.screenshot(path=str(out / f'qa_treasure_tap_{tag}.png'))
        # 3. a tap one tile beside a crate claims it; a tap two tiles away does not
        res = pg.evaluate('''() => { const L = Render.layout, mid = Render.screenToTile(L.W / 2, L.H / 2), c = G.caches.slice().sort((p, q) => Math.hypot(p.x - mid.x, p.y - mid.y) - Math.hypot(q.x - mid.x, q.y - mid.y))[0]; const n0 = G.caches.length, cr0 = G.credits;
          const tap = (x, y) => { const p = Render.tileToScreen(x, y), r = document.querySelector('#cv').getBoundingClientRect(); return [r.left + p.x * UIS, r.top + p.y * UIS]; };
          let far = null; for (const [dx, dy] of [[2.6, 0.5], [-1.6, 0.5], [0.5, 2.6], [0.5, -1.6]]) { const x = Math.floor(c.x + dx), y = Math.floor(c.y + dy); if (!G.towerAt[tIdx(x, y)] && !G.caches.some(o => o !== c && Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 2)) { far = tap(c.x + dx, c.y + dy); break; } }
          let near = null; for (const [dx, dy] of [[1.5, 0.5], [-0.5, 0.5], [0.5, 1.5], [0.5, -0.5]]) { const x = Math.floor(c.x + dx), y = Math.floor(c.y + dy); if (!G.towerAt[tIdx(x, y)]) { near = tap(c.x + dx, c.y + dy); break; } }
          return { far, near, n0, id: c.id }; }''')
        pg.mouse.click(*res['far']); pg.wait_for_timeout(250)
        check(pg.evaluate(f'() => G.caches.some(c => c.id === {res["id"]})'), 'a tap two tiles from a crate leaves it', tag)
        pg.evaluate('() => UI.closePanel()'); pg.wait_for_timeout(350)
        pg.mouse.click(*res['near']); pg.wait_for_timeout(250)
        check(pg.evaluate(f'() => !G.caches.some(c => c.id === {res["id"]})'), 'a tap on the tile beside a crate claims it', tag)
        pg.evaluate('() => { G.caches = []; }')
        # 4. support growth: a Relay Pylon beside three Pulse Blasters grows as they are upgraded; its panel says so
        info = pg.evaluate('''() => { const L = G.map.lanes[0].tiles, mid = L[Math.floor(L.length * 0.55)]; const sp = [];
          for (let y = mid.y - 3; y <= mid.y + 3; y++) for (let x = mid.x - 3; x <= mid.x + 3; x++) if (canBuildAt(x, y)) sp.push({ x, y });
          sp.sort((p, q) => Math.hypot(p.x - mid.x, p.y - mid.y) - Math.hypot(q.x - mid.x, q.y - mid.y));
          const P = sp.shift(); window.act('build', 'pylon', P.x, P.y); const pyl = G.towerAt[tIdx(P.x, P.y)]; const atk = [];
          for (const s of sp) { if (atk.length >= 3) break; if (Math.hypot(s.x - P.x, s.y - P.y) <= pyl.s.range - 0.2 && window.act('build', 'pulse', s.x, s.y)) atk.push(G.towerAt[tIdx(s.x, s.y)]); }
          for (let k = 0; k < 2; k++) for (const t of atk) window.act('up', t.x, t.y, null);
          window._pyl = pyl; window._atk = atk; return [pyl.lvl, pyl.freeLv || 0, pyl.invested, atk.length]; }''')
        check(info[0] == 3 and info[1] == 2 and info[3] == 3, f'the Pylon grew to LV {info[0]} with its three LV 3 towers ({info[1]} free levels, paid {info[2]})', tag)
        pg.evaluate('() => { const t = _pyl, p = Render.tileToScreen(t.cx, t.cy), L = Render.layout; Render.panBy(L.W * 0.7 - p.x, L.H / 2 - p.y); UI._dbg.openTower(t); }'); pg.wait_for_timeout(500)
        txt = pg.inner_text('#panel')
        check('Grows with nearby attack towers' in txt and '+2 LV free' in txt, 'the panel says it grows with nearby attack towers (+2 LV free)', tag)
        pg.screenshot(path=str(out / f'qa_support_{tag}.png'))
        pg.evaluate('() => { UI.closePanel(); for (const t of _atk) window.act("up", t.x, t.y, 1); UI._dbg.updateHud(true); }'); pg.wait_for_timeout(400)
        check(pg.evaluate('() => _pyl.lvl === 3 && _pyl.grow === 1'), 'towers at LV 4: the Pylon waits on a free Specialization (Ready)', tag)
        check(pg.evaluate('() => !document.querySelector("#bReady").hidden && +document.querySelector("#rdyN").textContent >= 1'), 'the Ready button counts it', tag)
        pg.screenshot(path=str(out / f'qa_support_star_{tag}.png'))
        pg.evaluate('() => { for (const t of G.towers) { t.pending = 0; t.ascPend = 0; } document.querySelector("#bReady").click(); }'); pg.wait_for_timeout(500)
        mt = pg.inner_text('#modal') if pg.evaluate('() => !document.querySelector("#modal").hidden') else ''
        check('free specialization' in mt.lower() and 'free' in mt.lower(), 'Ready offers the free Specialization', tag)
        pg.screenshot(path=str(out / f'qa_support_ready_{tag}.png'))
        cr = pg.evaluate('G.credits'); pg.evaluate('() => document.querySelector("#modal [data-act=gpick]").click()'); pg.wait_for_timeout(400)
        check(pg.evaluate(f'() => _pyl.lvl === 4 && _pyl.spec > 0 && G.credits === {cr}'), 'picking it makes the Pylon LV 4 for free', tag)
        pg.evaluate('() => { if (UI.closeModal) UI.closeModal(); G.paused = false; }')
        # 5. camera-distance sound gain: full in the middle, the floor well off screen
        g = pg.evaluate('() => { const L = Render.layout, c = Render.screenToTile(L.W / 2, L.H / 2), f = Render.screenToTile(L.W * 3, L.H * 3), e = Render.screenToTile(L.W, L.H / 2); return [SFX.proxK(c.x, c.y), SFX.proxK(e.x, e.y), SFX.proxK(f.x, f.y)]; }')
        check(g[0] == 1 and 0.4 < g[1] < 1 and abs(g[2] - 0.2) < 0.01, f'tower sounds: centre ×{g[0]:.2f}, screen edge ×{g[1]:.2f}, far off ×{g[2]:.2f}', tag)
        # 6. the Nuke: frames of the detonation at the core
        pg.evaluate('''() => { UI.closePanel(); G.wave = 40; G.odUsed = 0; Render.resetCam(); for (let i = 0; i < 30; i++) spawnEnemy(['drone', 'swarmer', 'tank'][i % 3], { d: 2 + i * 0.6 }); UI._dbg.updateHud(true); }''')
        pg.wait_for_timeout(300)
        check(pg.inner_text('#bOD').strip().lower() == 'nuke', 'the rail button says Nuke', tag)
        pg.evaluate('() => document.querySelector("#bOD").click()'); pg.wait_for_timeout(120)
        pg.screenshot(path=str(out / f'qa_nuke_armed_{tag}.png'))
        pg.evaluate('() => document.querySelector("#bOD").click()')
        t0 = 0
        for ms in [60, 350, 800, 1500, 2300, 3200]:
            pg.wait_for_timeout(ms - t0); t0 = ms; pg.screenshot(path=str(out / f'qa_nuke_{ms}_{tag}.png'))
        check(pg.evaluate('() => !!G.odUsed && G.stats.odKills >= 30'), 'the Nuke cleared the board (30 erased)', tag)
        pg.wait_for_timeout(800)
        check(pg.evaluate('() => !G.paused && !G.over'), 'play carries on after the detonation', tag)
        pg.close()
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', fails)
