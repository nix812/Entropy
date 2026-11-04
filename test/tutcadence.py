"""6.2 tutorial pacing: plays Basic Training with the coach bot and logs when each new coach card appears, in seconds of play
(G.time, which only runs while the game runs: reading a held card costs no play time) and in wall seconds at 1x with a
simulated 3 s read per card. Also logs alerts and tips that show during Training (ticker and tip line).
Prints one line per card, then a summary: cards, median and minimum play seconds between cards, how many came less than
5 s and less than 15 s of play after the previous one (chain steps excluded and included), and the longest silence.
usage: python3 tutcadence.py [WxH] [tag]   (writes test/out/tutcadence_<tag>.json)"""
import json, pathlib, statistics, sys, time, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
W, H = map(int, (sys.argv[1] if len(sys.argv) > 1 else '852x393').split('x'))
tag = sys.argv[2] if len(sys.argv) > 2 else 'now'
READ = 3.0  # seconds a player spends on a card
mkpage.mk()
CARD = '''() => { const c = document.querySelector('#coach'); if (!c || c.hidden || c.classList.contains('idle')) return null; const r = c.querySelector('.cring'), k = c.querySelector('.ccard').getBoundingClientRect();
  const rr = r.hidden ? null : r.getBoundingClientRect(), ok = c.querySelector('.cok');
  return { step: UI.coach.step, held: UI.coachHold, ring: rr ? [rr.left, rr.top, rr.width, rr.height] : null, ok: !ok.hidden, title: c.querySelector('.ct').textContent,
    t: G ? +G.time.toFixed(1) : 0, w: G ? G.wave : 0, chain: UI.coach.chain ? UI.coach.chain : null }; }'''
TAPS = { 'vpick': '#modal [data-act=vpick]', 'spec': '#panel [data-act=spec]' }
WATCH = '''() => { window._cad = []; const log = (k, el) => { const s = el.textContent.trim(); if (s && G) window._cad.push({ k, s: s.slice(0, 80), t: +G.time.toFixed(1), w: G.wave }); };
  for (const id of ['ticker', 'tip']) { const el = document.getElementById(id); if (el) new MutationObserver(() => log(id, el)).observe(el, { childList: true, subtree: true, characterData: true }); } }'''
cards = []; errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { window.tutOfferTest = 1; PROF = Save.merge({}); PROF.seenVer = VERSION; Save.save(); UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=tutGo]'); pg.wait_for_timeout(900)
    pg.evaluate(WATCH)
    last = None; stuck = 0; t0 = time.time()
    while time.time() - t0 < 900:
        if pg.evaluate('() => !G || G.over'): break
        c = pg.evaluate(CARD)
        if not c:
            pg.evaluate('() => { if (G && !G.over) G.speed = 3; }'); pg.wait_for_timeout(100); continue
        pg.evaluate('() => { if (G && !G.over) G.speed = 1; }')
        if c['step'] != last:
            last = c['step']; stuck = 0
            if not cards or cards[-1]['step'] != c['step']: cards.append(c)
        stuck += 1
        if stuck > 60: print('stuck on', c['step']); break
        if c['ok']: pg.click('#coach .cok'); pg.wait_for_timeout(200); continue
        if c['ring'] and (c['held'] or c['step'].startswith('call')):
            if c['step'] in TAPS and pg.evaluate(f"() => !!document.querySelector('{TAPS[c['step']]}')"): pg.click(TAPS[c['step']])
            else: r = c['ring']; pg.touchscreen.tap(r[0] + r[2] / 2, r[1] + r[3] / 2)
            pg.wait_for_timeout(350); continue
        pg.evaluate('() => { if (G && !G.over) G.speed = 3; }'); pg.wait_for_timeout(120)
    msgs = pg.evaluate('() => window._cad || []')
    end = pg.evaluate('() => G ? +G.time.toFixed(1) : 0')
    b.close()
# play seconds between cards; the wall clock adds READ seconds per held card
wall = 0; prev = None; gaps = []; rows = []
for c in cards:
    g = None if prev is None else round(c['t'] - prev['t'], 1)
    same = prev is not None and c.get('chain') and c.get('chain') == prev.get('chain')
    if g is not None: gaps.append((g, same))
    wall += (g or 0) + (READ if c['held'] else 0)
    rows.append(dict(c, gap=g, wall=round(wall, 1), same=bool(same)))
    print(f"{c['t']:7.1f}s  W{c['w']:<2} +{(g if g is not None else 0):5.1f}s {'chain' if same else '     '} {'HOLD' if c['held'] else '    '} {c['step']:<10} {c['title']}")
    prev = c
print('--- alerts and tips during Training ---')
for m in msgs: print(f"{m['t']:7.1f}s  W{m['w']:<2} {m['k']:<6} {m['s']}")
allg = [g for g, s in gaps]; newg = [g for g, s in gaps if not s]
summ = { 'cards': len(cards), 'play_s': end, 'median_gap': statistics.median(allg) if allg else 0, 'min_gap_new': min(newg) if newg else 0,
         'under5': sum(1 for g in allg if g < 5), 'under15_new': sum(1 for g in newg if g < 15), 'new_lessons': len(newg) + 1,
         'median_gap_new': statistics.median(newg) if newg else 0, 'longest': max(allg) if allg else 0, 'wall_1x_est': round(wall + max(0, end - (cards[-1]['t'] if cards else 0)), 1) }
print('SUMMARY', json.dumps(summ))
print('ERRORS:', errs[:5])
(root / 'test' / 'out' / f'tutcadence_{tag}.json').write_text(json.dumps({ 'summary': summ, 'cards': rows, 'msgs': msgs }, indent=1))
