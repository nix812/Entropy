"""v5.0 Talents: the screen opens from the hangar and in a run, rows gate at 5/10/15 points, Capstones at 20 with slots,
refunds cost tokens mid-run, builds save and load, old webs migrate with a refund. usage: python3 talentshot.py [W H]"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out'
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (852, 393)
mkpage.mk(); errs, fails = [], []
def check(c, m):
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # an old-web profile migrates: points refunded
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(300)
    pg.evaluate('''() => { const P = JSON.parse(JSON.stringify(PROF)); P.webV = 3; P.alloc = ['start', 's0_0', 's0_1']; P.stars = { s0: 4 }; P.xp = 3e6; P.seenHelp = true; P.seenVer = VERSION; P.bestWave = 60;
      PROF = Save.merge(P); migrateWeb(); UI.renderHangar(); }''')
    pg.wait_for_timeout(200)
    st = pg.evaluate('() => ({ webV: PROF.webV, spent: pointsSpent(), free: pointsFree(), lvl: profLevel().level })')
    check(st['webV'] == 4 and st['spent'] == 0 and st['free'] == st['lvl'], f'migration: {st}')
    pg.click('#bWebH'); pg.wait_for_timeout(300)
    check(pg.evaluate('() => Tree.isOpen'), 'talents did not open')
    pg.screenshot(path=str(out / f'tal_empty_{W}.png'))
    # row gate: row 2 locked until 5 points
    check(pg.evaluate('() => talentBlock("kRate")') == 'row', 'row 2 should be locked')
    for i in range(5): pg.click('[data-tact=add][data-v=kDmg]'); pg.wait_for_timeout(40)
    check(pg.evaluate('() => talRank("kDmg")') == 5, 'kDmg ranks')
    check(pg.evaluate('() => talentBlock("kRate")') == '', 'row 2 should open at 5')
    pg.evaluate('() => { for (const id of ["kCrit","kCrit","kCrit","kCrit","kCrit","kRate","kRate","kRate","kRate","kRate","kPen","kPen","kPen","kHollow","kLeth","kLeth"]) talentAdd(id); Tree.refresh(); }')
    check(pg.evaluate('() => treePts("K")') == 21, 'tree points')
    check(pg.evaluate('() => talentBlock("marksman")') == '', 'capstone should open at 20')
    # double tap a capstone tile to take it
    pg.evaluate('() => document.querySelector("#tgrid").scrollTop = 9999'); pg.wait_for_timeout(100)
    pg.dblclick('.ttile.cap [data-tact=sel][data-v=glass]'); pg.wait_for_timeout(200)
    check(pg.evaluate('() => capsHeld().includes("glass")'), 'double-tap capstone')
    check(pg.evaluate('() => talentBlock("marksman")') == 'tree', 'one Capstone per tree')
    pg.click('[data-tact=sel][data-v=kLeth]'); pg.wait_for_timeout(150)
    pg.screenshot(path=str(out / f'tal_tree_{W}.png'))
    # removing a row-1 rank that a row-3 talent needs is refused
    check(pg.evaluate('() => talentCanRemove("kDmg")') == '', 'a spare rank can be removed')
    pg.evaluate('() => talentRemove("kDmg")')
    check(pg.evaluate('() => talentCanRemove("kCrit")') == 'cap', 'removing below 20 with a Capstone should be refused')
    pg.evaluate('() => talentAdd("kDmg")')
    pg.click('[data-tact=sum]'); pg.wait_for_timeout(150); pg.screenshot(path=str(out / f'tal_sum_{W}.png'))
    pg.click('[data-tact=builds]'); pg.wait_for_timeout(100); pg.click('[data-tact=bsave][data-v="0"]'); pg.wait_for_timeout(100)
    pg.evaluate('() => talentReset()'); check(pg.evaluate('() => pointsSpent()') == 0, 'reset')
    pg.click('[data-tact=bload][data-v="0"]'); pg.wait_for_timeout(150)
    check(pg.evaluate('() => pointsSpent()') == 22 and pg.evaluate('() => capsHeld().includes("glass")'), 'build load')
    pg.screenshot(path=str(out / f'tal_builds_{W}.png'))
    check(pg.evaluate('() => computeMods(null, null).ks.glass === 1'), 'capstone ks in mods')
    pg.click('#tbar [data-tact=close]'); pg.wait_for_timeout(150)
    # in a run: refunds cost tokens
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    pg.evaluate('() => { PROF.settings.briefings = "off"; }')
    pg.click('#bWeb'); pg.wait_for_timeout(200)
    check(pg.evaluate('() => G.paused'), 'talents should pause the run')
    t0 = pg.evaluate('() => G.tokens'); pg.evaluate('() => talentRemove("kLeth")')
    check(pg.evaluate('() => G.tokens') == t0 - 1, 'mid-run refund should cost a token')
    pg.screenshot(path=str(out / f'tal_run_{W}.png'))
    pg.click('#tbar [data-tact=close]'); pg.wait_for_timeout(150)
    check(not pg.evaluate('() => G.paused'), 'closing should resume')
    b.close()
print('FAILS:', fails); print('ERRORS:', errs[:5])
