"""v5.1.4 UI audit: opens every screen, modal and panel at several sizes, scrolls each scroll box to top, middle and
bottom, and flags text that is covered by another element, runs past its box, or is cut off. Screenshots of every state
go to test/out/uiaudit/<size>/; flagged states are listed at the end.
usage: python3 uiaudit.py [sizes]   sizes: comma list of WxH (default 852x393,667x375,1180x820)"""
import pathlib, sys, json, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
SIZES = [tuple(map(int, s.split('x'))) for s in (sys.argv[1] if len(sys.argv) > 1 else '852x393,667x375,1180x820').split(',')]
mkpage.mk()

CHECK = r'''(sel) => {
  const out = [], vw = innerWidth, vh = innerHeight;
  const roots = [...document.querySelectorAll(sel)].filter(r => r.offsetParent !== null || getComputedStyle(r).position === 'fixed');
  const desc = el => el ? (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + '<' + el.tagName.toLowerCase() + '>' : 'null';
  for (const root of roots) {
    const rr = root.getBoundingClientRect();
    for (const el of root.querySelectorAll('*')) {
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      // the visible part: inside every scrolling/clipping ancestor
      let top = r.top, bot = r.bottom, left = r.left, right = r.right, a = el.parentElement;
      while (a && a !== document.body) { const s = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(s.overflowY + s.overflowX)) { const ar = a.getBoundingClientRect(); top = Math.max(top, ar.top); bot = Math.min(bot, ar.bottom); left = Math.max(left, ar.left); right = Math.min(right, ar.right); } a = a.parentElement; }
      if (bot - top < 6 || right - left < 6) continue; // scrolled out of view: fine
      const txt = el.textContent.trim().slice(0, 40);
      // covered: sample a few points of the visible part
      const pts = [[(left + right) / 2, (top + bot) / 2], [left + 3, (top + bot) / 2], [right - 3, (top + bot) / 2]];
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
        const hit = document.elementFromPoint(x, y);
        if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
        if (hit.closest && (hit.closest('#etip') || hit.closest('#ticker') || hit.closest('#tip'))) continue;
        out.push({ k: 'covered', txt, by: desc(hit), at: [Math.round(x), Math.round(y)] }); break;
      }
      // cut off on the right (runs past a clipping box without an ellipsis by design)
      if (r.right > right + 2 && cs.textOverflow !== 'ellipsis' && cs.whiteSpace !== 'nowrap' && r.width < rr.width) out.push({ k: 'clipped', txt, over: Math.round(r.right - right) });
      if ((r.right > vw + 1 || r.left < -1) && !el.closest('#ticker, #log')) out.push({ k: 'offscreen', txt });
    }
  }
  return out;
}'''
SCROLLERS = '#modal .cbody, #modal .card:not(.framed), #panel .pbody, #panel:not(.framed), #tgrid, #tinfo, #ttabs, .newslist, .nlog, .dict'

def states(pg, name, w, h, outdir, flags):
    boxes = pg.evaluate(f'() => [...document.querySelectorAll("{SCROLLERS}")].filter(b => b.offsetParent !== null && b.scrollHeight > b.clientHeight + 4).length')
    pos = [0, 0.5, 1] if boxes else [0]
    for i, f in enumerate(pos):
        if boxes: pg.evaluate(f'() => {{ for (const b of document.querySelectorAll("{SCROLLERS}")) if (b.scrollHeight > b.clientHeight + 4) b.scrollTop = (b.scrollHeight - b.clientHeight) * {f}; }}')
        pg.wait_for_timeout(120)
        top = pg.evaluate('() => !document.querySelector("#modal").hidden ? "#modal" : (typeof Tree !== "undefined" && Tree.isOpen) ? "#tree" : (UI.screen === "game" ? "#hud, #railL, #railR, #panel:not([hidden]), #chips" : "#hangar")')
        res = pg.evaluate(CHECK, top)
        tag = f'{name}_{i}'
        pg.screenshot(path=str(outdir / f'{tag}.png'))
        # de-duplicate
        seen = set(); res2 = []
        for r in res:
            key = (r['k'], r['txt'], r.get('by'))
            if key not in seen: seen.add(key); res2.append(r)
        if res2: flags.append({'size': f'{w}x{h}', 'state': tag, 'issues': res2[:12]})

def run(w, h):
    outdir = root / 'test' / 'out' / 'uiaudit' / f'{w}x{h}'; outdir.mkdir(parents=True, exist_ok=True)
    for f in outdir.glob('*.png'): f.unlink()
    flags = []; errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(500)
        pg.add_style_tag(content=':root{--sal:%spx!important;--sar:%spx!important;--sab:%spx!important}' % ((44, 44, 21) if w < 1000 else (0, 0, 20)))
        pg.evaluate('() => { PROF.bestWave = 64; PROF.xp = 9e6; PROF.runs = 30; PROF.seenHelp = true; PROF.seenVer = VERSION; PROF.zoomHint = 1; PROF.settings.briefings = "pause"; PROF.seenSys = {storm:1,crate:1,vet:1,abil:1}; PROF.codex.enemies = {}; UI.renderHangar(); }')
        D = 'UI._dbg'
        states(pg, 'hangar', w, h, outdir, flags)
        def modal(name, js, settle=350):
            try:
                pg.evaluate(f'() => {{ {js} }}'); pg.wait_for_timeout(settle); states(pg, name, w, h, outdir, flags)
            except Exception as e: errs.append(f'{name}: {e}')
            pg.evaluate(f'() => {{ if (UI.modalOpen) {D}.closeModal(); }}')
        modal('setup', f'{D}.openSetup()')
        modal('setup_daily', f'{D}.openSetup(); document.querySelector("[data-act=mode][data-v=daily]").click()')
        modal('settings', f'{D}.openSettings()')
        modal('archive', f'{D}.openArchive()')
        modal('hall', f'{D}.openHall()')
        modal('news', f'{D}.openNews()')
        modal('transfer', f'{D}.openTransfer()')
        modal('studio', f'{D}.openStudio("hangar")', 800)
        for tab in ['basics', 'elements', 'run', 'progress', 'dict', 'status']:
            modal(f'help_{tab}', f'{D}.openHelp("{tab}")')
        pg.evaluate('() => Tree.open()'); pg.wait_for_timeout(400); states(pg, 'talents', w, h, outdir, flags)
        pg.evaluate('() => { Tree.select && Tree.select("xCell"); }'); pg.wait_for_timeout(200); states(pg, 'talents_sel', w, h, outdir, flags)
        pg.evaluate('() => Tree.close()'); pg.wait_for_timeout(200)
        # a game in progress
        pg.evaluate('() => { PROF.runSnap = null; }')
        pg.evaluate(f'() => {D}.openSetup()'); pg.wait_for_timeout(300); pg.click('[data-act=mode][data-v=std]'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(700)
        pg.evaluate('() => { if (UI.modalOpen) UI._dbg.closeModal(); }')
        pg.evaluate('''() => { G.credits = 1e6; G.wave = 34; G.abilOn = { strike: 1, nova: 1, stasis: 1, overclock: 1, scan: 1 }; G.charges = { strike: 3, nova: 1, stasis: 2, overclock: 0, scan: 1 };
          const L = G.map.lanes[0]; let n = 0; for (const p of L.tiles.slice(2, 20)) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const x = p.x + dx, y = p.y + dy; if (n < 8 && canBuildAt(x, y)) { const t = buildTower(['pulse', 'rail', 'cryo', 'missile', 'coil', 'lens', 'emp', 'flame'][n], x, y); if (t) { t.lvl = n % 2 ? 3 : 2; t.s = towerStats(t); t.pending = n === 1 ? 1 : 0; } n++; } }
          for (const k of ['reflector', 'tank', 'medic']) { const e = spawnEnemy(k, { lane: L, hpm: 1 }); e.d = 3; e.hp = e.maxHp = 1e8; e.genes = ['shell', 'ward']; e.elite = ['regen']; }
          spawnStorm(['ion'], G.towers[0].cx, G.towers[0].cy, 0, 0); G.paused = true; }''')
        pg.wait_for_timeout(300); states(pg, 'game', w, h, outdir, flags)
        for i in range(3):
            pg.evaluate(f'() => {{ {D}.openTower(G.towers[{i}]); }}'); pg.wait_for_timeout(250); states(pg, f'tower{i}', w, h, outdir, flags)
            pg.evaluate('() => { const b = [...document.querySelectorAll("#panel [data-act=tab]")].find(b => b.dataset.v === "info"); b && b.click(); }'); pg.wait_for_timeout(200); states(pg, f'tower{i}_info', w, h, outdir, flags)
        pg.evaluate(f'() => {D}.openCore()'); pg.wait_for_timeout(250); states(pg, 'core', w, h, outdir, flags)
        pg.evaluate('() => { const b = [...document.querySelectorAll("#panel [data-act=tab]")].find(b => b.dataset.v === "info"); b && b.click(); }'); pg.wait_for_timeout(200); states(pg, 'core_info', w, h, outdir, flags)
        pg.evaluate(f'() => {{ const R = G.region; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) if (canBuildAt(x, y)) {{ {D}.openBuild(x, y); return; }} }}'); pg.wait_for_timeout(250); states(pg, 'build', w, h, outdir, flags)
        pg.evaluate(f'() => {D}.openEnemy(G.enemies[0])'); pg.wait_for_timeout(250); states(pg, 'enemy', w, h, outdir, flags)
        pg.evaluate('() => UI.closePanel()')
        pg.evaluate('() => document.querySelector("#bCash").click()'); pg.wait_for_timeout(250); states(pg, 'cash', w, h, outdir, flags); pg.evaluate('() => UI.closePanel()')
        modal('pause', f'{D}.openPause()')
        modal('report', f'G.paused = false; UI.toast("PIRATES", "A test notice with a long body to see how the log wraps across the card", "#ff4d6a"); {D}.openReport()')
        modal('enemycard', f'{D}.enemyCard("carrier")')
        modal('intro', f'PROF.seenSys = {{}}; {D}.introCard("storm", "Storms", "Storms drift across the map and boost one element: towers of that element inside fight harder.")')
        modal('evo', f'{D}.openEvo(true)')
        modal('wanted', f'{D}.wantedPoster(true)')
        modal('assault', 'G.assault = planAssault(G.wave + 1); ' + f'{D}.openAssault(true)')
        modal('gameover', f'G.leakWave = {{ "tank+plating": 4 }}; G.over = true; {D}.openGameOver()', 600)
        b.close()
    return flags, errs

allf = []
for (w, h) in SIZES:
    f, e = run(w, h); allf += f
    print(f'{w}x{h}: {len(f)} flagged states, errors: {e[:4]}')
for f in allf:
    print(f"- {f['size']} {f['state']}: " + '; '.join(f"{i['k']} '{i['txt']}'" + (f" by {i['by']}" if i.get('by') else '') for i in f['issues'][:6]))
(root / 'test' / 'out' / 'uiaudit' / 'flags.json').write_text(json.dumps(allf, indent=1))
