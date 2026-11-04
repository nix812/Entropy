"""6.4 cards64 screenshots and checks: the Anomaly draw modal with generated cards (rarity tag and colour, up and down lines with
numbers) and a Classic card, taking a generated card through the button (toast, gauge count, Pause list), and the Archive codex
line. Screens: test/out/c64_*.png. usage: python3 cards64shot.py [W H tag]"""
import sys, pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out'; mkpage.mk()
SIZES = [(int(sys.argv[1]), int(sys.argv[2]), sys.argv[3])] if len(sys.argv) > 3 else [(667, 375, 'p'), (1180, 820, 'i')]
errs, fails = [], []
def check(c, msg, tag): print(('ok   ' if c else 'FAIL ') + f'[{tag}] {msg}', flush=True); (None if c else fails.append(f'{tag}: {msg}'))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W, H, tag in SIZES:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
        pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.settings.briefings = "off"; PROF.bestWave = 60; PROF.xp = 900000; PROF.runs = 5; PROF.seenSys = Object.assign(PROF.seenSys || {}, { frontier: 1, vet: 1, support: 1, upg: 1, power: 1, anomaly: 1 }); }')
        pg.mouse.click(10, 10); pg.click('#bLaunch'); pg.wait_for_timeout(300); pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); pg.wait_for_timeout(1500)
        pg.evaluate('() => { document.querySelectorAll("[data-act=brief]").forEach(b => b.click()); if (UI.closeModal) UI._dbg.closeModal(); G.credits = 1e7; G.gridBonus = 60; G.core.hp = G.core.max = 1e9; }')
        check(pg.evaluate('G.frV') >= 4, f'the run plays on frV {pg.evaluate("G.frV")}', tag)
        # a few towers so the offers lean toward a build, then draws until an offer holds a Classic and a Rare or Exotic card
        pg.evaluate('''() => { const L = G.map.lanes[0].tiles; let n = 0; for (const p of L) for (const [dx, dy] of [[1, 1], [-1, -1]]) { if (n >= 6) break; if (canBuildAt(p.x + dx, p.y + dy) && window.act('build', ['pulse', 'rail', 'cryo'][n % 3], p.x + dx, p.y + dy)) n++; } }''')
        got = pg.evaluate('''() => { for (let i = 0; i < 60; i++) { G.wave = 12 + i; G.entropy = 100; G.anomOffers = null; addEntropy(0); const O = G.anomOffers;
            if (O.some(o => typeof o === 'string') && O.some(o => o && o.r >= 1) && O.filter(o => typeof o === 'object').length >= 2) return O.map(o => anomInfo(o).label); } return null; }''')
        check(got is not None, f'an offer with a Classic and a Rare or Exotic card: {got}', tag)
        pg.click('#bEnt'); pg.wait_for_timeout(500)
        cards = pg.evaluate('''() => [...document.querySelectorAll('#modal [data-act=anom]')].map(b => ({ tag: b.querySelector('.arar').textContent, name: b.querySelector('b').textContent,
            col: getComputedStyle(b.querySelector('b')).color, good: b.querySelectorAll('.good').length, bad: b.querySelectorAll('.bad').length, txt: b.innerText, r: b.getBoundingClientRect().toJSON() }))''')
        check(len(cards) == 3 and all(c['good'] >= 1 and c['bad'] >= 1 for c in cards), f'3 cards, each with up and down lines: {[c["tag"] + " " + c["name"] for c in cards]}', tag)
        check(len(set(c['col'] for c in cards)) >= 2, f'rarity colours differ ({sorted(set(c["col"] for c in cards))})', tag)
        import re
        check(all(re.search(r'\d', c['txt']) for c in cards if c['tag'] != 'Classic'), 'every generated card shows numbers', tag)
        # nothing clipped: every card inside the viewport and the modal
        box = pg.evaluate('() => document.querySelector("#modal .card").getBoundingClientRect().toJSON()')
        inside = all(c['r']['left'] >= box['left'] - 1 and c['r']['right'] <= box['right'] + 1 and c['r']['bottom'] <= H + 1 for c in cards)
        over = pg.evaluate('() => [...document.querySelectorAll("#modal .boon")].filter(b => b.scrollWidth > b.clientWidth + 1).length')
        check(inside and over == 0, f'cards fit the modal and screen (overflow {over})', tag)
        pg.screenshot(path=str(out / f'c64_draw_{tag}.png'))
        # take the first generated card by tapping it
        gi = next(i for i, c in enumerate(cards) if c['tag'] != 'Classic'); name = cards[gi]['name']
        pg.evaluate(f'() => document.querySelectorAll("#modal [data-act=anom]")[{gi}].click()'); pg.wait_for_timeout(400)
        st = pg.evaluate('() => [G.anomOffers, G.ganoms.length, G.ganoms.map(a => a.name), document.querySelector("#entCount").textContent, G.inputs.filter(x => x[1] === "anom").length]')
        check(st[0] is None and st[1] == 1 and st[2][0].lower() == name.lower() and st[3] == '×1' and st[4] == 1, f'tapping it takes {st[2]} through act() (gauge {st[3]})', tag)
        # a second draw to show more generated cards, then the Pause list with both
        pg.evaluate('''() => { for (let i = 0; i < 40; i++) { G.entropy = 100; G.anomOffers = null; addEntropy(0); const c = G.anomOffers.find(o => typeof o === 'string'); if (c) { window.act('anom', c); break; } } for (let i = 0; i < 80; i++) { G.entropy = 100; G.anomOffers = null; addEntropy(0); if (G.anomOffers.some(o => o && o.r === 2)) break; } }''')
        pg.click('#bEnt'); pg.wait_for_timeout(400); pg.screenshot(path=str(out / f'c64_draw2_{tag}.png'))
        pg.evaluate('() => { const g = G.anomOffers.find(o => typeof o === "object"); window.act(g ? "anom" : "stab", g ? g.id : undefined); UI._dbg.closeModal(); }'); pg.wait_for_timeout(200)
        pg.evaluate('() => document.querySelector("#bPause").click()'); pg.wait_for_timeout(400)
        lst = pg.evaluate('() => [...document.querySelectorAll("#modal .anlist > div")].map(d => d.innerText.replace(/\\n/g, " / "))')
        check(len(lst) == 3, f'Pause lists all 3 Anomalies: {lst}', tag)
        pg.screenshot(path=str(out / f'c64_pause_{tag}.png'))
        pg.evaluate('() => UI._dbg.closeModal()')
        cx = pg.evaluate('() => { const C = PROF.codex.gen; return [C.n, Object.keys(C.parts).length]; }')
        check(cx[0] == 2 and cx[1] >= 2, f'codex counts 2 generated cards and {cx[1]} parts', tag)
        pg.close()
    b.close()
print('ERRORS:', errs)
print('FAILED:', fails)
