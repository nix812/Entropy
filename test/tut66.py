"""6.6 tut66: plays the whole Basic Training as a scripted new player, at each size, and reports:
  - every coach card (play second, wave, lesson chain, held or not, title, text) and every modal and alert that showed;
  - every checklist line ticks by the end (and the order of the list matches the lesson order);
  - the gap in play seconds between lessons (a new chain of coach cards) and between all dialogs (held cards + modals):
    min and median; how many lessons started less than 15 s of play after the last one;
  - total play time, and an estimated wall time at 1x for a new player who reads each held card for READ seconds;
  - a screenshot of the first card of every lesson (test/out/tut66/<size>_<nn>_<lesson>.png).
The new player taps what the coach points at, taps Got it / Next on read cards, and otherwise lets the game run (the test
fast-forwards play while no card shows; play seconds are G.time, so the numbers are the same as at 1x).
usage: python3 tut66.py [WxH,...] [--audit] [--tag T]   (default 667x375,1180x820; --audit: log only, no pass/fail on the 6.6 targets)
Writes test/out/tut66/<tag><size>.json."""
import json, pathlib, statistics, sys, time, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'tut66'; out.mkdir(parents=True, exist_ok=True)
A = [a for a in sys.argv[1:] if not a.startswith('--')]
audit = '--audit' in sys.argv
tag = sys.argv[sys.argv.index('--tag') + 1] if '--tag' in sys.argv else ''
if tag: A = [a for a in A if a != tag]
sizes = [tuple(map(int, s.split('x'))) for s in (A[0] if A else '667x375,1180x820').split(',')]
READ = 4.0  # seconds a new player spends on a held card or a modal
mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
errs = []; fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg, flush=True)
    if not ok and not audit: fails.append(msg)
CARD = '''() => { const c = document.querySelector('#coach'); if (!c || c.hidden || c.classList.contains('idle')) return null; const r = c.querySelector('.cring'), ok = c.querySelector('.cok');
  const rr = r.hidden ? null : r.getBoundingClientRect();
  return { step: UI.coach.step, held: UI.coachHold, ring: rr ? [rr.left, rr.top, rr.width, rr.height] : null, ok: !ok.hidden, title: c.querySelector('.ct').textContent, body: c.querySelector('.cb').textContent,
    t: G ? +G.time.toFixed(1) : 0, w: G ? G.wave : 0, chain: UI.coach.chain || null }; }'''
WATCH = '''() => { window._cad = []; const log = (k, el) => { const s = el.textContent.trim(); if (s && G) window._cad.push({ k, s: s.slice(0, 120), t: +G.time.toFixed(1), w: G.wave }); };
  for (const id of ['ticker', 'tip']) { const el = document.getElementById(id); if (el) new MutationObserver(() => log(id, el)).observe(el, { childList: true, subtree: true, characterData: true }); } }'''
TAPS = {'vpick': '#modal [data-act=vpick]', 'spec': '#panel [data-act=spec]', 'cards': '#modal .boon.ar-rare'}
def run(pg, W, H):
    tg = f'{tag}{W}x{H}'
    pg.goto('file://' + page); pg.wait_for_timeout(400)
    pg.evaluate('() => { window.tutOfferTest = 1; PROF = Save.merge({}); PROF.seenVer = VERSION; Save.save(); UI.renderHangar(); try { localStorage.setItem("entropy.tutlist", "0"); } catch (e) {} }')
    pg.click('#bLaunch'); pg.wait_for_timeout(400)
    pg.evaluate('() => { const b = document.querySelector("#modal [data-act=tutGo]") || document.querySelector("#modal [data-act=tutStart]"); b && b.click(); }'); pg.wait_for_timeout(1200)
    if not pg.evaluate('() => !!(G && G.tut)'):
        check(False, f'{tg}: Training did not start'); return None
    pg.evaluate(WATCH)
    cards = []; modals = []; last = None; lastM = None; stuck = 0; t0 = time.time(); shots = 0; chains = []
    names = pg.evaluate('() => UI.coach.checkNames()')
    tickAt = {}
    while time.time() - t0 < 900:
        st = pg.evaluate('() => ({ over: !G || G.over || UI.modalOpen === "over", m: UI.modalOpen || null, t: G ? +G.time.toFixed(1) : 0, w: G ? G.wave : 0, ck: UI.coach.checks ? UI.coach.checks() : null, step: UI.coach.step })')
        if st['ck']:
            for i, v in enumerate(st['ck']):
                if v and i not in tickAt: tickAt[i] = {'t': st['t'], 'step': st['step'], 'k': len(cards)}
        if st['m'] != lastM:
            lastM = st['m']
            if st['m']: modals.append({'m': st['m'], 't': st['t'], 'w': st['w']})
        if st['over']: break
        c = pg.evaluate(CARD)
        if not c:
            # a modal the coach does not drive (an intro card, the anomaly draw, a boon pick): a new player reads it and picks
            m = st['m']
            if m and m not in ('vets', 'hunt', 'evo'):
                pg.wait_for_timeout(200)
                pg.evaluate('''() => { const b = document.querySelector('#modal [data-act=brief]') || document.querySelector('#modal .boons [data-act]') || document.querySelector('#modal [data-act=anom]') || document.querySelector('#modal [data-act=close2]');
                  b && b.click(); }'''); pg.wait_for_timeout(250); continue
            pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(110); continue
        pg.evaluate('() => { if (G && !G.over && G.speed > 1) G.speed = 1; }')
        if c['step'] != last:
            last = c['step']; stuck = 0
            if not cards or cards[-1]['step'] != c['step']:
                newch = not cards or c['chain'] != cards[-1]['chain']
                c['new'] = newch; cards.append(c)
                if newch:
                    chains.append(c['chain']); shots += 1
                    pg.wait_for_timeout(150)
                    pg.screenshot(path=str(out / f'{tg}_{shots:02d}_{c["chain"] or c["step"]}.png'))
        stuck += 1
        if stuck > 50: check(False, f'{tg}: stuck on {c["step"]}'); break
        if c['ok']: pg.click('#coach .cok'); pg.wait_for_timeout(220); continue
        if c['ring'] and (c['held'] or 'call' in (c['step'] or '')):
            if c['step'] in TAPS and pg.evaluate(f"() => !!document.querySelector('{TAPS[c['step']]}')"): pg.click(TAPS[c['step']])
            else: r = c['ring']; pg.touchscreen.tap(r[0] + r[2] / 2, r[1] + r[3] / 2)
            pg.wait_for_timeout(380); continue
        pg.evaluate('() => { if (G && !G.over) G.speed = 6; }'); pg.wait_for_timeout(130)
    fin = pg.evaluate('() => ({ ck: UI.coach.checks ? UI.coach.checks() : null, t: G ? +G.time.toFixed(1) : 0, ext: !!(G && G.extracted), m: UI.modalOpen, w: G ? G.wave : 0 })')
    if fin['m'] == 'over': pg.screenshot(path=str(out / f'{tg}_{shots + 1:02d}_done.png'))
    msgs = pg.evaluate('() => window._cad || []')
    # ---- report ----
    print(f'\n== {tg}: {len(cards)} coach cards, {len(chains)} lessons, {len(modals)} modals, play {fin["t"]} s, wave {fin["w"]}')
    for c in cards:
        print(f"{c['t']:7.1f}s W{c['w']:<2} {'NEW ' if c['new'] else '    '}{'HOLD' if c['held'] else '    '} {str(c['chain'] or '-'):<9} {c['step'] or '-':<10} {c['title']}: {c['body'][:150]}")
    print('-- modals --')
    for m in modals: print(f"{m['t']:7.1f}s W{m['w']:<2} {m['m']}")
    print('-- alerts and tips --')
    for m in msgs: print(f"{m['t']:7.1f}s W{m['w']:<2} {m['k']:<6} {m['s']}")
    les = [c['t'] for c in cards if c['new']]
    lg = [round(b - a, 1) for a, b in zip(les, les[1:])]
    # a dialog = the first held card of a lesson, or a modal the coach did not open itself (none within 1.5 s of a held card)
    hc = [c['t'] for c in cards if c['held']]
    dl = sorted([c['t'] for c in cards if c['held'] and c['new']] + [m['t'] for m in modals if m['m'] != 'over' and not any(abs(m['t'] - t) <= 1.5 for t in hc)])
    dg = [round(b - a, 1) for a, b in zip(dl, dl[1:])]
    held = sum(1 for c in cards if c['held']) + sum(1 for m in modals if m['m'] not in ('over',))
    wall = fin['t'] + READ * held
    S = {'size': tg, 'cards': len(cards), 'held': held, 'lessons': len(les), 'play_s': fin['t'], 'wall_est_s': round(wall), 'wall_est_min': round(wall / 60, 1),
         'lesson_gap_min': min(lg) if lg else 0, 'lesson_gap_median': statistics.median(lg) if lg else 0, 'lesson_gaps_under15': sum(1 for g in lg if g < 15),
         'dialog_gap_min': min(dg) if dg else 0, 'dialog_gap_median': statistics.median(dg) if dg else 0,
         'chains': chains, 'ticked': sum(fin['ck'] or []), 'lines': len(names), 'extracted': fin['ext']}
    print('SUMMARY', json.dumps(S))
    left = [n for n, v in zip(names, fin['ck'] or []) if not v]
    check(fin['ext'], f'{tg}: Training finished (extracted)')
    check(not left, f'{tg}: every checklist line ticked ({S["ticked"]}/{len(names)}), open: {left}')
    order = [tickAt[i]['t'] if i in tickAt else 1e9 for i in range(len(names))]
    late = [names[i] for i in range(1, len(names)) if order[i] + 0.05 < max(order[:i]) - 30]
    check(not late, f'{tg}: lines tick in list order (none more than 30 s before an earlier line): {late}')
    if not audit:
        check(8 * 60 <= wall <= 12.5 * 60, f'{tg}: estimated length {S["wall_est_min"]} min (target 8-12)')
        check(S['lesson_gap_min'] >= 8, f'{tg}: shortest gap between lessons {S["lesson_gap_min"]} s (>= 8)')
        check(S['lesson_gap_median'] >= 18, f'{tg}: median gap between lessons {S["lesson_gap_median"]} s (>= 18)')
    (out / f'{tg}.json').write_text(json.dumps({'summary': S, 'cards': cards, 'modals': modals, 'msgs': msgs, 'ticks': {names[i]: tickAt.get(i) for i in range(len(names))}}, indent=1))
    return S
res = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W, H in sizes:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1, has_touch=True)
        pg.on('pageerror', lambda e, W=W: errs.append(f'{W}: {e}'))
        try: res.append(run(pg, W, H))
        except Exception as e: errs.append(f'{W}x{H}: {e}')
        pg.close()
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', fails)
