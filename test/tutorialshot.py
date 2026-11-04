"""5.8 Training and the Field Manual.
Plays Basic Training end to end by tapping what the coach points at, then every Field Manual lesson, at 852x393, 667x375 and
1180x820. Checks: each step appears and advances, every step with a target resolves to a real element on screen, the card never
covers its target, the reward and PROF.tut are saved, Skip works, old profiles are not prompted, no page errors.
usage: python3 tutorialshot.py [WxH,...] [basic|lessons|all] [lesson ids, comma separated]
screenshots: test/out/tut/<size>_<nn>_<step>.png (Basic), test/out/tut/<size>_L_<lesson>_<nn>_<step>.png"""
import pathlib, sys, time, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'tut'; out.mkdir(parents=True, exist_ok=True)
sizes = [tuple(map(int, s.split('x'))) for s in (sys.argv[1] if len(sys.argv) > 1 else '852x393,667x375,1180x820').split(',')]
what = sys.argv[2] if len(sys.argv) > 2 else 'all'
only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
mkpage.mk(); errs = []; fails = []
def check(ok, msg):
    if not ok: fails.append(msg); print('FAIL', msg, flush=True)
CARD = '''() => { const c = document.querySelector('#coach'); if (!c || c.hidden || c.classList.contains('idle')) return null; const k = c.querySelector('.ccard').getBoundingClientRect(), r = c.querySelector('.cring');
  const rr = r.hidden ? null : r.getBoundingClientRect(), ok = c.querySelector('.cok');
  return { step: UI.coach.step, miss: UI.coach.miss, held: UI.coachHold, card: [k.left, k.top, k.width, k.height], ring: rr ? [rr.left, rr.top, rr.width, rr.height] : null, ok: !ok.hidden, title: c.querySelector('.ct').textContent, vw: innerWidth, vh: innerHeight }; }'''
# where the driver taps when the ring covers a group (the coach points at the group; a player taps one of its buttons)
TAPS = { 'vpick': '#modal [data-act=vpick]', 'spec': '#panel [data-act=spec]', 'pick': '#modal [data-act=vpick]', 'boon': '#modal .boons [data-act]', 'anom': '#modal [data-act=anom]', 'fire': '#panel .firerow [data-act=fire]:not(.on)', 'perk': '#panel [data-act=perk]' }
def fresh(pg, extra=''):
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { window.tutOfferTest = 1; PROF = Save.merge({}); PROF.seenVer = VERSION; ' + extra + ' Save.save(); UI.renderHangar(); }')
def drive(pg, tag, prefix, finished, limit=420):
    """tap through the coach until finished() is true; returns the steps seen in order"""
    seen = []; n = 0; last = None; stuck = 0; t0 = time.time()
    while time.time() - t0 < limit:
        if pg.evaluate(finished): break
        c = pg.evaluate(CARD)
        if not c:
            pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(120); continue
        pg.evaluate('() => { if (G && !G.over && G.speed > 1) G.speed = 1; }')
        if c['step'] != last:
            last = c['step']; stuck = 0
            if c['step'] not in seen:
                seen.append(c['step']); n += 1; pg.wait_for_timeout(150)
                pg.screenshot(path=str(out / f'{prefix}_{n:02d}_{c["step"]}.png')); c = pg.evaluate(CARD) or c
                k = c['card']; check(k[0] >= -1 and k[1] >= -1 and k[0] + k[2] <= c['vw'] + 1 and k[1] + k[3] <= c['vh'] + 1, f'{tag}: {c["step"]} card on screen {k}')
                check(not c['miss'], f'{tag}: {c["step"]} target not found')
                tl = pg.evaluate("() => { const t = document.querySelector('#tutlist'); if (!t || t.hidden || t.offsetParent === null || t.style.visibility === 'hidden') return null; const r = t.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
                if tl:
                    ox = max(0, min(k[0] + k[2], tl[0] + tl[2]) - max(k[0], tl[0])); oy = max(0, min(k[1] + k[3], tl[1] + tl[3]) - max(k[1], tl[1]))
                    check(ox * oy < 1, f'{tag}: {c["step"]} card covers the checklist')
                if c['step'] == 'ready':
                    pg.screenshot(path=str(out / f'{prefix}_ready_button.png'))
                    rb = pg.evaluate("() => { const r = document.querySelector('#bReady').getBoundingClientRect(); return ['#bZoom', '#railR', '#chips', '#bPause', '#ticker'].filter(q => { const e = document.querySelector(q); if (!e || e.offsetParent === null || e.hidden) return false; const o = e.getBoundingClientRect(); return !(o.right <= r.left || o.left >= r.right || o.bottom <= r.top || o.top >= r.bottom); }); }")
                    check(not rb, f'{tag}: Ready button collides with {rb}')
                if c['step'] == 'vpick': pg.screenshot(path=str(out / f'{prefix}_ready_walkthrough.png'))
                if c['step'] == 'upWhy' and tl:
                    pg.click('#tutlist'); pg.wait_for_timeout(200); pg.screenshot(path=str(out / f'{prefix}_checklist_strip.png'))
                    pg.click('#coach .cok'); pg.wait_for_timeout(250); pg.screenshot(path=str(out / f'{prefix}_checklist.png'))
                    lr = pg.evaluate("() => { const r = document.querySelector('#tutlist').getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect(), bad = ['#bCall', '#bZoom', '#abils [data-abil=strike]', '#chips'].filter(q => { const e = document.querySelector(q); if (!e || e.offsetParent === null) return false; const o = e.getBoundingClientRect(); return !(o.right <= r.left || o.left >= r.right || o.bottom <= r.top || o.top >= r.bottom); }); return { inside: r.left >= s.left - 1 && r.bottom <= s.bottom + 1 && r.top >= s.top - 1, bad }; }")
                    check(lr['inside'] and not lr['bad'], f'{tag}: open checklist stays in the stage and clear of controls {lr}')
                    pg.click('#tutlist'); pg.wait_for_timeout(150)
                    continue  # the Got it tap above already moved the coach on: re-read the step
                if c['ring']:
                    r = c['ring']; ox = max(0, min(k[0] + k[2], r[0] + r[2]) - max(k[0], r[0])); oy = max(0, min(k[1] + k[3], r[1] + r[3]) - max(k[1], r[1]))
                    check(ox * oy < 1, f'{tag}: {c["step"]} card covers its target')
        stuck += 1
        if stuck > 40: check(False, f'{tag}: stuck on {c["step"]}'); break
        if c['ok']: pg.click('#coach .cok'); pg.wait_for_timeout(220); continue
        if c['ring'] and (c['held'] or c['step'] in ('resume',) or 'call' in c['step'] or c['step'].startswith('c') and c['step'][1:].isdigit()):
            if c['step'] in TAPS and pg.evaluate(f"() => !!document.querySelector('{TAPS[c['step']]}')"): pg.click(TAPS[c['step']])
            else: r = c['ring']; pg.touchscreen.tap(r[0] + r[2] / 2, r[1] + r[3] / 2)
            pg.wait_for_timeout(380); continue
        pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(150)
    return seen
def basic(pg, tag):
    fresh(pg)
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    check(pg.evaluate('() => UI.modalOpen') == 'tutoffer', f'{tag}: fresh profile is offered Training'); pg.screenshot(path=str(out / f'{tag}_00_offer.png'))
    pg.click('[data-act=tutGo]'); pg.wait_for_timeout(900)
    check(pg.evaluate('() => !!(G && G.tut)'), f'{tag}: Training run started')
    pg.wait_for_timeout(200); 
    steps = pg.evaluate('() => UI.coach.steps("basic")')
    seen = drive(pg, tag, tag, '() => !G || G.over', 900)
    nl, tot = pg.evaluate("() => { const t = document.querySelector('#tutlist'); return t ? [+t.dataset.n || 0, +((t.querySelector('.tlh').textContent.match(/\\/(\\d+)/) || [0, 0])[1])] : [0, 0]; }")
    pg.wait_for_timeout(1400)
    check(tot >= 11 and nl == tot, f'{tag}: checklist ticked {nl}/{tot} by the end')
    optional = {'arrow', 'up2', 'up2Done', 'tapLv3', 'toLv3', 'spec', 'ascend', 'sell', 'recharge', 'free', 'mark', 'inspect', 'inspected'}
    missing = [s for s in steps if s not in seen and s not in optional]
    check(not missing, f'{tag}: steps never shown: {missing}')
    print(tag, 'basic steps', len(seen), 'skipped optional:', [s for s in steps if s not in seen and s in optional], flush=True)
    check(pg.evaluate('() => UI.modalOpen') == 'over' and pg.evaluate("() => !!document.querySelector('.card.tutdone')"), f'{tag}: Training Complete card')
    pg.screenshot(path=str(out / f'{tag}_99_done.png'))
    P = pg.evaluate('() => ({ tut: PROF.tut, xp: PROF.xp, want: xpForLevel(0) + xpForLevel(1), runs: PROF.runs, best: PROF.bestWave, snap: !!PROF.runSnap, hall: (PROF.hall || []).length, lvl: profLevel().level })')
    check(P['tut'].get('done') == 1 and P['tut'].get('paid') == 1, f'{tag}: completion saved {P["tut"]}')
    check(P['xp'] == P['want'] and P['lvl'] == 2, f'{tag}: reward paid once {P["xp"]}')
    check(P['runs'] == 0 and P['best'] == 0 and not P['snap'] and P['hall'] == 0, f'{tag}: Training left records alone {P}')
    saved = pg.evaluate("() => JSON.parse(localStorage.getItem('entropy.save.v1')).tut")
    check(saved and saved.get('done') == 1, f'{tag}: completion in localStorage')
    pg.click('[data-act=again]'); pg.wait_for_timeout(300)
    check(pg.evaluate('() => UI.modalOpen') == 'setup' and not pg.evaluate('() => document.body.classList.contains("tut")'), f'{tag}: First Run opens the New Run screen')
def lessons(pg, tag):
    fresh(pg, 'PROF.tut = { seen: 1, done: 1, paid: 1 }; PROF.runs = 3;')
    ids = pg.evaluate('() => lessonsOpen().map(L => L.id)')
    for lid in ids:
        if only and lid not in only: continue
        pg.evaluate('() => { if (UI.modalOpen) document.querySelector("#modal").hidden = true; }')
        fresh(pg, 'PROF.tut = { seen: 1, done: 1, paid: 1 }; PROF.runs = 3;')
        pg.click('#bHelp'); pg.wait_for_timeout(250)
        pg.click(f'[data-act=lpage][data-v={lid}]'); pg.wait_for_timeout(200)
        pg.click('[data-act=lesson]'); pg.wait_for_timeout(900)
        check(pg.evaluate('() => UI.coach.on && UI.coach.plan') == lid, f'{tag}: lesson {lid} started')
        steps = pg.evaluate(f'() => UI.coach.steps("{lid}")')
        seen = drive(pg, f'{tag} {lid}', f'{tag}_L_{lid}', f'() => !UI.coach.on && UI.modalOpen === "manual"', 300)
        done = pg.evaluate(f'() => !!(PROF.tut.lessons && PROF.tut.lessons["{lid}"])')
        check(done, f'{tag}: lesson {lid} completed')
        miss = [s for s in steps if s not in seen]
        print(tag, lid, 'steps', len(seen), '/', len(steps), 'not shown:', miss, flush=True)
        if lid == ids[0]: pg.screenshot(path=str(out / f'{tag}_L_done.png'))
    fresh(pg, 'PROF.tut = { seen: 1, done: 1, paid: 1, lessons: { towers: 1 } };'); pg.click('#bHelp'); pg.wait_for_timeout(250)
    check('%' in pg.evaluate("() => document.querySelector('#modal .ch .note').textContent"), f'{tag}: manual shows % complete')
    pg.screenshot(path=str(out / f'{tag}_manual.png'))
def misc(pg, tag):
    # the Tutorial button is always on the main menu (any profile) and opens the chooser; the pause menu has it too
    fresh(pg, 'PROF.tut = { seen: 1, done: 1, paid: 1 }; PROF.runs = 9; PROF.bestWave = 40;')
    check(pg.evaluate("() => { const b = document.querySelector('#bTutH'); return !!b && b.offsetParent !== null; }"), f'{tag}: Tutorial button on the main menu')
    pg.screenshot(path=str(out / f'{tag}_hangar_tutorial.png'))
    pg.click('#bTutH'); pg.wait_for_timeout(250)
    check(pg.evaluate("() => UI.modalOpen === 'tutpick' && !!document.querySelector('#modal [data-act=tutStart]') && !!document.querySelector('#modal [data-act=manual]')"), f'{tag}: Tutorial opens Basic Training / Field Manual')
    pg.screenshot(path=str(out / f'{tag}_tutorial_pick.png'))
    pg.click('#modal [data-act=tutStart]'); pg.wait_for_timeout(900)
    check(pg.evaluate("() => !!(G && G.tut && !G.lesson && UI.coach.on)"), f'{tag}: Basic Training starts from the chooser')
    pg.evaluate("() => { UI.coach.stop(); G = null; UI.show('hangar'); }"); pg.wait_for_timeout(200)
    pg.evaluate("() => { document.querySelector('#bLaunch').click(); }"); pg.wait_for_timeout(250); pg.evaluate("() => document.querySelector('[data-act=launch]').click()"); pg.wait_for_timeout(900)
    pg.evaluate("() => document.querySelector('#bPause').click()"); pg.wait_for_timeout(250)
    check(pg.evaluate("() => !!document.querySelector('#modal [data-act=tutPick]')"), f'{tag}: Tutorial in the pause menu')
    pg.click('#modal [data-act=tutPick]'); pg.wait_for_timeout(200); pg.click('#modal [data-act=tutStart]'); pg.wait_for_timeout(900)
    check(pg.evaluate("() => !!(G && G.tut && PROF.runSnap)"), f'{tag}: Tutorial from the pause menu saves the run first')
    pg.evaluate("() => { UI.coach.stop(); G = null; UI.show('hangar'); }")
    # skip: two taps on the card, back to the New Run screen, nothing saved as done
    fresh(pg); pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=tutGo]'); pg.wait_for_timeout(900)
    pg.click('#coach .cskip'); pg.wait_for_timeout(150)
    check(pg.evaluate('() => !!(G && G.tut)'), f'{tag}: one tap on Skip does not skip')
    pg.click('#coach .cskip'); pg.wait_for_timeout(400)
    check(pg.evaluate('() => !G && UI.modalOpen === "setup"'), f'{tag}: Skip ends Training at the New Run screen')
    T = pg.evaluate('() => PROF.tut'); check(T.get('seen') == 1 and not T.get('done'), f'{tag}: skip saved as seen, not done {T}')
    pg.evaluate('() => document.querySelector("[data-act=close]").click()'); pg.wait_for_timeout(200)
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    check(pg.evaluate('() => UI.modalOpen') == 'setup', f'{tag}: no second prompt after Skip')
    # an old profile (runs played, no tut field) is never prompted, and counts as done
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    pg.evaluate("() => { localStorage.setItem('entropy.save.v1', JSON.stringify({ runs: 14, bestWave: 33, xp: 90000, seenVer: VERSION, seenSys: { storm: 1 } })); PROF = Save.loadLocal(); UI.renderHangar(); }")
    T = pg.evaluate('() => PROF.tut'); check(T.get('done') == 1, f'{tag}: old profile migrated as done {T}')
    check(pg.evaluate('() => !!(PROF.seenSys.upg && PROF.seenSys.market)'), f'{tag}: veteran profile skips the new intro cards')
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    check(pg.evaluate('() => UI.modalOpen') == 'setup', f'{tag}: old profile goes straight to New Run')
    check(pg.evaluate("() => !!document.querySelector('#modal [data-act=tutStart]')"), f'{tag}: Training button on the New Run screen')
    # a real run's intro card has Learn more, which opens the lesson page; Play lesson saves the run first
    pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); pg.wait_for_timeout(900)
    pg.evaluate("() => { PROF.seenSys = { v58: 1, frontier: 1 }; G.wave = 3; G.credits = 5000; const T = G.map.lanes[0].tiles, t = T[Math.floor(T.length / 2)]; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if (window.act('build', 'pulse', t.x + dx, t.y + dy)) break; UI.closePanel(); G.credits = 5000; }")
    pg.wait_for_timeout(700)
    check(pg.evaluate("() => UI.modalOpen === 'brief' && !!document.querySelector('#modal [data-act=lpage][data-v=upgrades]')"), f'{tag}: first affordable upgrade shows the Upgrades card with Learn more')
    pg.screenshot(path=str(out / f'{tag}_intro_upg.png'))
    pg.click('#modal [data-act=lpage]'); pg.wait_for_timeout(250)
    check(pg.evaluate("() => UI.modalOpen === 'manual'"), f'{tag}: Learn more opens the lesson page')
    pg.click('#modal [data-act=lesson]'); pg.wait_for_timeout(900)
    check(pg.evaluate("() => !!(G && G.lesson === 'upgrades' && PROF.runSnap)"), f'{tag}: lesson from a run keeps the run saved')
with sync_playwright() as p:
    b = p.chromium.launch()
    for (W, H) in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        if what in ('all', 'basic'): basic(pg, tag)
        if what in ('all', 'lessons'): lessons(pg, tag)
        if what in ('all', 'misc', 'basic'): misc(pg, tag)
        pg.close()
    b.close()
print('FAILED:', fails)
print('ERRORS:', errs[:5])
