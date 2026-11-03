"""5.8 Training: plays Basic Training end to end by tapping what the coach points at (852x393, 667x375, 1180x820), checks every
step appears and advances, the reward and PROF.tut are saved, Skip works, old profiles are not prompted, no page errors.
usage: python3 tutorialshot.py [WxH,...]   screenshots: test/out/tut/<size>_<nn>_<step>.png"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'tut'; out.mkdir(parents=True, exist_ok=True)
sizes = [tuple(map(int, s.split('x'))) for s in (sys.argv[1] if len(sys.argv) > 1 else '852x393,667x375,1180x820').split(',')]
mkpage.mk(); errs = []; fails = []
def check(ok, msg):
    if not ok: fails.append(msg); print('FAIL', msg)
CARD = '''() => { const c = document.querySelector('#coach'); if (!c || c.hidden) return null; const k = c.querySelector('.ccard').getBoundingClientRect(), r = c.querySelector('.cring');
  const rr = r.hidden ? null : r.getBoundingClientRect(), ok = c.querySelector('.cok');
  return { step: UI.coach.step, card: [k.left, k.top, k.width, k.height], ring: rr ? [rr.left, rr.top, rr.width, rr.height] : null, ok: !ok.hidden, title: c.querySelector('.ct').textContent, body: c.querySelector('.cb').textContent, vw: innerWidth, vh: innerHeight }; }'''
def fresh(pg, extra=''):
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF = Save.merge({}); PROF.seenVer = VERSION; ' + extra + ' Save.save(); UI.renderHangar(); }')
def play(pg, tag, W, H):
    fresh(pg)
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    check(pg.evaluate('() => UI.modalOpen') == 'tutoffer', f'{tag}: fresh profile is offered Training'); pg.screenshot(path=str(out / f'{tag}_00_offer.png'))
    pg.click('[data-act=tutGo]'); pg.wait_for_timeout(900)
    check(pg.evaluate('() => !!(G && G.tut)'), f'{tag}: Training run started')
    steps = pg.evaluate('() => UI.coach.steps()'); seen = []; n = 0; last = None; stuck = 0
    for guard in range(4000):
        if pg.evaluate('() => !G || G.over'): break
        c = pg.evaluate(CARD)
        if not c: pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(120); continue
        pg.evaluate('() => { if (G && !G.over && G.speed > 1) G.speed = 1; }')
        if c['step'] != last:
            last = c['step']; stuck = 0
            if c['step'] not in seen: seen.append(c['step']); n += 1; pg.wait_for_timeout(120); pg.screenshot(path=str(out / f'{tag}_{n:02d}_{c["step"]}.png'))
            k = c['card']; check(k[0] >= -1 and k[1] >= -1 and k[0] + k[2] <= c['vw'] + 1 and k[1] + k[3] <= c['vh'] + 1, f'{tag}: {c["step"]} card on screen {k}')
            if c['ring']:
                r = c['ring']; ox = max(0, min(k[0] + k[2], r[0] + r[2]) - max(k[0], r[0])); oy = max(0, min(k[1] + k[3], r[1] + r[3]) - max(k[1], r[1]))
                check(ox * oy < 1, f'{tag}: {c["step"]} card covers its target')
        stuck += 1
        if c['ok']: pg.click('#coach .cok'); pg.wait_for_timeout(200); continue
        held = pg.evaluate('() => UI.coachHold')
        if c['ring'] and held:
            r = c['ring']; pg.touchscreen.tap(r[0] + r[2] / 2, r[1] + r[3] / 2); pg.wait_for_timeout(350)
            if stuck > 12: check(False, f'{tag}: stuck on {c["step"]}'); break
            continue
        if c['ring'] and c['step'].startswith('call'): pg.touchscreen.tap(c['ring'][0] + c['ring'][2] / 2, c['ring'][1] + c['ring'][3] / 2); pg.wait_for_timeout(300); continue
        pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(150)
    pg.wait_for_timeout(1400)
    missing = [s for s in steps if s not in seen]
    check(not missing, f'{tag}: steps never shown: {missing}')
    check(pg.evaluate('() => UI.modalOpen') == 'over' and pg.evaluate("() => !!document.querySelector('.card.tutdone')"), f'{tag}: Training Complete card')
    pg.screenshot(path=str(out / f'{tag}_99_done.png'))
    P = pg.evaluate('() => ({ tut: PROF.tut, xp: PROF.xp, runs: PROF.runs, best: PROF.bestWave, snap: !!PROF.runSnap, hall: (PROF.hall || []).length, lvl: profLevel().level })')
    check(P['tut'].get('done') == 1 and P['tut'].get('paid') == 1, f'{tag}: completion saved {P["tut"]}')
    check(P['xp'] == 800 and P['lvl'] == 1, f'{tag}: reward paid once {P["xp"]}')
    check(P['runs'] == 0 and P['best'] == 0 and not P['snap'] and P['hall'] == 0, f'{tag}: Training left records alone {P}')
    saved = pg.evaluate("() => JSON.parse(localStorage.getItem('entropy.save.v1')).tut")
    check(saved and saved.get('done') == 1, f'{tag}: completion in localStorage')
    pg.click('[data-act=again]'); pg.wait_for_timeout(300)
    check(pg.evaluate('() => UI.modalOpen') == 'setup' and not pg.evaluate('() => document.body.classList.contains("tut")'), f'{tag}: First Run opens the New Run screen')
    return seen
with sync_playwright() as p:
    b = p.chromium.launch()
    for (W, H) in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        seen = play(pg, tag, W, H)
        print(tag, 'steps:', len(seen))
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
        pg.evaluate("() => { localStorage.setItem('entropy.save.v1', JSON.stringify({ runs: 14, bestWave: 33, xp: 90000, seenVer: VERSION })); PROF = Save.loadLocal(); UI.renderHangar(); }")
        T = pg.evaluate('() => PROF.tut'); check(T.get('done') == 1, f'{tag}: old profile migrated as done {T}')
        pg.click('#bLaunch'); pg.wait_for_timeout(250)
        check(pg.evaluate('() => UI.modalOpen') == 'setup', f'{tag}: old profile goes straight to New Run')
        check(pg.evaluate("() => !!document.querySelector('#modal [data-act=tutStart]')"), f'{tag}: Training button on the New Run screen')
        pg.close()
    b.close()
print('FAILED:', fails)
print('ERRORS:', errs[:5])
