# Monkey test: plays the real game for a long time with random inputs, jumping ahead through waves,
# and checks invariants (no page errors, finite numbers, the sim never stalls when it should be running).
# usage: python3 monkey.py MINUTES [W H] [seed]
import pathlib, sys, random, time, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
MIN = float(sys.argv[1]) if len(sys.argv) > 1 else 5
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (852, 393)
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 1
rnd = random.Random(SEED)
import mkpage; mkpage.mk()
errs, problems, stats = [], [], {'steps': 0, 'runs': 0, 'maxWave': 0, 'actions': {}, 'where': {}}
SKIP = {'wipe', 'xload', 'xpaste', 'xclip', 'xcopy', 'fs'}
CHECK = '''() => {
  const bad = [];
  if (typeof G !== 'undefined' && G) {
    for (const k of ['credits', 'score', 'time', 'wave', 'entropy']) if (!isFinite(G[k])) bad.push('G.' + k + '=' + G[k]);
    if (!isFinite(G.core.hp) || !isFinite(G.core.max) || G.core.max <= 0) bad.push('core hp ' + G.core.hp + '/' + G.core.max);
    if (G.credits < -1) bad.push('negative credits ' + G.credits);
    for (const e of G.enemies) if (!isFinite(e.x) || !isFinite(e.y) || !isFinite(e.hp)) { bad.push('enemy NaN ' + e.type); break; }
    for (const t of G.towers) if (!t.s || !isFinite(t.s.dmg) || !isFinite(t.s.range)) { bad.push('tower stats ' + t.type); break; }
    if (G.towers.some(t => G.towerAt[t.y * COLS + t.x] !== t)) bad.push('towerAt out of sync');
    if (G.map.tiles.filter(x => x === 4).length !== 1) bad.push('core tiles ' + G.map.tiles.filter(x => x === 4).length);
    if (G.enemies.length > 900) bad.push('enemy count ' + G.enemies.length);
    if (G.projs.length > 3000) bad.push('projectiles ' + G.projs.length);
    if (typeof gridUsed === 'function' && G.towers.some(t => (t.oc || 0) < 0 || (t.oc || 0) > OVERCHARGE.max)) bad.push('overcharge out of range');
    for (const e of G.enemies) if (e.genes && e.genes.length > (e.assault ? Math.max(2, geneCap(G.wave) + 1) : geneCap(G.wave))) { bad.push('too many genes ' + e.genes.length + ' > cap ' + geneCap(G.wave)); break; }
  }
  if (Tree.isOpen && document.querySelector('#tree').hidden) bad.push('web marked open but hidden (game frozen)');
  const halted = !G || G.over || G.paused || G.draft || (G.checkpoint && !G.enemies.length) || Tree.isOpen || UI.modalOpen;
  return { bad, screen: UI.screen, modal: UI.modalOpen, halted: !!halted, time: G ? G.time : 0, wave: G ? G.wave : 0, over: G ? !!G.over : true, tree: Tree.isOpen, panel: !document.querySelector('#panel').hidden };
}'''
def tap(pg, sx, sy):
    pg.mouse.click(sx, sy)
def visible_buttons(pg, scope):
    return pg.evaluate('''(scope) => [...document.querySelectorAll(scope + ' button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !b.disabled && getComputedStyle(b).visibility !== 'hidden' && b.offsetParent !== null; })
      .map((b, i) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, act: b.dataset.act || b.dataset.tact || b.id || '' }; })''', scope)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1, has_touch=True)
    pg.on('pageerror', lambda e: errs.append((str(e)[:200] + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:4]))[:500]))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.wait_for_timeout(500)
    pg.evaluate('() => { (function c() { window.__fr = (window.__fr || 0) + 1; requestAnimationFrame(c); })(); }')
    pg.evaluate('() => { PROF.bestWave = 60; PROF.xp = 900000; PROF.seenHelp = true; PROF.zoomHint = true; UI.renderHangar(); }')
    end = time.time() + MIN * 60
    last = None; stall = 0
    while time.time() < end:
        stats['steps'] += 1
        s = pg.evaluate(CHECK)
        for x in s['bad']:
            if x not in problems: problems.append(x); pg.screenshot(path=str(out / f'monkey_bad_{len(problems)}.png'))
        stats['maxWave'] = max(stats['maxWave'], s['wave'])
        wk = 'tree' if s['tree'] else ('modal:' + str(s['modal'])) if s['modal'] else s['screen']
        stats['where'][wk] = stats['where'].get(wk, 0) + 1
        # stall detection: running, unhalted, but sim time not moving across checks
        if s['screen'] == 'game' and not s['halted']:
            if last is not None and last['time'] == s['time'] and not last['halted']:
                stall += 1
                if stall == 1: stall_t0 = time.time()
            else: stall = 0
            if stall >= 6 and time.time() - stall_t0 > 4 and 'stall' not in ' '.join(problems):
                diag = pg.evaluate('''() => { const f0 = window.__fr || 0; return { speed: G.speed, paused: G.paused, draft: !!G.draft, cp: G.checkpoint, en: G.enemies.length, q: G.queue.length, next: G.next, prep: !!G.prep, reloc: !!G.reloc, hidden: document.hidden, modal: UI.modalOpen, sd: G.spawningDone, frames: f0 }; }''')
                pg.wait_for_timeout(500); diag['frames2'] = pg.evaluate('() => window.__fr || 0'); diag['time2'] = pg.evaluate('() => G.time')
                problems.append(f"stall at wave {s['wave']} t={s['time']:.1f} {json.dumps(diag)}"); pg.screenshot(path=str(out / f'monkey_stall_{SEED}.png'))
        last = s
        r = rnd.random()
        try:
            if s['tree']:
                bts = [x for x in visible_buttons(pg, '#tree') if x['act'] not in SKIP]
                done = [x for x in bts if x['act'] == 'close']
                if done and rnd.random() < 0.12: tap(pg, done[0]['x'], done[0]['y'])
                elif bts and rnd.random() < 0.7: bt = rnd.choice(bts); tap(pg, bt['x'], bt['y'])
                else:
                    cv = pg.query_selector('#tcv').bounding_box()
                    if cv: tap(pg, cv['x'] + rnd.random() * cv['width'], cv['y'] + rnd.random() * cv['height'])
                continue
            if s['modal']:
                bts = [x for x in visible_buttons(pg, '#modal') if x['act'] not in SKIP]
                if bts: bt = rnd.choice(bts); stats['actions'][bt['act']] = stats['actions'].get(bt['act'], 0) + 1; tap(pg, bt['x'], bt['y'])
                pg.wait_for_timeout(60)
                continue
            if s['screen'] == 'hangar':
                bts = visible_buttons(pg, '#hangar')
                if rnd.random() < 0.6 or not bts: pg.evaluate('() => document.querySelector("#bLaunch").click()')
                else: bt = rnd.choice(bts); tap(pg, bt['x'], bt['y'])
                pg.wait_for_timeout(150)
                if pg.evaluate('() => UI.modalOpen === "setup"'):
                    for sel in rnd.sample(['[data-act=ch]', '[data-act=sw]', '[data-act=reroll]', '[data-act=mode]'], 2):
                        els = pg.query_selector_all(sel)
                        if els: rnd.choice(els).evaluate('e => e.click()'); pg.wait_for_timeout(80)
                    if pg.query_selector('[data-act=launch]'): pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); stats['runs'] += 1
                    elif pg.query_selector('[data-act=launchDaily]'): pg.evaluate('() => document.querySelector("[data-act=launchDaily]").click()'); stats['runs'] += 1
                    pg.wait_for_timeout(200)
                    pg.evaluate('() => { if (G) { G.credits += 4000; G.speed = 3; } }')
                continue
            # in game
            if r < 0.35:   # tap the field
                cv = pg.query_selector('#cv').bounding_box()
                if cv: tap(pg, cv['x'] + rnd.random() * cv['width'], cv['y'] + rnd.random() * cv['height'])
            elif r < 0.62: # a panel or rail button
                bts = [x for x in visible_buttons(pg, '#game') if x['act'] not in SKIP]
                if bts: bt = rnd.choice(bts); stats['actions'][bt['act']] = stats['actions'].get(bt['act'], 0) + 1; tap(pg, bt['x'], bt['y'])
            elif r < 0.68: # tap the core, sometimes relocate or overdrive
                c = pg.evaluate('() => { const r = document.querySelector("#cv").getBoundingClientRect(); const p = Render.tileToScreen(G.map.core.x + 0.5, G.map.core.y + 0.5); return [r.left + p.x * UIS, r.top + p.y * UIS]; }')
                tap(pg, c[0], c[1])
            elif r < 0.72: # claim a crate if any
                c = pg.evaluate('() => { const cc = (G.caches || [])[0]; if (!cc) return null; const r = document.querySelector("#cv").getBoundingClientRect(); const p = Render.tileToScreen(cc.x + 0.5, cc.y + 0.5); return [r.left + p.x * UIS, r.top + p.y * UIS]; }')
                if c: tap(pg, c[0], c[1])
            elif r < 0.76: # zoom gestures
                cv = pg.query_selector('#cv').bounding_box(); x, y = cv['x'] + rnd.random() * cv['width'], cv['y'] + rnd.random() * cv['height']
                pg.mouse.move(x, y); pg.mouse.wheel(0, rnd.choice([-300, 300]))
            elif r < 0.80: # double tap
                cv = pg.query_selector('#cv').bounding_box(); x, y = cv['x'] + rnd.random() * cv['width'], cv['y'] + rnd.random() * cv['height']
                tap(pg, x, y); pg.wait_for_timeout(60); tap(pg, x, y)
            elif r < 0.86: # let it play
                pg.wait_for_timeout(rnd.choice([300, 800, 1500]))
            elif r < 0.90: # app hidden / shown (snapshot path)
                pg.evaluate('() => { snapshotNow(); }')
            elif r < 0.93: # reload the page mid-run (resume path)
                pg.reload(); pg.wait_for_timeout(600); pg.evaluate('() => { (function c() { window.__fr = (window.__fr || 0) + 1; requestAnimationFrame(c); })(); }')
                if pg.query_selector('#bLaunch'): pass
            else:          # jump ahead to cover later content
                pg.evaluate('''() => { if (!G || G.over) return; const j = 1 + Math.floor(Math.random() * 7); G.wave = Math.min(G.wave + j, 140); G.prep = null; G.credits += 3000 * (1 + G.wave / 10);
                  if (G.laneWaves[G.lanesOpened] !== undefined && G.laneWaves[G.lanesOpened] <= G.wave + 1) { G.wave = G.laneWaves[G.lanesOpened] - 1; }
                  G.next = Math.min(G.next, 1); }''')
        except Exception as ex:
            import traceback; problems.append('driver: ' + str(ex)[:120] + ' line ' + str(traceback.extract_tb(ex.__traceback__)[-1].lineno)) if 'driver' not in ' '.join(problems) else None
    pg.screenshot(path=str(out / f'monkey_end_{SEED}.png'))
    b.close()
print(json.dumps({'seed': SEED, 'errors': list(dict.fromkeys(errs))[:20], 'problems': problems[:30], 'steps': stats['steps'], 'runs': stats['runs'], 'maxWave': stats['maxWave'], 'where': stats['where'], 'topActions': sorted(stats['actions'].items(), key=lambda kv: -kv[1])[:25]}, indent=1))
