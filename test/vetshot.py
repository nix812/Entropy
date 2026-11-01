"""v5.3.4 Veteran Picks: the 'veterans ready' chip walks every waiting mutation. usage: python3 vetshot.py [W H]"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'v53'; out.mkdir(parents=True, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (852, 393)
mkpage.mk(); errs = []; checks = []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = 1; PROF.settings.briefings = "off"; PROF.bestWave = 40; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(700)
    pg.evaluate('''() => { G.credits = 5000; const L = G.map.lanes[0]; let n = 0; for (const p0 of L.tiles) for (const [dx, dy] of [[1,0],[0,1]]) if (n < 3 && canBuildAt(p0.x + dx, p0.y + dy) && window.act('build', ['pulse','rail','cryo'][n], p0.x + dx, p0.y + dy)) n++;
      G.towers[0].pending = 2; G.towers[0].rank = 2; G.towers[1].pending = 1; G.towers[1].rank = 1; G.towers[2].pending = 1; G.towers[2].rank = 1; }''')
    pg.wait_for_timeout(400)
    ok('chip says 3 veterans ready', pg.evaluate('() => /3 veterans ready/i.test(document.querySelector("#chips [data-ready]").textContent)'))
    pg.evaluate('() => document.querySelector("#chips [data-ready]").click()'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / 'vets_1.png'))
    ok('Veteran Picks open, 4 picks waiting, game paused', pg.evaluate('() => !!document.querySelector("#modal .card.vets") && /4 picks waiting/.test(document.querySelector("#modal").textContent) && G.paused'))
    picks = 0
    for i in range(6):
        if not pg.evaluate('() => !!document.querySelector("#modal [data-act=vpick]")'): break
        pg.evaluate('() => document.querySelector("#modal [data-act=vpick]").click()'); pg.wait_for_timeout(250); picks += 1
        if i == 0: pg.screenshot(path=str(out / 'vets_2.png'))
    ok('four picks walked all three towers', picks == 4 and pg.evaluate('() => G.towers.every(t => !t.pending) && !document.querySelector("#modal .card.vets") && !G.paused'))
    ok('each pick added an affix through the recorder', pg.evaluate('() => G.inputs.filter(x => x[1] === "vet").length === 4'))
    b.close()
print('ERRORS:', errs[:5]); print('FAILED:', [n for n, v in checks if not v])
