"""5.8: plus the bounty chip with the Bounty Purse stays in the chip row, clear of every control.
5.5.14 the music deck never sits on anything and the Music tile never overlaps an ability button: with the log and the doctrine list full, the ticker and the assault
banner up, the full HUD's stats box, toasts, the Map button, and a tower panel open on either side; at four screen sizes
(including an iPhone Pro Max).
6.2: the Home/Map button is gone (Lift Off, then Ready, top the right column); the edge arrows (yellow treasure arrows with a
chest, the green core arrow) never sit under a control or banner, never overlap each other, and at most 3 treasure arrows show.
usage: python3 trackcollide.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; mkpage.mk(); errs = []; fails = []
OVER = ['#log', '#docbar', '#panel', '#watchbar', '#cpBanner']  # the deck is a popover: it may cover the banners while open, never a control
JS_HITS = '''(over) => {
  const vis = el => { if (!el) return null; const cs = getComputedStyle(el); if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden') return null; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const out = [];
  const t = vis(document.querySelector('#bMusic')); if (!t) out.push('Music tile missing');
  else { for (const a of document.querySelectorAll('#abils > *, #railL > .rb:not(#bMusic)')) { const q = vis(a); if (q && hit(t, q)) out.push('#bMusic x ' + (a.id || a.className)); }
    const rl = document.querySelector('#railL').getBoundingClientRect(); if (t.top < rl.top - 1 || t.bottom > rl.bottom + 1) out.push('#bMusic outside the rail'); }
  for (const id of ['#mdeck']) { const r = vis(document.querySelector(id)); if (!r) continue;
    for (const o of over) { const el = document.querySelector(o); const kids = o === '#toasts' || o === '#log' || o === '#docbar' ? [...(el ? el.children : [])] : [el];
      for (const k of kids) { const q = vis(k); if (q && hit(r, q)) out.push(id + ' x ' + o); } } }
  // 5.8: the bounty chip carries the Bounty Purse; it must sit inside the chip row, clear of every control
  // (when the row is full it folds into the "+N" chip like every other chip, and the Field Report lists it)
  const wc = vis(document.querySelector('#chips [data-wanted]')); if (!wc) { if (!document.querySelector('#chips [data-more]')) out.push('bounty chip missing'); }
  else { const row = document.querySelector('#chips').getBoundingClientRect(); if (wc.right > row.right + 1 || wc.top < row.top - 1 || wc.bottom > row.bottom + 1) out.push('bounty chip outside the chip row');
    for (const s of ['#bLift', '#railL', '#railR', '#abils', '#log', '#docbar', '#panel', '#mdeck']) { const q = vis(document.querySelector(s)); if (q && hit(wc, q)) out.push('bounty chip x ' + s); } }
  // 5.8: the Ready button sits at the top right (under Lift Off on Frontier), clear of every control and banner (it hides while a right-hand panel is open)
  const rb = vis(document.querySelector('#bReady'));
  if (!rb && !document.body.classList.contains('panel-r') && !document.body.classList.contains('panel-l')) out.push('Ready button missing');
  if (rb) for (const s of ['#railR', '#railL', '#chips', '#ticker', '#asbar', '#mdeck', '#panel', '#docbar', '#hud', '#bLift']) { const q = vis(document.querySelector(s)); if (q && hit(rb, q)) out.push('Ready button x ' + s); }
  // Frontier: Lift Off tops the right column, above Ready, clear of every control and banner (it hides while a side panel is open)
  if (G && G.fr) { const lb = vis(document.querySelector('#bLift'));
    if (!lb && !document.body.classList.contains('panel-r') && !document.body.classList.contains('panel-l')) out.push('Lift Off button missing');
    if (lb) for (const s of ['#railR', '#railL', '#chips', '#ticker', '#asbar', '#mdeck', '#panel', '#docbar', '#hud', '#log']) { const el = document.querySelector(s); const kids = s === '#log' ? [...(el ? el.children : [])] : [el]; for (const k of kids) { const q = vis(k); if (q && hit(lb, q)) out.push('Lift Off x ' + s); } } }
  // 6.2: no Home button; the edge arrows stay clear of every control and banner and of each other
  if (document.querySelector('#bZoom')) out.push('the Home button is back');
  // the page re-reads these rects 4 times a second (and soon after a log line or toast changes); log lines fade and reflow, so
  // check the placement logic against a fresh read and one drawn frame rather than race that refresh
  Render.keepOut = UI._dbg.keepOutRects(); Render.draw(0);
  const cvr = document.querySelector('#cv').getBoundingClientRect(), arr = Render.frArrows;
  if (arr.filter(a => a.tre).length > 3) out.push('more than 3 treasure arrows');
  if (window._wantTre && !arr.some(a => a.tre)) out.push('no treasure arrow');
  for (let i = 0; i < arr.length; i++) { const a = arr[i], x = cvr.left + a.sx * UIS, y = cvr.top + a.sy * UIS, h = 11 * UIS;
    const box = { left: x - h, right: x + h, top: y - h, bottom: y + h };
    for (const o of arr.slice(i + 1)) if (Math.hypot(o.sx - a.sx, o.sy - a.sy) < 18) out.push('arrows overlap');
    for (const s of ['#bLift', '#bReady', '#railL', '#railR', '#panel', '#mdeck', '#ticker', '#asbar', '#docbar', '#log > *', '#dps', '#cpBanner', '#tip', '#toasts > *']) for (const el of document.querySelectorAll(s)) { const q = vis(el); if (q && hit(box, q)) out.push((a.tre ? 'treasure' : a.home ? 'core' : 'enemy') + ' arrow x ' + s); } }
  return out; }'''
TRE = '''() => { // crates all around the sector edges, the camera zoomed in on the middle: arrows on every side
  const R = G.region, pts = [[R.x0 + 1, R.y0 + 1], [R.x1 - 2, R.y0 + 1], [R.x0 + 1, R.y1 - 2], [R.x1 - 2, R.y1 - 2], [(R.x0 + R.x1) >> 1, R.y0 + 1], [(R.x0 + R.x1) >> 1, R.y1 - 2], [R.x0 + 1, (R.y0 + R.y1) >> 1], [R.x1 - 2, (R.y0 + R.y1) >> 1], [R.x1 - 3, R.y0 + 2], [R.x1 - 2, R.y0 + 3]];
  G.caches = pts.map(([x, y], i) => ({ x, y, t: 999, id: 9000 + i, kind: i % 3 ? 'normal' : 'gold' })); window._wantTre = 1;
  const L = Render.layout; Render.resetCam(); Render.zoomAt(L.W / 2, L.H / 2, 2.6); }'''
FILL = '''() => {
  document.body.classList.add('hudfull');
  const dps = document.querySelector('#dps'); dps.innerHTML = '<b>DPS</b><br>Pulse 1,234<br>Rail 5,678<br>Cryo 90<br>Lens 1,111<br>Mortar 222';
  const log = document.querySelector('#log'); log.innerHTML = Array.from({ length: 6 }, (_, i) => `<div class="fl" style="--c:#6ae2ff"><b>Now Playing</b> Analog Corridor · Techno ${i}</div>`).join('');
  const db = document.querySelector('#docbar'); db.hidden = false; db.innerHTML = '<span class="heat">Road heat <b>40%</b><i>/100%</i></span><span class="chest">War chest <b>3/8</b><i>next at 2,400</i></span><span class="ice">Ice jam <b>2</b><i>held</i></span>';
  const tk = document.querySelector('#ticker'); tk.hidden = false; tk.style.setProperty('--c', '#ffb03a'); tk.innerHTML = '<div class="tkl"><b>SURGE</b><span>The swarm surges: +40% enemies this wave, and they come faster than before</span></div><button class="tkb">LOG</button>';
  const as = document.querySelector('#asbar'); as.hidden = false; as.innerHTML = '<b>STRAIN ASSAULT</b><span>Wave 15 · Plating · Haste</span>'; document.body.classList.add('asbar');
  UI.toast('NOW PLAYING', 'Analog Corridor · Techno', '#6ae2ff');
  G.wantedTold = 1; G.purse = 1234567; for (const t of G.towers) t.pending = 1; UI._dbg.updateHud(true);
}'''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    # 6.1: every new run is a Frontier run (the Lift Off button joins the right column); 'cls' resumes a pre-6.1 Classic save
    for W, H, MODE in [(852, 393, 'fr'), (932, 430, 'fr'), (667, 375, 'fr'), (1180, 820, 'fr'), (852, 393, 'cls'), (667, 375, 'cls')]:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
        pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.settings.briefings = "off"; PROF.bestWave = 40; }')
        if MODE == 'cls': pg.evaluate('() => { setRows(26); setCols(44); newRun({ seed: 5, chaos: 1, cols: 44 }); snapshotRun(1); G = null; UI.renderHangar(); }')
        pg.click('#bLaunch'); pg.wait_for_timeout(300)
        if MODE == 'fr': pg.evaluate('() => document.querySelector("[data-act=launch]").click()')
        pg.wait_for_timeout(1500)
        pg.evaluate('() => document.querySelectorAll("[data-act=brief]").forEach(b => b.click())')
        # towers near the left and right edges of the map, so a panel opens on each side
        pg.evaluate('''() => { G.credits = 99999; const ok = (x, y) => canBuildAt(x, y); let L = null, R = null;
          for (let x = 0; x < COLS && !L; x++) for (let y = 0; y < ROWS && !L; y++) if (ok(x, y) && window.act('build', 'pulse', x, y)) L = G.towers[G.towers.length - 1];
          for (let x = COLS - 1; x >= 0 && !R; x--) for (let y = 0; y < ROWS && !R; y++) if (ok(x, y) && window.act('build', 'pulse', x, y)) R = G.towers[G.towers.length - 1];
          window._L = L; window._R = R; }''')
        pg.evaluate(FILL); pg.evaluate(TRE); pg.wait_for_timeout(600)
        pg.evaluate('() => document.querySelector("#bMusic").click()'); pg.wait_for_timeout(450)
        states = {}
        states['field, everything up'] = pg.evaluate(JS_HITS, OVER)
        pg.screenshot(path=str(root / 'test' / 'out' / f'trk_all_{W}{"_cls" if MODE == "cls" else ""}.png'))
        for side, t in [('left', '_L'), ('right', '_R')]:
            pg.evaluate(f'() => {{ UI._dbg.openTower(window.{t}); }}'); pg.wait_for_timeout(300); pg.evaluate(FILL); pg.evaluate('() => { if (document.querySelector("#mdeck").hidden) document.querySelector("#bMusic").click(); }'); pg.wait_for_timeout(800)
            cls = pg.evaluate('() => document.body.className')
            states[f'tower panel ({side}: {"panel-l" if "panel-l" in cls else "panel-r" if "panel-r" in cls else "?"})'] = pg.evaluate(JS_HITS, OVER)
            pg.screenshot(path=str(root / 'test' / 'out' / f'trk_panel_{side}_{W}{"_cls" if MODE == "cls" else ""}.png'))
            pg.evaluate('() => { const b = document.querySelector("#panel [data-act=close], #panel .x"); if (b) b.click(); }'); pg.wait_for_timeout(200)
        for k, v in states.items():
            print(f'   {W}x{H}{" classic" if MODE == "cls" else ""} {k}: {"clear" if not v else v}')
            if v: fails.append(f'{W}{MODE} {k}: {v}')
        pg.close()
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', fails)
