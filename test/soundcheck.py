"""v5.5.4 sound robustness: the audio wakes itself when knocked out of 'running' (iOS leaves it 'interrupted' after an AirPod
or a call; Chromium can only show 'suspended'), an error inside the score is caught and the music carries on with a new
piece, Settings › Sound reports the state, and Restart sound brings everything back from paused, held or stopped.
usage: python3 soundcheck.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; mkpage.mk(); errs = []; checks = []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name)
def lvl(pg): return pg.evaluate('() => { const a = new Uint8Array(128); for (let i = 0; i < 40; i++) SFX.music.spectrum(a); let s = 0; for (const v of a) s += v; return s; }')  # the analyser smooths per read: read it until it settles
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; }')
    pg.mouse.click(300, 200); pg.wait_for_timeout(2000)
    ok('music plays', lvl(pg) > 500 and pg.evaluate('() => SFX.state === "running"'))
    # knocked out of running: it wakes itself without a tap
    pg.evaluate('() => { window._states = []; SFX._test.ctx.addEventListener("statechange", () => _states.push(SFX.state)); SFX._test.ctx.suspend(); }'); pg.wait_for_timeout(100)
    pg.wait_for_timeout(200)
    pg.wait_for_timeout(3000)
    st = pg.evaluate('() => _states'); print('   states:', st)
    ok('knocked out of running, it wakes itself', 'suspended' in st and pg.evaluate('() => SFX.state === "running"') and lvl(pg) > 500)
    # an error inside the score
    n0 = pg.evaluate('() => SFX.music.piece.name')
    pg.evaluate('() => SFX._test.fault()'); pg.wait_for_timeout(2500)
    ok('an error in the score is caught and noted', pg.evaluate('() => SFX.errors >= 1 && /test fault/.test(SFX.lastError.msg)'))
    ok('and the music carries on with a new piece', pg.evaluate(f'() => SFX.music.piece.name !== {n0!r}') and lvl(pg) > 500)
    ok('no error escaped to the page', not errs)
    # Settings › Sound and Restart sound
    pg.evaluate('() => { SFX.music.setPaused(true); SFX.music.setHold(true); }'); pg.wait_for_timeout(800)
    ok('silenced for the test', pg.evaluate('() => SFX.music.paused && SFX.music.held'))  # (pause silencing is measured offline: the live meter here decays slowly)
    pg.click('#bSettings'); pg.wait_for_timeout(300)
    stat = pg.evaluate('() => document.querySelector("#sndStat").textContent')
    print('   status:', stat)
    ok('Settings says what is wrong', 'paused' in stat and 'holding' in stat and 'recovered from' in stat)
    pg.screenshot(path=str(root / 'test' / 'out' / 'sound_settings.png'))
    pg.evaluate('() => document.querySelector("[data-act=sndFix]").click()'); pg.wait_for_timeout(1500)
    ok('Restart sound brings the music back', not pg.evaluate('() => SFX.music.paused || SFX.music.held') and lvl(pg) > 500)
    stat2 = pg.evaluate('() => document.querySelector("#sndStat") ? document.querySelector("#sndStat").textContent : ""')
    print('   status after:', stat2)
    ok('and the status shows it playing', 'playing' in stat2)
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', [n for n, v in checks if not v])
