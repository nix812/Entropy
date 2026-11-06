"""6.5.2 ui652: tap target sizes. Opens the screens Nic taps most (the in-run top bar, rails and stage buttons, the probe
bar and probe panel, the tower, core and build panels, the four Settings tabs, the Music Studio tabs, a boon pick and an
Anomaly draw) and measures every visible tappable element:
  - its look (getBoundingClientRect), and
  - its real hit area: from the element's centre, step outward 1 px at a time while elementFromPoint still lands on the element
    (or a child), across and down. An invisible enlarged hit area (a ::before with a negative inset) counts, as on a phone.
  - stolen: of a 5 x 5 grid of points inside its look, how many land on a different tappable element (a neighbour's enlarged
    hit area must never do that).
Prints every element whose hit area is under 44 px (Apple's guideline) in either direction, per screen and size, and a
summary line. With --json FILE it writes all rows. Fails (FAIL lines) when a target steals a neighbour's taps, or when an
element listed in MUST44 is under 44 px.
usage: python3 tapsize.py [WxH ...] [--json FILE] [--page PATH]   (default 667x375 1180x820)"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
import mkpage
root = pathlib.Path(__file__).parent.parent
args = sys.argv[1:]
jout = args[args.index('--json') + 1] if '--json' in args else None
page = args[args.index('--page') + 1] if '--page' in args else None
sizes = [tuple(int(v) for v in a.split('x')) for a in args if 'x' in a and a[0].isdigit()] or [(667, 375), (1180, 820)]
if not page: mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
fails, errs, rows = [], [], []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
# the top bar, the stage buttons and the probe bar: these must reach 44 x 44 (where the element is shown)
MUST44 = ['#hud .hs.pwr', '#bCash', '#chips > *', '#bLift', '#bProbe', '#bReady', '#prbar button', '#ticker .tkb']
TAPS = ('button, a[href], [data-act], [data-threat], [data-wanted], [data-more], [data-evo], [data-abil], [role=button], select, '
        'input:not([type=hidden]), .hs.pwr, #asbar, .tkb')
MEASURE = '''([taps, mustSel]) => {
  const vis = el => { if (el.closest('[hidden]')) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || cs.pointerEvents === 'none') return null;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; if (r.right < 1 || r.bottom < 1 || r.left > innerWidth - 1 || r.top > innerHeight - 1) return null; return r; };
  // the top layer only: with a modal open, what is under it can't be tapped anyway
  const top = UI.modalOpen && document.querySelector('#modal') && !document.querySelector('#modal').hidden ? document.querySelector('#modal') : null;
  // the part of an element its scrolling ancestors let through (a panel row scrolled under the footer is not a target)
  const clip = el => { let r = el.getBoundingClientRect(), a = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue; const q = n.getBoundingClientRect(); a = { l: Math.max(a.l, q.left), t: Math.max(a.t, q.top), r: Math.min(a.r, q.right), b: Math.min(a.b, q.bottom) }; }
    return a.r - a.l >= 2 && a.b - a.t >= 2 ? a : null; };
  const all = [...document.querySelectorAll(taps)].filter(el => !el.disabled && vis(el) && clip(el) && (!top || top.contains(el)));
  const set = new Set(all), owner = n => { while (n && !set.has(n)) n = n.parentElement; return n; };
  const mine = (el, x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)) && owner(h) === el; };
  const name = el => { const id = el.id ? '#' + el.id : ''; const d = el.dataset || {}; const k = ['act', 'v', 'abil', 'threat', 'wanted', 'more', 'evo', 'tab', 'type', 'pr'].filter(k => d[k] !== undefined).map(k => `[${k}=${d[k]}]`).join('');
    const t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 22); return (id || el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '')) + k + (t ? ` "${t}"` : ''); };
  const out = [];
  for (const el of all) {
    // only the top-most tappable: a tappable inside another tappable counts as its own target
    const r = el.getBoundingClientRect(), c0 = clip(el), cx = Math.min(innerWidth - 1, Math.max(0, (c0.l + c0.r) / 2)), cy = Math.min(innerHeight - 1, Math.max(0, (c0.t + c0.b) / 2));
    let hw = 0, hh = 0, covered = !mine(el, cx, cy);
    if (!covered) {
      let a = cx, b = cx, c = cy, d = cy;
      while (a > 0 && mine(el, a - 1, cy)) a--; while (b < innerWidth - 1 && mine(el, b + 1, cy)) b++;
      while (c > 0 && mine(el, cx, c - 1)) c--; while (d < innerHeight - 1 && mine(el, cx, d + 1)) d++;
      hw = b - a + 1; hh = d - c + 1;
    }
    let stolen = 0, by = '';
    if (!covered) for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = c0.l + 1 + (c0.r - c0.l - 2) * i / 4, y = c0.t + 1 + (c0.b - c0.t - 2) * j / 4; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const h = document.elementFromPoint(x, y), o = h && owner(h); if (o && o !== el && !el.contains(o) && !o.contains(el)) { stolen++; by = name(o); } }
    const must = mustSel.some(s => el.matches(s));
    out.push({ name: name(el), w: Math.round(r.width), h: Math.round(r.height), hw, hh, covered, stolen, by, must });
  }
  return out; }'''
SEEN = '{v58:1,storm:1,crate:1,vet:1,abil:1,upg:1,power:1,spare:1,wormhole:1,anomaly:1,boss:1,market:1,support:1,tech:1,frontier:1,probe:1,fog:1}'
def measure(pg, scene, tag):
    R = pg.evaluate(MEASURE, [TAPS, MUST44])
    for r in R: r['scene'] = scene; r['size'] = tag; rows.append(r)
    small = [r for r in R if r['hw'] < 44 or r['hh'] < 44]
    print(f'--- {tag} {scene}: {len(R)} targets, {len(small)} under 44 px')
    for r in small: print(f'    {r["w"]:>4}x{r["h"]:<4} hit {r["hw"]:>4}x{r["hh"]:<4}{" COVERED" if r["covered"] else ""}{" MUST" if r["must"] else ""}  {r["name"]}')
    for r in R:
        if r['stolen']: check(False, f'{tag} {scene}: {r["name"]} loses {r["stolen"]}/25 points to {r["by"]}')
        if r['must'] and not r['covered'] and (r['hw'] < 44 or r['hh'] < 44): check(False, f'{tag} {scene}: {r["name"]} hit area {r["hw"]}x{r["hh"]} under 44')
with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
        pg.goto('file://' + page); pg.wait_for_timeout(500)
        pg.add_style_tag(content=':root{--sal:%spx!important;--sar:%spx!important;--sab:%spx!important}' % ((44, 44, 21) if W < 1000 else (0, 0, 20)))
        pg.evaluate(f'() => {{ PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.bestWave = 64; PROF.xp = 9e6; PROF.runs = 30; PROF.runSnap = null; PROF.seenSys = {SEEN}; PROF.settings.briefings = "off"; PROF.tut = Object.assign(PROF.tut || {{}}, {{ seen: 1, done: 1 }}); UI.renderHangar(); }}')
        D = 'UI._dbg'
        def modal(scene, js, settle=400):
            try: pg.evaluate(f'() => {{ {js} }}'); pg.wait_for_timeout(settle); measure(pg, scene, tag)
            except Exception as e: errs.append(f'{tag} {scene}: {e}')
        modal('settings_general', f'{D}.openSettings()')
        for t in ['sound', 'graphics', 'interface']:
            modal(f'settings_{t}', f'document.querySelector("#modal [data-act=setTab][data-v={t}]").click()', 250)
        pg.evaluate(f'() => {D}.closeModal()')
        modal('studio_listen', f'{D}.openStudio("hangar")', 800)
        for t in ['shape', 'compose']:
            modal(f'studio_{t}', f'const b = [...document.querySelectorAll("#modal [data-act]")].find(b => /tab/i.test(b.dataset.act) && b.dataset.v === "{t}"); b && b.click()', 400)
        pg.evaluate(f'() => {{ if (UI.modalOpen) {D}.closeModal(); }}')
        # a run in progress: the top bar with its chips, the rails, the stage buttons
        pg.evaluate(f'() => {D}.openSetup()'); pg.wait_for_timeout(300)
        pg.evaluate('() => { const m = document.querySelector("[data-act=mode][data-v=std]"); m && m.click(); }'); pg.wait_for_timeout(200)
        pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); pg.wait_for_timeout(1500)
        pg.evaluate(f'() => {{ document.querySelectorAll("#modal [data-act=brief]").forEach(b => b.click()); if (UI.modalOpen) {D}.closeModal(); }}')
        pg.evaluate('''() => { G.credits = 1e6; G.wave = 34; G.abilOn = { strike: 1, nova: 1, stasis: 1, overclock: 1, scan: 1 }; G.charges = { strike: 3, nova: 1, stasis: 2, overclock: 0, scan: 1 };
          const L = G.map.lanes[0]; let n = 0; for (const p of L.tiles.slice(2, 30)) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const x = p.x + dx, y = p.y + dy; if (n < 6 && canBuildAt(x, y)) { if (window.act('build', ['pulse', 'rail', 'cryo', 'missile', 'coil', 'lens'][n], x, y)) n++; } }
          for (const t of G.towers) { t.xp = 1e6; } if (typeof planWanted === 'function') try { G.wanted = G.wanted || null; } catch (e) {}
          G.paused = true; UI._dbg.updateHud(); }''')
        pg.wait_for_timeout(600)
        measure(pg, 'game', tag)
        pg.evaluate(f'() => {{ {D}.openTower(G.towers[0]); }}'); pg.wait_for_timeout(300); measure(pg, 'tower', tag)
        pg.evaluate('() => { const b = document.querySelector("#panel [data-act=tab][data-v=info]"); b && b.click(); }'); pg.wait_for_timeout(250); measure(pg, 'tower_info', tag)
        pg.evaluate(f'() => {D}.openCore()'); pg.wait_for_timeout(300); measure(pg, 'core', tag)
        pg.evaluate(f'() => {{ const R = G.region; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) if (canBuildAt(x, y)) {{ {D}.openBuild(x, y); return; }} }}'); pg.wait_for_timeout(300); measure(pg, 'build', tag)
        pg.evaluate('() => UI.closePanel()'); pg.wait_for_timeout(150)
        # the probe: its command bar (6.5.2) or, on older builds, its panel
        pg.evaluate('() => document.querySelector("#bProbe").click()'); pg.wait_for_timeout(350); measure(pg, 'probe_select', tag)
        pg.evaluate('() => { const u = document.querySelector("#prbar [data-pr=ups]"); if (u) u.click(); }'); pg.wait_for_timeout(350); measure(pg, 'probe_panel', tag)
        pg.evaluate('() => { UI.closePanel(); if (UI._dbg.probeEnd) UI._dbg.probeEnd(); }'); pg.wait_for_timeout(150)
        modal('pause', f'{D}.openPause()')
        pg.evaluate(f'() => {D}.closeModal()')
        modal('boon', 'G.paused = false; G.draft = [BOONS[0], BOONS[1], BOONS[2]];', 700)
        pg.evaluate('() => { if (UI.modalOpen === "boon" || G.draft) { const b = document.querySelector("#modal [data-act=boon]"); b && b.click(); } }'); pg.wait_for_timeout(300)
        modal('anomaly', 'G.paused = false; G.entropy = 100; G.anomOffers = null; addEntropy(0); document.querySelector("#bEnt") && document.querySelector("#bEnt").click();', 700)
        pg.close()
    b.close()
if jout: pathlib.Path(jout).write_text(json.dumps(rows, indent=0))
n44 = sum(1 for r in rows if r['hw'] < 44 or r['hh'] < 44)
print(f'TOTAL {len(rows)} targets measured, {n44} under 44 px, {sum(1 for r in rows if r["must"] and (r["hw"] < 44 or r["hh"] < 44) and not r["covered"])} top-bar/stage targets under 44 px')
print('ERRORS:', errs)
print('FAILED:', fails)
