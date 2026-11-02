"""v5.5.3 Mono Audio: rendered offline, music (ping-pong echo, panned keys) differs between left and right with Mono off
and is identical in both ears with it on; the Settings switch persists and applies. usage: python3 monocheck.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; mkpage.mk(); errs = []; checks = []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    def render(mono):
        pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
        r = pg.evaluate('''async (mono) => {
          const sr = 22050, secs = 8, oc = new OfflineAudioContext(2, sr * secs, sr);
          SFX.setMono(mono); SFX.offlineCtx(oc); SFX.music.setConfig({ custom: true, genres: ['lofi'], energy: 0.8 }); SFX.music.start(); SFX.music.renderAhead(secs - 1);
          const buf = await oc.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
          let d = 0, e = 0; for (let i = 0; i < L.length; i++) { d += Math.abs(L[i] - R[i]); e += Math.abs(L[i]) + Math.abs(R[i]); }
          return { diff: d / L.length, energy: e / L.length };
        }''', mono)
        pg.close(); return r
    st, mo = render(False), render(True)
    print('   stereo', st, ' mono', mo)
    ok('stereo music differs left to right', st['diff'] > st['energy'] * 0.02)
    ok('mono is the same in both ears', mo['diff'] < 1e-6 and mo['energy'] > 0.001)
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; }')
    pg.click('#bSettings'); pg.wait_for_timeout(300)
    pg.evaluate('() => document.querySelector("[data-act=mono]").click()'); pg.wait_for_timeout(200)
    ok('the switch turns Mono on', pg.evaluate('() => PROF.settings.mono === true && SFX.mono && /On/.test(document.querySelector("[data-act=mono]").textContent)'))
    pg.evaluate('() => document.querySelector("[data-act=mono]").scrollIntoView()'); pg.screenshot(path=str(root / 'test' / 'out' / 'mono_settings.png'))
    pg.evaluate('() => Save.save()'); pg.reload(); pg.wait_for_timeout(500)
    ok('it stays on after a reload', pg.evaluate('() => PROF.settings.mono === true && SFX.mono'))
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', [n for n, v in checks if not v])
