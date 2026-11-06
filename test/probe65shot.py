"""6.5 probe65 through the real UI: the Probe button under Lift Off, the first-time card, selecting the probe (6.5.2 command
mode: button, a loot site; the bar, no side panel), sending it by tapping the map (recorded as prGo), a site shown in the bar and
sent by a second tap, Recall in the bar and by tapping the core, ✕ / the button / Escape to leave, the Upgrades panel and a
purchase (closing it returns to the bar), each site kind up close, a guard fight, the edge arrows, a lost probe and its rebuild, and the
Dictionary entry. Screenshots in test/out/probe65/. usage: python3 probe65shot.py [WxH ...]  (default 667x375 1180x820)"""
import pathlib, sys
from playwright.sync_api import sync_playwright
import mkpage
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out' / 'probe65'; out.mkdir(parents=True, exist_ok=True)
sizes = [tuple(int(v) for v in a.split('x')) for a in sys.argv[1:]] or [(667, 375), (1180, 820)]
mkpage.mk(); errs = []; fails = []
def check(cond, msg, W):
    print(('ok   ' if cond else 'FAIL ') + f'{W}: {msg}')
    if not cond: fails.append(f'{W}: {msg}')
SEEN = '{v58:1,storm:1,crate:1,vet:1,abil:1,upg:1,power:1,spare:1,wormhole:1,anomaly:1,boss:1,market:1,support:1,tech:1,frontier:1}'
def scr(pg, x, y):
    return pg.evaluate(f'() => {{ const r = document.querySelector("#cv").getBoundingClientRect(); const p = Render.tileToScreen({x}, {y}); return [r.left + p.x * UIS, r.top + p.y * UIS]; }}')
def tap_at(pg, x, y):
    c = scr(pg, x, y); pg.mouse.click(c[0], c[1]); pg.wait_for_timeout(250)
# a gallery of every site kind around a spot (the sim's own objects, placed by hand for the picture)
GALLERY = '''([cx, cy]) => { const ws = 1 + G.wave / PROBE.wS, mk = (k, dx, dy, o) => Object.assign({ id: G.eid++, k, x: cx + dx, y: cy + dy, t: 99, life: 120, val: 400, rich: 0, prog: 0, g: [], z: 1, jp: 0.05, hp: 60, max: 60, chunks: 0, ent: 15, crystal: 0, vx: 0, vy: 0 }, o || {});
  G.sites = [mk('wreck', -3, -1.2), mk('cloud', 0.2, -1), mk('rock', 3, -1.2, { crystal: 1 }), mk('wreck', -3, 1.8, { rich: 1 }), mk('rock', 0, 2, { hp: 25, chunks: 1 }), mk('lost', 3, 1.8)];
  G.sites[1].prog = 0.3; G.sites[3].prog = 0.6; Render.resetCam(); Render.zoomAt(Render.layout.W / 2, Render.layout.H / 2, 2.2); Render.lookAt(cx, cy + 0.3); UI.zoomChanged(); }'''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W, H in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
        pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
        pg.evaluate(f'() => {{ PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.bestWave = 30; PROF.runSnap = null; PROF.seenSys = {SEEN}; PROF.tut = Object.assign(PROF.tut || {{}}, {{ seen: 1, done: 1 }}); UI.renderHangar(); }}')
        pg.click('#bLaunch'); pg.wait_for_timeout(300)
        pg.click('[data-act=launch]'); pg.wait_for_timeout(1500)
        pg.evaluate('() => document.querySelectorAll("#modal [data-act=brief]").forEach(b => b.click())'); pg.wait_for_timeout(200)
        check(pg.evaluate('() => !!(G.probe && G.frV >= 5) && !document.querySelector("#bProbe").hidden && /probe/i.test(document.querySelector("#bProbe").innerText)'), 'a new run has the probe and the Probe button', tag)
        geo = pg.evaluate('() => { const a = document.querySelector("#bLift").getBoundingClientRect(), b = document.querySelector("#bProbe").getBoundingClientRect(); return [a.bottom <= b.top, Math.abs(a.right - b.right) < 1]; }')
        check(geo[0] and geo[1], f'the Probe button sits under Lift Off {geo}', tag)
        # 1. the first-time card waits for the first loot site
        pg.evaluate('() => { G.wave = 12; G.credits = 20000; G.siteT = 0; }'); pg.wait_for_timeout(700)
        try: pg.wait_for_selector('#modal .intro', timeout=4000)
        except Exception: pass
        check(pg.evaluate('() => !!document.querySelector("#modal .intro") && /probe/i.test(document.querySelector("#modal").innerText) && G.sites.length > 0'), 'the first loot site brings the Probe card', tag)
        pg.screenshot(path=str(out / f'p01_intro_{tag}.png'))
        pg.evaluate('() => document.querySelectorAll("#modal [data-act=brief]").forEach(b => b.click())'); pg.evaluate('() => { PROF.settings.briefings = "off"; }'); pg.wait_for_timeout(200)
        # 2. (6.5.2 command mode) the Probe button selects the probe: a small bar under it, no side panel; a tap on the map sends it
        pg.click('#bProbe'); pg.wait_for_timeout(300)
        st = pg.evaluate('() => [!document.querySelector("#prbar").hidden, document.querySelector("#panel").hidden, Render.prSel === true, document.querySelector("#bProbe").classList.contains("sel"), document.querySelector("#prbar").innerText]')
        check(st[0] and st[1] and st[2] and st[3] and 'tap the map' in st[4].lower(), f'the Probe button selects it: the bar says what a tap does, the panel stays shut {st[:4]}', tag)
        pg.screenshot(path=str(out / f'p02a_select_{tag}.png'))
        P0 = pg.evaluate('() => [G.probe.x, G.probe.y, G.core.x, G.core.y, COLS, ROWS]')
        side = -1 if P0[0] > P0[4] / 2 else 1
        # a spot in the open field, clear of the bar and the buttons: the middle of the lower half of the canvas
        dest = pg.evaluate('() => { const L = Render.layout, p = Render.screenToTile ? Render.screenToTile(L.W * 0.45, L.H * 0.7) : null; if (p) return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; const c = Render.tileToScreen(0, 0), c1 = Render.tileToScreen(1, 1), k = c1.x - c.x; return [Math.round((L.W * 0.45 - c.x) / k * 10) / 10, Math.round((L.H * 0.7 - c.y) / k * 10) / 10]; }')
        tap_at(pg, dest[0], dest[1])
        st = pg.evaluate('() => [G.probe.tx, G.probe.ty, G.probe.home, G.inputs.filter(i => i[1] === "prGo").length, !document.querySelector("#prbar").hidden]')
        check(st[3] == 1 and st[2] == 0 and abs(st[0] - dest[0]) < 0.2 and abs(st[1] - dest[1]) < 0.2 and st[4], f'a tap on the map sends it (prGo recorded); the bar stays {st}', tag)
        tap_at(pg, dest[0] + side * 2, dest[1] - 1)
        check(pg.evaluate('() => G.inputs.filter(i => i[1] === "prGo").length') == 2, 'a second tap sends it again (still selected)', tag)
        pg.wait_for_timeout(900)
        pg.screenshot(path=str(out / f'p02_selected_path_{tag}.png'))
        # 3. Recall in the bar, then a tap on the core also recalls
        pg.evaluate('() => document.querySelector("#prbar [data-pr=home]").click()'); pg.wait_for_timeout(200)
        check(pg.evaluate('() => (G.probe.ret === 1 || G.probe.home === 1) && G.inputs.some(i => i[1] === "prHome") && document.querySelector("#prbar [data-pr=home]").disabled'), 'Recall in the bar brings it home (prHome recorded; Recall dims)', tag)
        tap_at(pg, dest[0], dest[1]); pg.wait_for_timeout(700); tap_at(pg, P0[2], P0[3])  # spaced: two quick taps read as a double tap
        check(pg.evaluate('() => G.probe.ret === 1 || G.probe.home === 1'), 'a tap on the core recalls it', tag)
        # ✕ lets it go: the bar hides, Ready may return, map taps work as before
        pg.evaluate('() => document.querySelector("#prbar [data-pr=x]").click()'); pg.wait_for_timeout(200)
        check(pg.evaluate('() => Render.prSel === false && document.querySelector("#prbar").hidden && !document.querySelector("#bProbe").classList.contains("sel")'), '✕ deselects it', tag)
        n0 = pg.evaluate('() => G.inputs.filter(i => i[1] === "prGo").length'); tap_at(pg, dest[0], dest[1])
        check(pg.evaluate('() => G.inputs.filter(i => i[1] === "prGo").length') == n0, 'deselected: a map tap no longer sends it', tag)
        pg.evaluate('() => UI.closePanel()')
        # the Probe button toggles; Escape leaves too
        pg.click('#bProbe'); pg.wait_for_timeout(150); pg.click('#bProbe'); pg.wait_for_timeout(150)
        ok1 = pg.evaluate('() => document.querySelector("#prbar").hidden && !Render.prSel')
        pg.click('#bProbe'); pg.wait_for_timeout(150); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
        check(ok1 and pg.evaluate('() => document.querySelector("#prbar").hidden && !Render.prSel'), 'the Probe button toggles it, Escape leaves', tag)
        # 4. tap a site with nothing selected: the bar shows the site and says a second tap sends; the second tap sends
        pg.evaluate('() => { G.paused = true; const s = G.sites[0]; Render.lookAt(s.x, s.y); UI.zoomChanged(); }'); pg.wait_for_timeout(300)
        s0 = pg.evaluate('() => [G.sites[0].x, G.sites[0].y, G.sites[0].id]')
        tap_at(pg, s0[0], s0[1])
        txt = pg.evaluate('() => document.querySelector("#prbar").innerText')
        check(pg.evaluate('() => !document.querySelector("#prbar").hidden && document.querySelector("#panel").hidden') and 'again' in txt.lower() and pg.evaluate(f'() => G.probe.task !== {s0[2]}'), f'a tap on a loot site selects the probe and shows the site in the bar: {txt!r}', tag)
        pg.screenshot(path=str(out / f'p03_site_card_{tag}.png'))
        tap_at(pg, s0[0], s0[1])
        check(pg.evaluate(f'() => G.probe.task === {s0[2]}') and 'tap the map' in pg.evaluate('() => document.querySelector("#prbar").innerText').lower(), 'a second tap on the site sends it there', tag)
        # 5. Upgrades: the full panel (the site, cargo, upgrades); a purchase; closing it returns to the bar
        pg.evaluate('() => document.querySelector("#prbar [data-pr=ups]").click()'); pg.wait_for_timeout(300)
        txt = pg.evaluate('() => document.querySelector("#panel").hidden ? "" : document.querySelector("#panel").innerText')
        check('upgrades' in txt.lower() and 'credits' in txt.lower() and pg.evaluate('() => document.querySelector("#prbar").offsetParent === null'), 'Upgrades opens the full panel (the site and the upgrades); the bar steps aside', tag)
        pg.evaluate('() => { const pb = document.querySelector("#panel > .pbody"); if (pb) pb.scrollTop = pb.scrollHeight; }'); pg.wait_for_timeout(200)
        pg.screenshot(path=str(out / f'p04_upgrades_{tag}.png'))
        cr0 = pg.evaluate('() => G.credits')
        pg.evaluate('() => document.querySelector("#panel [data-act=prup][data-v=gun]").click()'); pg.wait_for_timeout(250)
        check(pg.evaluate(f'() => G.probe.lv.gun === 1 && G.credits < {cr0} && G.inputs.some(i => i[1] === "prUp" && i[2] === "gun") && /Lance 2/i.test(document.querySelector("#panel").innerText)'), 'buying Lance 1 (prUp recorded, the row now offers Lance 2)', tag)
        pg.evaluate('() => document.querySelector("#panel [data-act=close]").click()'); pg.wait_for_timeout(200)
        check(pg.evaluate('() => document.querySelector("#panel").hidden && !document.querySelector("#prbar").hidden && Render.prSel === true'), 'closing the panel returns to the bar', tag)
        pg.evaluate('() => document.querySelector("#prbar [data-pr=x]").click()'); pg.wait_for_timeout(150)
        # 6. every site kind up close
        pg.evaluate(GALLERY, [max(8, min(P0[4] - 8, P0[0] + side * 9)), max(8, min(P0[5] - 8, P0[1]))]); pg.wait_for_timeout(500)
        pg.screenshot(path=str(out / f'p05_sites_{tag}.png'))
        # 7. a guard fight: the probe with a Lance beside a guarded wreck (2 drones, a brute)
        pg.evaluate('''() => { const ws = 1 + G.wave / PROBE.wS, P = G.probe, s = G.sites[0]; s.g = ['drone', 'drone', 'brute'].map((k, j) => { const D = PROBE.guard[k], m = D.hp * Math.pow(ws, 1.2), a = j * 2.1; return { id: G.eid++, k, hp: m * (j ? 1 : 0.5), max: m, a, x: s.x + Math.cos(a), y: s.y + Math.sin(a), hx: s.x + Math.cos(a), hy: s.y + Math.sin(a), cd: 0, calm: 0, hitT: -9 }; });
          G.sites = G.sites.slice(0, 1); P.home = 0; P.ret = 0; P.task = 0; P.x = s.x + 1.6; P.y = s.y + 0.4; P.tx = P.x; P.ty = P.y; P.lv.gun = 2; P.lv.hull = 3; const St = prStats(); P.max = P.hp = St.max; G.paused = false; Render.lookAt(s.x + 0.8, s.y); UI.zoomChanged(); }''')
        pg.wait_for_timeout(1300)
        fight = pg.evaluate('() => [G.probe.hp < G.probe.max, G.sites[0] ? G.sites[0].g.some(g => g.hp < g.max) : true, /under fire/.test(document.querySelector("#bProbe").className) || document.querySelector("#bProbe").classList.contains("hit")]')
        check(fight[0] and fight[1], f'guards shoot the probe and the Lance hits back {fight}', tag)
        pg.screenshot(path=str(out / f'p06_guard_fight_{tag}.png'))
        # 8. edge arrows: sites around the map and the probe off screen, the camera zoomed on the core
        pg.evaluate('''() => { G.paused = true; G.sites = [[2, 2, 'wreck'], [COLS - 3, 3, 'cloud'], [3, ROWS - 3, 'rock'], [COLS - 3, ROWS - 3, 'wreck']].map(([x, y, k], i) => ({ id: 9300 + i, k, x, y, t: 99, life: 120, val: 100, rich: 0, prog: 0, g: [], z: i, jp: 0, hp: 50, max: 50, chunks: 0, ent: 5 }));
          const P = G.probe; P.x = G.core.x > COLS / 2 ? 3 : COLS - 3; P.y = ROWS / 2; P.tx = P.x; P.ty = P.y; Render.resetCam(); Render.zoomAt(Render.layout.W / 2, Render.layout.H / 2, 1.6); UI.zoomChanged(); Render.keepOut = UI._dbg.keepOutRects(); }''')
        pg.wait_for_timeout(400)
        arr = pg.evaluate('() => [Render.frArrows.filter(a => a.site).length, Render.frArrows.filter(a => a.prb).length]')
        check(1 <= arr[0] <= 3 and arr[1] == 1, f'magenta loot site arrows (at most 3) and the probe arrow {arr}', tag)
        pg.screenshot(path=str(out / f'p07_edge_arrows_{tag}.png'))
        A = pg.evaluate('() => { const a = Render.frArrows.find(x => x.site); return a ? [a.sx, a.sy, a.x, a.y] : null; }')
        if A:
            r = pg.evaluate('() => { const r = document.querySelector("#cv").getBoundingClientRect(); return [r.left, r.top]; }')
            pg.mouse.click(r[0] + A[0] * pg.evaluate('UIS'), r[1] + A[1] * pg.evaluate('UIS')); pg.wait_for_timeout(300)
            check(pg.evaluate(f'() => {{ const p = Render.tileToScreen({A[2]}, {A[3]}), L = Render.layout; return p.x > 0 && p.y > 0 && p.x < L.W && p.y < L.H; }}'), 'tapping a site arrow looks there', tag)
        # 9. a lost probe: the button says Rebuild; the panel prices it; Rebuild starts the yard timer
        pg.evaluate('() => { Render.resetCam(); UI.zoomChanged(); G.paused = false; G.probe.hp = -1; }'); pg.wait_for_timeout(500)
        check(pg.evaluate('() => !G.probe.alive && /rebuild/i.test(document.querySelector("#bProbe").innerText)'), 'a lost probe: the button reads Rebuild', tag)
        pg.click('#bProbe'); pg.wait_for_timeout(300)
        check(pg.evaluate('() => /Rebuild ·/i.test(document.querySelector("#panel").innerText)'), 'the panel shows the rebuild price', tag)
        pg.screenshot(path=str(out / f'p08_lost_{tag}.png'))
        pg.evaluate('() => document.querySelector("#panel [data-act=prbuild]").click()'); pg.wait_for_timeout(300)
        check(pg.evaluate('() => G.probe.rb > 0 && /probe \\d+s/i.test(document.querySelector("#bProbe").innerText)'), 'Rebuild: the yard timer runs on the button', tag)
        pg.evaluate('() => document.querySelector("#panel [data-act=close]").click()')
        # 10. Dictionary
        pg.evaluate('() => UI._dbg.openHelp ? UI._dbg.openHelp("dict") : null'); pg.wait_for_timeout(300)
        pg.evaluate('() => { const c = [...document.querySelectorAll("#modal [data-act=dcat]")].find(b => b.dataset.v === "probe"); if (c) c.click(); }'); pg.wait_for_timeout(300)
        check(pg.evaluate('() => /Gas cloud/i.test(document.querySelector("#modal").innerText) && /Rebuild/i.test(document.querySelector("#modal").innerText)'), 'the Dictionary has a Probe section', tag)
        pg.screenshot(path=str(out / f'p09_dictionary_{tag}.png'))
        pg.close()
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', fails)
