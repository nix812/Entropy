# 6.5.5 sound watchdog: the run log records the device, audio state changes, wake tries, a silent output and its return,
# and a health line every 5 waves. usage: python3 test/audwatch.py
import pathlib, sys, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'test')); import mkpage; mkpage.mk()
fails, errs = [], []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 852, 'height': 393}, has_touch=True); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_function('() => { try { return !!PROF && !!UI; } catch (e) { return false; } }', timeout=60000)
    pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.tutDone = true; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(300)
    pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); pg.wait_for_timeout(800)
    pg.evaluate('() => { SFX.init(); SFX.wake(); SFX.music.setPaused(false); SFX.music.setHold(false); }'); pg.wait_for_timeout(5000)
    h = pg.evaluate('() => SFX.health()')
    ok(h['st'] == 'running' and h['mRun'] == 1, f'health reads the engine: {json.dumps(h)[:160]}')
    ok(h['rms'] > 1e-4, f'the output meter hears the music (rms {h["rms"]:.5f})')
    kinds = lambda: pg.evaluate('() => G.rlog.map(e => e.k)')
    ok('dev' in kinds(), 'the device line is logged once')
    for i in range(3): pg.evaluate('() => SFX.music.skip()'); pg.wait_for_timeout(15000)
    ok('audSilent' not in kinds(), '45 s of normal play with 3 song changes: no false silence alarm')
    # suspend: a state event, then wake tries, then 'audWoke' when it runs again
    pg.evaluate('() => SFX.music && SFX.health && (window._c = null)')
    pg.evaluate('''() => { const ac = SFX._ctx; }''')
    pg.evaluate('() => document.dispatchEvent(new Event("visibilitychange"))')
    ok('vis' in kinds(), 'page hide/show is logged')
    # a silent output while music is meant to play: fake the meter for 3 checks, then let it hear again
    pg.evaluate('''() => { const real = SFX.health; window._realH = real; SFX.health = () => Object.assign(real(), { rms: 0, st: 'running', mRun: 1, mPause: 0, mHeld: 0, musV: 0.5 }); }''')
    pg.wait_for_timeout(7500)
    ok('audSilent' in kinds(), 'a silent output while music should play is logged (audSilent)')
    pg.evaluate('() => { SFX.health = window._realH; }'); pg.wait_for_timeout(2600)
    ok('audBack' in kinds(), 'its return is logged (audBack)')
    # a state change that is not 'running' and the wake tries until it runs
    pg.evaluate('''() => { const real = window._realH; let n = 0; SFX.health = () => { n++; return Object.assign(real(), n < 3 ? { st: 'interrupted' } : {}); }; }''')
    pg.wait_for_timeout(7000)
    ok('audWoke' in kinds(), 'wake tries until it runs again are logged (audWoke)')
    pg.evaluate('() => { SFX.health = window._realH; }')
    # an audio error reaches the log
    pg.evaluate('() => SFX.report(new Error("test error"), "unit")')
    ok('aud_err' in kinds(), 'an audio error is logged (aud_err)')
    # the 5-wave health line
    pg.evaluate('() => { G.wave = 5; }'); pg.wait_for_timeout(2600)
    ok('aud' in kinds(), 'a health line every 5 waves (aud)')
    ok(not errs, f'no page errors {errs[:2]}')
    print(json.dumps([e for e in pg.evaluate('() => G.rlog') if e['k'].startswith(('aud', 'dev', 'vis'))])[:900])
    b.close()
print('FAILED:', fails)
