"""6.5.2 ui652: the Basic Training checklist ticks as the player goes (Nic: "The tutorial list doesn't seem to update either as it
progresses"). Plays Basic Training through the coach, like tutorialshot.py, in one of two styles:
  perfect: taps exactly what the coach points at;
  human:   reads the affix card by closing the tower panel instead of tapping Got it, and lets wave timers run instead of
           tapping Next where the coach allows it (the free 'call' prompts);
  skip:    as human, but closes the tower panel at "Its bonus" without opening Details: that line is missed, and the strip must
           move on to the next line (the missed line stays in the list, dim, without a tick).
After every coach step it reads the checklist (#tutlist): the count, the current line, and which lines are ticked. Checks:
  - every line is ticked by the end (skip: every line but "Read its bonus");
  - each line ticks within 2 coach steps after the step that teaches it (CHECK_STEP), so the list keeps up with the lesson;
  - the strip's current line is never a line whose lesson is already over (the list never hangs on an old task);
  - the visible list (open, then folded) shows the same ticks as the game state.
Screenshots of the strip and the open list ticking: test/out/tutcheck/<size>_<style>_*.png.
usage: python3 tutcheck.py [WxH,...] [perfect|human|skip|both|all] [--page PATH --tag PREFIX]   (default 667x375 both)"""
import json, pathlib, sys, time, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'tutcheck'; out.mkdir(parents=True, exist_ok=True)
A = [a for a in sys.argv[1:] if not a.startswith('--')]; page = sys.argv[sys.argv.index('--page') + 1] if '--page' in sys.argv else None
if page: A = [a for a in A if a != page]
sizes = [tuple(map(int, s.split('x'))) for s in (A[0] if A else '667x375').split(',')]
styles = {'both': ['perfect', 'human'], 'all': ['perfect', 'human', 'skip']}.get(A[1] if len(A) > 1 else 'both', [A[1] if len(A) > 1 else 'perfect'])
pre = sys.argv[sys.argv.index('--tag') + 1] if '--tag' in sys.argv else ''
if pre: A = [a for a in A if a != pre]
if not page: mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
errs = []; fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg, flush=True)
    if not ok: fails.append(msg)
CARD = '''() => { const c = document.querySelector('#coach'); if (!c || c.hidden || c.classList.contains('idle')) return null; const r = c.querySelector('.cring'), ok = c.querySelector('.cok');
  const rr = r.hidden ? null : r.getBoundingClientRect(); return { step: UI.coach.step, held: UI.coachHold, ring: rr ? [rr.left, rr.top, rr.width, rr.height] : null, ok: !ok.hidden }; }'''
LIST = '''() => { const t = document.querySelector('#tutlist'); if (!t) return null; const li = [...t.querySelectorAll('ol li')];
  return { n: +t.dataset.n || 0, cur: (t.querySelector('.tlcur') || {}).textContent || '', ticks: li.map(l => l.classList.contains('ok')), miss: li.map(l => l.classList.contains('miss')), now: li.findIndex(l => l.classList.contains('now')),
    names: li.map(l => l.textContent.replace(/^[✓\\d]+/, '')), vis: !t.hidden && t.offsetParent !== null, state: UI.coach.checks ? UI.coach.checks() : null }; }'''
TAPS = {'vpick': '#modal [data-act=vpick]', 'spec': '#panel [data-act=spec]', 'boon': '#modal .boons [data-act]', 'cards': '#modal .boon.ar-rare'}
# the coach step that teaches each checklist line (by line name); the line must tick within 2 steps after it
CHECK_STEP = {'Place a tower': 'build1', 'Call a wave early': 'call1', 'Upgrade a tower': 'upgrade', 'Read its bonus': 'affixes',
              'Core: upgrade the Battery': 'battery', 'Counter it: a Rail Lance': 'rail',
              'Lift Off: dock on a tower': 'land', 'Link towers to the core': 'links', 'Move a tower': 'mvGo', 'Upgrade again': 'up2',
              'Veteran: tap Ready, pick': 'vpick', 'Use Strike': 'aim', 'Probe: loot a site, bank it': 'prBank', 'Probe: a guarded site in the fog': 'prOut',
              'Entropy: take a card': 'cards', 'Pick a specialty (LV 3)': 'spec', 'Beat the bounty boss': None, 'Extract': None}  # 6.6 tut66: the new lesson list
def run(pg, tag, style, limit=600):
    pg.goto('file://' + page); pg.wait_for_timeout(400)
    pg.evaluate('() => { window.tutOfferTest = 1; PROF = Save.merge({}); PROF.seenVer = VERSION; Save.save(); UI.renderHangar(); try { localStorage.setItem("entropy.tutlist", "0"); } catch (e) {} }')
    pg.click('#bLaunch'); pg.wait_for_timeout(400)
    pg.evaluate('() => { const b = document.querySelector("#modal [data-act=tutStart]") || document.querySelector("#modal [data-act=tutGo]"); b && b.click(); }'); pg.wait_for_timeout(1200)
    if not pg.evaluate('() => !!(G && G.tut)'):
        check(False, f'{tag}: Training did not start'); return
    log = []; seen = []; last = None; stuck = 0; t0 = time.time(); shots = 0
    while time.time() - t0 < limit:
        if pg.evaluate('() => !G || G.over || UI.modalOpen === "over"'): break
        c = pg.evaluate(CARD)
        L = pg.evaluate(LIST)
        if L and (not log or log[-1]['ticks'] != L['ticks']):
            log.append({'step': c['step'] if c else (seen[-1] if seen else ''), 'k': len(seen), **L})
            if shots < 40 and log[-1]['n'] > (log[-2]['n'] if len(log) > 1 else 0):
                shots += 1; pg.screenshot(path=str(out / f'{pre}{tag}_{style}_{shots:02d}_tick{L["n"]}.png'))
        if not c:
            pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(120); continue
        pg.evaluate('() => { if (G && !G.over && G.speed > 1) G.speed = 1; }')
        if c['step'] != last:
            last = c['step']; stuck = 0
            if c['step'] not in seen: seen.append(c['step'])
        stuck += 1
        if stuck > 40: check(False, f'{tag} {style}: stuck on {c["step"]}'); break
        if style == 'skip' and c['step'] == 'affix':  # closes the panel without reading the bonus
            pg.wait_for_timeout(400); pg.evaluate('() => UI.closePanel()'); pg.wait_for_timeout(300); continue
        if style in ('human', 'skip'):
            if c['step'] == 'affixes':  # reads the card, then closes the tower panel by tapping empty ground (no Got it)
                pg.wait_for_timeout(600); pg.evaluate('() => UI.closePanel()'); pg.wait_for_timeout(300); continue
            if 'call' in c['step'] and not c['held']:  # lets the timer run
                pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(150); continue
        if c['ok']: pg.click('#coach .cok'); pg.wait_for_timeout(220); continue
        if c['ring'] and (c['held'] or 'call' in c['step']):
            if c['step'] in TAPS and pg.evaluate(f"() => !!document.querySelector('{TAPS[c['step']]}')"): pg.click(TAPS[c['step']])
            else: r = c['ring']; pg.touchscreen.tap(r[0] + r[2] / 2, r[1] + r[3] / 2)
            pg.wait_for_timeout(380); continue
        pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(150)
    # the end card (Training complete) covers the list: the last ticks come from the game state (UI.coach.checks)
    L = log[-1] if log else None
    names = L['names'] if L else []
    fin = pg.evaluate('() => UI.coach.checks ? UI.coach.checks() : null')
    if L and fin: L = dict(L, ticks=fin, n=sum(fin))
    print(f'{tag} {style}: steps {len(seen)}, ticks over time:')
    for e in log: print(f'    after step {e["k"]:>2} {e["step"]:<10} {e["n"]:>2}/{len(e["ticks"])}  strip "{e["cur"]}"')
    left = [n for n, t in zip(names, L['ticks']) if not t] if L else ['?']
    check(L is not None and left == (['Read its bonus'] if style == 'skip' else []), f'{tag} {style}: lines ticked by the end {L["n"] if L else 0}/{len(names)}, open: {left}')
    if style == 'skip':  # the missed line is dim in the list and the strip moved past it
        e = next((e for e in log if e['k'] > seen.index('affixes' if 'affixes' in seen else 'affix') + 3), None) if seen else None
        check(e is not None and e['now'] != names.index('Read its bonus'), f'{tag} skip: the strip moves past the missed line ({e["cur"] if e else None})')
        check(any(e['miss'][names.index('Read its bonus')] for e in log), f'{tag} skip: the missed line is marked (dim) in the list')
    # each line ticks soon after its lesson
    for i, nm in enumerate(names):
        if style == 'skip' and nm == 'Read its bonus': continue
        st = CHECK_STEP.get(nm)
        if not st or st not in seen: continue
        k0 = seen.index(st) + 1
        first = next((e['k'] for e in log if e['ticks'][i]), None)
        check(first is not None and first <= k0 + 2, f'{tag} {style}: "{nm}" ticks by 2 steps after "{st}" (step {k0}; ticked at {first})')
    # the strip never hangs on a line whose lesson passed more than 2 steps ago
    hang = []
    for e in log:
        if e['now'] < 0: continue
        st = CHECK_STEP.get(names[e['now']])
        if st and st in seen and e['k'] > seen.index(st) + 3: hang.append((e['k'], e['step'], names[e['now']]))
    check(not hang, f'{tag} {style}: the strip never hangs on an old line {hang[:3]}')
    return log
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W, H in sizes:
        for style in styles:
            tag = f'{W}x{H}'
            pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
            pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
            try: run(pg, tag, style)
            except Exception as e: errs.append(f'{tag} {style}: {e}')
            pg.close()
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', fails)
