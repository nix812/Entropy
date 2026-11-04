"""Frontier (the only run type since 6.1) through the real UI: New Run (Endless / Daily Hunt, no mode choice), the first-time card, the Lift Off button, the landing
picker and its preview, landing and docking on a tower, links, the core panel, moving a tower, the edge arrows and the
zoomed-out board, the docked core's Details tab, a Daily Hunt on Frontier rules (resume by replay, hunt code, watch). Screenshots in test/out/frontier/. usage: python3 frontiershot.py [WxH ...]  (default 667x375 852x393 1180x820)"""
import pathlib, sys
from playwright.sync_api import sync_playwright
import mkpage
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out' / 'frontier'; out.mkdir(parents=True, exist_ok=True)
sizes = [tuple(int(v) for v in a.split('x')) for a in sys.argv[1:]] or [(667, 375), (852, 393), (1180, 820)]
mkpage.mk(); errs = []; fails = []
def check(cond, msg, W):
    print(('ok   ' if cond else 'FAIL ') + f'{W}: {msg}')
    if not cond: fails.append(f'{W}: {msg}')
SEEN = '{v58:1,storm:1,crate:1,vet:1,abil:1,upg:1,power:1,spare:1,wormhole:1,anomaly:1,boss:1,market:1,support:1,tech:1}'
def tile_xy(pg, x, y):
    return pg.evaluate(f'() => {{ const r = document.querySelector("#cv").getBoundingClientRect(); const p = Render.tileToScreen({x} + 0.5, {y} + 0.5); return [r.left + p.x * UIS, r.top + p.y * UIS]; }}')
def tap_tile(pg, x, y):
    c = tile_xy(pg, x, y); pg.mouse.click(c[0], c[1]); pg.wait_for_timeout(380)
def clear(pg):
    pg.evaluate('() => document.querySelectorAll("#modal [data-act=brief]").forEach(b => b.click())'); pg.wait_for_timeout(120)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W, H in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
        pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
        pg.evaluate(f'() => {{ PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.bestWave = 12; PROF.runSnap = null; PROF.seenSys = {SEEN}; PROF.tut = Object.assign(PROF.tut || {{}}, {{ seen: 1, done: 1 }}); UI.renderHangar(); }}')
        # 1. New Run: one kind of run (Endless) beside the Daily Hunt, on the Frontier board
        pg.click('#bLaunch'); pg.wait_for_timeout(300)
        chips = pg.evaluate('() => [...document.querySelectorAll("#modal [data-act=mode]")].map(b => b.dataset.v + ":" + b.textContent.trim())')
        txt = pg.inner_text('#modal')
        check(chips == ['std:Endless', 'daily:Daily Hunt'] and 'prototype' not in txt.lower() and 'flies' in txt and pg.evaluate('() => COLS === 64 && ROWS === 36'), f'New Run: no mode choice {chips}, one-line pitch, board 64x36', tag)
        pg.screenshot(path=str(out / f'f01_setup_{tag}.png'))
        pg.click('[data-act=launch]'); pg.wait_for_timeout(1600)
        check(pg.evaluate('() => G.fr === 1 && G.recOpts.frontier === 1'), 'the run starts in Frontier', tag)
        # 2. the first-time card
        try: pg.wait_for_selector('#modal .intro', timeout=4000)
        except Exception: pass
        has_intro = pg.evaluate('() => !!document.querySelector("#modal .intro") && /lift off/i.test(document.querySelector("#modal").innerText)')
        check(has_intro, 'first-time Frontier card', tag)
        pg.screenshot(path=str(out / f'f02_intro_{tag}.png'))
        clear(pg); pg.evaluate('() => { PROF.settings.briefings = "off"; }')
        pg.evaluate('() => { Render.overview(); Render.zoomAt(200, 150, 0.2); UI.zoomChanged(); }'); pg.wait_for_timeout(400)
        pg.screenshot(path=str(out / f'f02b_board_zoomed_out_start_{tag}.png'))  # the 64x36 board, the starting sector lit
        pg.evaluate('() => { Render.resetCam(); UI.zoomChanged(); }'); pg.wait_for_timeout(200)
        # 2c. the no-build ring: hidden until a refused tap near a wormhole, then fades away
        wt = pg.evaluate('''() => { const q = G.map.lanes[0].tiles[0]; for (let r = 2; r < FRONTIER.wormBuild; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) { const x = q.x + dx, y = q.y + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && G.region && inRegion(x, y, G.region) && G.map.tiles[tIdx(x, y)] === 0 && !G.towerAt[tIdx(x, y)]) return [x, y, q.x, q.y]; } return null; }''')
        if wt:
            pg.evaluate(f'() => {{ Render.lookAt({wt[2]} + 0.5, {wt[3]} + 0.5); UI.zoomChanged(); }}'); pg.wait_for_timeout(300)
            pg.screenshot(path=str(out / f'f02c_ring_hidden_{tag}.png'))
            tap_tile(pg, wt[0], wt[1])
            check('TOO CLOSE' in pg.inner_text('body').upper() and not pg.evaluate('() => document.querySelector("#panel") && !document.querySelector("#panel").hidden && /build/i.test(document.querySelector("#panel").innerText)'), 'tapping inside the no-build zone refuses with Too close', tag)
            pg.screenshot(path=str(out / f'f02c_ring_flash_{tag}.png'))
            pg.wait_for_timeout(2900)
            pg.screenshot(path=str(out / f'f02c_ring_gone_{tag}.png'))
            pg.evaluate('() => document.querySelectorAll(".toast").forEach(t => t.remove())')
            pg.evaluate('() => { Render.resetCam(); UI.zoomChanged(); }'); pg.wait_for_timeout(200)
        else: check(False, 'found an open tile near a wormhole', tag)
        check(pg.evaluate('() => !document.querySelector("#bLift").hidden && /lift/i.test(document.querySelector("#bLift").innerText)'), 'Lift Off button on the field', tag)
        # 3. a fortress away from the core: a Rail Lance with three Pulse Blasters around it
        rail = pg.evaluate('''() => { G.credits = 50000; const c = G.map.core, sp = [];
          for (const L of G.map.lanes) for (const q of L.tiles) for (const [dx, dy] of [[1,0],[0,1],[-1,0],[0,-1]]) { const x = q.x + dx, y = q.y + dy; if (canBuildAt(x, y) && Math.abs(x - c.x) + Math.abs(y - c.y) > 9) sp.push([x, y]); }
          for (const [x, y] of sp) { let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && canBuildAt(x + dx, y + dy)) n++; if (n < 6 || !frCands().includes(tIdx(x, y))) continue;
            if (!window.act('build', 'rail', x, y)) continue; let k = 0; for (let dy = -2; dy <= 2 && k < 3; dy++) for (let dx = -2; dx <= 2 && k < 3; dx++) if ((dx || dy) && canBuildAt(x + dx, y + dy) && window.act('build', 'pulse', x + dx, y + dy)) k++;
            for (let i = 0; i < 4; i++) window.act('up', x, y); return { x, y }; } return null; }''')
        check(rail is not None, f'built a Rail Lance fortress at {rail}', tag)
        pg.evaluate('() => window.act("call")'); pg.wait_for_timeout(2500)
        # 4. Lift Off: the picker, then the preview on the Rail Lance
        pg.click('#bLift'); pg.wait_for_timeout(400)
        check(pg.evaluate('() => !!document.querySelector("#panel:not([hidden])") && /lift off/i.test(document.querySelector("#panel").innerText) && G.paused'), 'picker open, game paused', tag)
        pg.evaluate(f'() => Render.lookAt({rail["x"]} + 0.5, {rail["y"]} + 0.5)'); pg.wait_for_timeout(300)
        pg.screenshot(path=str(out / f'f03_picker_{tag}.png'))
        tap_tile(pg, rail['x'], rail['y'])
        txt = pg.inner_text('#panel')
        check('Docks' in txt and 'Rail Lance' in txt and '→' in txt and 'Links' in txt, 'preview: roads before → after, the docked Rail, links', tag)
        pg.screenshot(path=str(out / f'f04_preview_{tag}.png'))
        # 5. land and dock
        pg.click('[data-act=frgo]'); pg.wait_for_timeout(500)
        check(pg.evaluate('() => !!G.frFly && !G.paused && G.core.shield === 0'), 'in flight, game running, shield down', tag)
        pg.evaluate('() => Render.resetCam()'); pg.wait_for_timeout(200)
        pg.screenshot(path=str(out / f'f05_flight_{tag}.png'))
        pg.evaluate('() => { G.speed = 3; }')
        pg.wait_for_function('() => !G.frFly', timeout=20000); pg.evaluate('() => { G.speed = 1; }'); pg.wait_for_timeout(500); clear(pg)
        check(pg.evaluate(f'() => frDockT() && frDockT().type === "rail" && G.frLinks.length >= 1'), 'landed and docked on the Rail Lance, links up', tag)
        pg.evaluate('() => Render.resetCam()'); pg.wait_for_timeout(300)
        pg.screenshot(path=str(out / f'f06_docked_links_{tag}.png'))
        # 6. the core panel
        c = pg.evaluate('() => G.map.core'); tap_tile(pg, c['x'], c['y'])
        txt = pg.inner_text('#panel')
        check('Docked' in txt and 'Links' in txt and 'Weapon Element' not in txt, 'core panel: docked weapon, links, no element buttons', tag)
        pg.screenshot(path=str(out / f'f07_core_panel_{tag}.png'))
        pg.click('#panel [data-act=tab][data-v=info]'); pg.wait_for_timeout(250)
        txt = pg.inner_text('#panel'); want = pg.evaluate('() => { const d = frDockT(); return [Math.round(d.s.dmg * (1 + d.buff.dmg)), Math.round(coreStats().dmg)]; }')
        check('Docked' in txt and 'Rail Lance' in txt and 'Shells hit' not in txt and pg.evaluate(f'() => fmt({want[0]})') in txt, f'core Details tab shows the docked Rail Lance (damage {want[0]}, plain cannon {want[1]})', tag)
        pg.screenshot(path=str(out / f'f07b_core_details_docked_{tag}.png'))
        pg.evaluate('() => UI.closePanel()'); pg.wait_for_timeout(150)
        # 7. move a linked tower
        t = pg.evaluate('() => { const t = G.frLinks[0]; return { x: t.x, y: t.y, id: t.id }; }')
        tap_tile(pg, t['x'], t['y'])
        check(pg.evaluate('() => !!document.querySelector("#panel [data-act=frmove]")'), 'tower panel has Move', tag)
        pg.click('#panel [data-act=frmove]'); pg.wait_for_timeout(300)
        dest = pg.evaluate(f'''() => {{ const t = G.towers.find(o => o.id === {t["id"]}); let best = null;
          for (let y = G.region.y0; y < G.region.y1; y++) for (let x = G.region.x0; x < G.region.x1; x++) {{ if (!canBuildAt(x, y)) continue; const d = Math.abs(x - t.x) + Math.abs(y - t.y); if (d >= 3 && d <= 5 && (!best || d > best.d)) best = {{ x, y, d }}; }} return best; }}''')
        pg.evaluate(f'() => Render.lookAt({dest["x"]} + 0.5, {dest["y"]} + 0.5)'); pg.wait_for_timeout(200)
        tap_tile(pg, dest['x'], dest['y'])
        check(pg.evaluate('() => !document.querySelector("[data-act=frmovego]").disabled'), 'picked a new tile', tag)
        pg.screenshot(path=str(out / f'f08_move_pick_{tag}.png'))
        cr0 = pg.evaluate('() => G.credits')
        pg.click('[data-act=frmovego]'); pg.wait_for_timeout(700)
        check(pg.evaluate(f'() => {{ const t = G.towers.find(o => o.id === {t["id"]}); return t.x === {dest["x"]} && t.y === {dest["y"]} && t.mvT > 0 && t.disCause === "MOVING"; }}') and pg.evaluate('() => G.rlog.some(e => e.k === "frMove" && e.fee > 0)'),
              'tower moved, offline while it flies, fee paid', tag)
        pg.screenshot(path=str(out / f'f09_moving_{tag}.png'))
        pg.evaluate('() => UI.closePanel()')
        # 8. edge arrows: a boss far up the road, off screen; tapping the arrow looks at it
        pg.evaluate('''() => { Render.resetCam(); const L = G.map.lanes.reduce((a, l) => l.len > a.len ? l : a); const e = spawnBoss({ boss: 'behemoth', lane: L, hpm: 50 }); e.d = 0.5;
          const c = Render.tileToScreen(G.core.x, G.core.y); Render.zoomAt(c.x, c.y, 2.5); }''')  # zoomed in on the core, so the boss is off screen on every size
        pg.wait_for_timeout(500)
        arr = pg.evaluate('() => Render.frArrows.map(a => [Math.round(a.sx), Math.round(a.sy), a.home])')
        check(len(arr) >= 1, f'edge arrow for the off-screen boss {arr[:3]}', tag)
        pg.screenshot(path=str(out / f'f10_arrows_{tag}.png'))
        if arr:
            r = pg.evaluate('() => { const r = document.querySelector("#cv").getBoundingClientRect(); return [r.left, r.top]; }'); u = pg.evaluate('UIS')
            clear(pg); pg.mouse.click(r[0] + arr[0][0] * u, r[1] + arr[0][1] * u); pg.wait_for_timeout(400)
            check(pg.evaluate('() => !Render.home') and 'home' in pg.inner_text('#bZoom').lower(), 'tapping the arrow looks there; the Fit button says Home', tag)
            clear(pg); pg.click('#bZoom'); pg.wait_for_timeout(300)
            check(pg.evaluate('() => Render.home'), 'Home recentres on the core', tag)
        # 9. the bigger board, zoomed all the way out
        pg.evaluate('() => { G.lanesOpened = G.laneWaves.length; G.region = { x0: 0, y0: 0, x1: COLS, y1: ROWS }; }'); pg.wait_for_timeout(2900)
        pg.evaluate('() => { Render.overview(); Render.zoomAt(200, 150, 0.2); UI.zoomChanged(); }'); pg.wait_for_timeout(400)
        pg.screenshot(path=str(out / f'f11_board_zoomed_out_after_dock_{tag}.png'))
        # 10. a Daily Hunt runs on Frontier rules: the setup tab, the run, a lift-off and a move, resume by replay, its hunt code
        pg.evaluate('() => { G = null; PROF.runSnap = null; PROF.daily = null; UI.closePanel(); UI.show("hangar"); UI.renderHangar(); UI.openSetupDaily(); }'); pg.wait_for_timeout(400)
        check(pg.evaluate('() => COLS === frCols(frRows(2)) && ROWS === frRows(2)') and 'daily hunt' in pg.inner_text('#modal').lower(), 'Daily setup shows the Frontier board', tag)
        pg.screenshot(path=str(out / f'f12_daily_setup_{tag}.png'))
        pg.evaluate('() => document.querySelector("[data-act=launchDaily]").click()'); pg.wait_for_timeout(400)
        pg.evaluate('() => { const b = document.querySelector("#modal [data-act=launchDaily][data-v=anyway]"); if (b) b.click(); }'); pg.wait_for_timeout(1500); clear(pg)
        check(pg.evaluate('() => !!(G && G.daily && G.fr === 1 && G.recOpts.frontier === 1 && G.recOpts.frV >= 2 && G.huntBuild)') and pg.evaluate('() => !document.querySelector("#bLift").hidden'), 'the Daily Hunt is a Frontier run (flag in its recording), Lift Off on the field', tag)
        d = pg.evaluate('''() => { const c = G.map.core, sp = []; for (const q of G.map.lanes[0].tiles) for (const [dx, dy] of [[1,0],[0,1],[-1,0],[0,-1]]) { const x = q.x + dx, y = q.y + dy; if (canBuildAt(x, y)) sp.push([x, y]); }
          let n = 0; for (const [x, y] of sp.slice(Math.floor(sp.length * 0.4))) { if (n >= 3) break; if (window.act('build', n ? 'pulse' : 'rail', x, y)) n++; }
          window.act('call'); return n; }''')
        pg.evaluate('() => { G.speed = 3; }'); pg.wait_for_timeout(5000); pg.evaluate('() => { G.speed = 1; }')
        flown = pg.evaluate('''() => { const att = G.towers.filter(t => frCands().includes(tIdx(t.x, t.y)) && frPlan(t.x, t.y)); const t = att[0]; if (!t) return false; return window.act('frFly', t.x, t.y); }''')
        check(flown, 'lifted off in the Daily Hunt (docking on a tower)', tag)
        pg.wait_for_function('() => !G.frFly', timeout=20000); clear(pg)
        moved = pg.evaluate('''() => { const t = G.towers.find(o => o !== frDockT()); if (!t) return false; for (let y = G.region.y0; y < G.region.y1; y++) for (let x = G.region.x0; x < G.region.x1; x++) if (canBuildAt(x, y) && Math.abs(x - t.x) + Math.abs(y - t.y) === 3 && window.act('frMove', t.x, t.y, x, y)) return true; return false; }''')
        check(moved and pg.evaluate('() => !!frDockT()'), 'docked, and moved a tower', tag)
        pg.evaluate('() => Render.resetCam()'); pg.wait_for_timeout(500)
        pg.screenshot(path=str(out / f'f13_daily_docked_{tag}.png'))
        # save and resume: a Daily Hunt resumes by replaying its inputs, exactly
        h = pg.evaluate('() => { snapshotNow(); Save.save(); return { h: runHash(), t: G.tick, w: G.wave, n: G.inputs.length }; }')
        pg.evaluate('() => { G = null; UI.show("hangar"); UI.renderHangar(); }'); pg.wait_for_timeout(300)
        check('daily hunt' in pg.inner_text('#hPlaySub').lower(), 'hangar offers the Daily Hunt resume', tag)
        pg.click('#bLaunch'); pg.wait_for_timeout(1500); clear(pg)
        r = pg.evaluate('() => G && G.resumedHunt ? { h: G.resumedHunt.h, t: G.resumedHunt.tick, fr: G.fr, dock: !!frDockT(), cols: COLS } : null')
        check(r and r['h'] == h['h'] and r['t'] == h['t'] and r['fr'] == 1 and r['dock'], f'Daily resume replays to the same state {r} vs {h}', tag)
        # its hunt code rebuilds the same run (Frontier board and all)
        rec = pg.evaluate('() => ({ opts: G.recOpts, inputs: G.inputs.slice(), end: G.tick })')
        code = pg.evaluate('async () => await UI._dbg.huntCode({ opts: G.recOpts, inputs: G.inputs.slice(), end: G.tick })')
        back = pg.evaluate('async c => { const r = await UI._dbg.readHuntCode(c); return r ? { fr: r.opts.frontier, frV: r.opts.frV, cols: r.opts.cols, rows: r.opts.rows, n: r.inputs.length } : null; }', code)
        check(code.startswith('HUNT') and back and back['fr'] == 1 and back['n'] == len(rec['inputs']), f'hunt code carries the Frontier flag {back}', tag)
        pg.evaluate('async c => { const r = await UI._dbg.readHuntCode(c); G = null; UI._dbg.watchRun(r, "Code"); }', code); pg.wait_for_timeout(800)
        check(pg.evaluate('() => !!(G && G.watch && G.fr === 1 && !document.querySelector("#bLift").hidden === false)') or pg.evaluate('() => !!(G && G.watch && G.fr === 1)'), 'watching the code plays a Frontier run', tag)
        pg.evaluate('() => { G.speed = 8; }'); pg.wait_for_function(f'() => G.tick >= {h["t"]} + 30 || G.over', timeout=60000)
        check(pg.evaluate('() => !!(G.watch && frDockT() && G.rlog.some(e => e.k === "frFly") && G.rlog.some(e => e.k === "frMove"))'), 'the watched run lifts off, docks and moves like the original', tag)
        pg.screenshot(path=str(out / f'f14_daily_watch_{tag}.png'))
        pg.evaluate('() => UI._dbg.endWatch()'); pg.wait_for_timeout(300)
        # 11. an old Classic save resumes as Classic: no Lift Off, the element buttons, "Classic" on the hangar
        pg.evaluate('''() => { setRows(26); setCols(44); newRun({ seed: 77, chaos: 1, cols: 44 }); snapshotRun(1); const s = PROF.runSnap; G = null; UI.show("hangar"); UI.renderHangar(); return !!s; }''')
        check('classic' in pg.inner_text('#hPlaySub').lower(), 'hangar marks a pre-6.1 save as Classic', tag)
        pg.click('#bLaunch'); pg.wait_for_timeout(1200); clear(pg)
        check(pg.evaluate('() => !!(G && !G.fr && COLS === 44) && document.querySelector("#bLift").hidden && !document.body.classList.contains("fr")'), 'the Classic save resumes as Classic (no Lift Off)', tag)
        c = pg.evaluate('() => G.map.core'); tap_tile(pg, c['x'], c['y'])
        check('weapon element' in pg.inner_text('#panel').lower(), 'a Classic run keeps its core element buttons', tag)
        pg.evaluate('() => { UI.closePanel(); G = null; PROF.runSnap = null; UI.show("hangar"); }')
        pg.close()
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', fails)
