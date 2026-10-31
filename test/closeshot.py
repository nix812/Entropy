"""v4.4.1: panel headers stay pinned while scrolling, and tapping empty ground closes a panel.
Run after build.py:  python3 closeshot.py   (screenshots in test/out/close_*.png)"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
mkpage.mk()
errs, fails = [], []
def check(cond, msg):
    if not cond: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'TUNNEL' not in m.text else None)
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 3; PROF.seenVer = VERSION; PROF.settings.briefings = "brief"; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200)
    pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('() => { const m = document.querySelector("#modal"); if (m && !m.hidden) UI.closeModal && UI.closeModal(); G.credits = 50000; G.paused = true; }')
    # screen position of a tile centre
    pos = '''([x, y]) => { const s = Render.tileToScreen(x + 0.5, y + 0.5), r = document.querySelector("#cv").getBoundingClientRect(); return [r.left + s.x * UIS, r.top + s.y * UIS]; }'''
    # buildable tiles on the right 40% of the field (the panel then opens on the left, out of the way)
    spots = pg.evaluate('''() => { const a = [], W = Render.layout.W; for (let y = 1; y < ROWS - 1; y++) for (let x = 0; x < COLS; x++) {
      if (!canBuildAt(x, y) || !inRegion(x, y, G.region)) continue; const s = Render.tileToScreen(x + 0.5, y + 0.5); if (s.x < W * 0.6 || s.x > W * 0.9) continue; const r = document.querySelector('#cv').getBoundingClientRect(); if (document.elementFromPoint(r.left + s.x * UIS, r.top + (s.y - 22) * UIS) !== document.querySelector('#cv') || document.elementFromPoint(r.left + s.x * UIS, r.top + s.y * UIS) !== document.querySelector('#cv')) continue; a.push([x, y]); } return a; }''')
    def tap(xy):
        pg.evaluate('() => { const t = document.querySelector("#toasts"); if (t) t.style.display = "none"; }')
        sx, sy = pg.evaluate(pos, xy)
        cov = pg.evaluate('([x, y]) => { const e = document.elementFromPoint(x, y); return e === document.querySelector("#cv") ? null : (e.id || e.className || e.tagName) + " in " + (e.closest("[id]") || {}).id; }', [sx, sy])
        check(cov is None, f'tile {xy} is covered by {cov}')
        pg.mouse.click(sx, sy); pg.wait_for_timeout(420)  # past the double-tap window
    state = lambda: pg.evaluate('() => document.querySelector("#panel").hidden ? null : (document.querySelector("#panel .ph b") || {}).textContent')
    a = spots[0]; c = max(spots, key=lambda s: abs(s[0] - a[0]) + abs(s[1] - a[1]))
    # 1. empty tile opens Build; tapping other empty ground closes it
    tap(a); check(state() == 'Build', f'tap empty did not open build: {state()}')
    tap(c); check(state() is None, f'tap empty ground did not close build: {state()}')
    # 2. tapping the same tile again closes
    tap(a); tap(a); check(state() is None, 'second tap on selected tile did not close')
    # 3. tower panel: tap another tower switches, empty ground closes
    pg.evaluate('([a, c]) => { buildTower("pulse", a[0], a[1]); buildTower("rail", c[0], c[1]); }', [a, c])
    tap(a); s1 = state(); tap(c); s2 = state()
    check(s1 is not None and s2 is not None and s1 != s2, f'tower switch failed: {s1} -> {s2}')
    e = next(s for s in spots if s != a and s != c)
    tap(e); check(state() is None, 'tap empty did not close tower panel')
    # 4. core panel: header stays pinned after scrolling to the bottom
    pg.evaluate('() => UI.openCore ? UI.openCore() : null')
    if state() is None:
        core = pg.evaluate('() => [G.map.core.x, G.map.core.y]'); tap(core)
    check(state() is not None, 'core panel did not open')
    pg.evaluate('() => { const el = document.querySelector("#panel"); el.scrollTop = el.scrollHeight; }'); pg.wait_for_timeout(150)
    geo = pg.evaluate('''() => { const el = document.querySelector("#panel"), x = el.querySelector(".ph .x"), r = el.getBoundingClientRect(), xr = x.getBoundingClientRect();
      return { scroll: el.scrollTop, max: el.scrollHeight - el.clientHeight, xTop: xr.top - r.top, hit: document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2) === x }; }''')
    pg.screenshot(path=str(out / 'close_core_scrolled.png'))
    check(geo['xTop'] < 20 and geo['hit'], f'core close button not pinned: {geo}')
    pg.click('#panel .ph .x'); pg.wait_for_timeout(150); check(state() is None, 'pinned close button did not close')
    # 5. tower panel scrolled
    tap(a); pg.evaluate('() => { const el = document.querySelector("#panel"); el.scrollTop = el.scrollHeight; }'); pg.wait_for_timeout(150)
    pg.screenshot(path=str(out / 'close_tower_scrolled.png'))
    # 6. a long modal (Help) scrolled: header pinned
    pg.click('#bPause'); pg.wait_for_timeout(250)
    has_help = pg.evaluate('() => !!document.querySelector("[data-act=help]")')
    if has_help:
        pg.click('[data-act=help]'); pg.wait_for_timeout(300)
        mg = pg.evaluate('''() => { const c = document.querySelector("#modal .card"); c.scrollTop = c.scrollHeight; const h = c.querySelector(".ch"), x = h && h.querySelector(".x");
          return { scroll: c.scrollTop, top: h ? h.getBoundingClientRect().top - c.getBoundingClientRect().top : null, hit: x ? document.elementFromPoint(x.getBoundingClientRect().left + 10, x.getBoundingClientRect().top + 10) === x : null }; }''')
        pg.wait_for_timeout(150); pg.screenshot(path=str(out / 'close_help_scrolled.png'))
        check(mg['top'] is not None and mg['top'] < 6 and mg['hit'] is not False, f'help header not pinned: {mg}')
    else: fails.append('no help button in pause')
    b.close()
print('FAILS:', fails)
print('ERRORS:', [x for x in errs if 'closePanelForTest' not in x][:10])
