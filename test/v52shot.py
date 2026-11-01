"""v5.2 First Hour: a fresh profile's rail (locked buttons out of sight), the hidden Market, the threat chip and Threat Board
(next wave, Strain Assault, DNA), the boss slow-down and its restore, the locked Chaos chips, and a first run's talent point.
usage: python3 v52shot.py [W H]"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'v52'; out.mkdir(parents=True, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (852, 393)
mkpage.mk(); errs = []; checks = []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; }')
    # setup: Unstable and Pandemonium locked on a fresh profile
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / 'setup_fresh.png'))
    ok('Unstable locked on a fresh profile', pg.evaluate('() => !!document.querySelector("[data-act=chLock][data-v=\\"2\\"]")'))
    pg.click('[data-act=launch]'); pg.wait_for_timeout(900)
    pg.evaluate('() => { document.querySelectorAll("[data-act=brief]").forEach(b => b.click()); }'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / 'rail_fresh.png'))
    ok('locked rail buttons hidden', pg.evaluate('() => [...document.querySelectorAll("#abils .rb")].filter(b => getComputedStyle(b).visibility === "hidden").length === 5'))
    ok('Strike visible', pg.evaluate('() => getComputedStyle(document.querySelector("[data-abil=strike]")).visibility !== "hidden"'))
    ok('Market tag hidden before Wave 10', pg.evaluate('() => document.querySelector("#bCash").classList.contains("nomkt")'))
    ok('threat chip shows next wave', pg.evaluate('() => !!document.querySelector("#chips [data-threat]")'))
    # mid run: an assault warning and genes, then the board
    pg.evaluate('''() => { G.wave = 13; G.speed = 1; G.spawningDone = true; G.next = 9; G.assaultNext = 15; prepareWave(14); G.prep.fresh = ['reflector'];
      abilOnlineCheck(13); UI._dbg.updateHud(true); }''')
    pg.wait_for_timeout(300); pg.evaluate('() => { document.querySelectorAll("[data-act=brief]").forEach(b => b.click()); }'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'threat_chip.png'))
    ok('assault shows on the threat chip', pg.evaluate('() => { const c = document.querySelector("#chips [data-threat]"); return !!c && !!G.assault && c.classList.contains("hot"); }'))
    ok('assault banner gone', pg.evaluate('() => document.querySelector("#asbar").hidden'))
    pg.evaluate('() => document.querySelector("#chips [data-threat]").click()'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / 'threat_board.png'))
    ok('threat board open', pg.evaluate('() => !!document.querySelector("#modal .card.threat")'))
    pg.evaluate('() => { const m = document.querySelector("#modal .cbody") || document.querySelector("#modal .card"); m.scrollTop = 9999; }'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / 'threat_board_end.png'))
    pg.evaluate('() => document.querySelector("[data-act=close2]").click()'); pg.wait_for_timeout(200)
    # boss slow-down
    pg.evaluate('''() => { PROF.settings.briefings = 'off'; G.speed = 3; const L = G.map.lanes[0]; spawnBoss({ boss: 'behemoth', lane: L, hpm: 1 }); }''')
    pg.wait_for_timeout(500)
    ok('boss drops speed to 1x', pg.evaluate('() => G.speed === 1 && G.speedWas === 3'))
    pg.screenshot(path=str(out / 'boss_slow.png'))
    pg.evaluate('() => { G.bossAlive.dead = true; G.bossAlive.hp = 0; }'); pg.wait_for_timeout(500)
    ok('speed restored after the boss', pg.evaluate('() => G.speed === 3'))
    # first run's talent point
    ok('Wave 10 score earns a level', pg.evaluate('() => levelFromXP(1434).level === 1 && levelFromXP(4600).level === 2'))
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', [n for n, v in checks if not v])
