# The checkpoint holds until the field is clear: HUD says so, Next is disabled, then the checkpoint starts.
import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 34; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    # end of the wave before a wormhole opens, with enemies still walking
    pg.evaluate('''() => { G.wave = 13; G.cpDue = 14; G.spawningDone = true; G.queue.length = 0; G.next = 5;
      for (let i = 0; i < 4; i++) spawnEnemy('tank', { L: G.map.lanes[0], d: i * 0.8 }); G.speed = 1; }''')
    pg.wait_for_timeout(600)
    s = pg.evaluate('() => ({ cp: G.checkpoint, hud: document.querySelector("#nextw").textContent, next: document.querySelector("#bCall").disabled, alive: G.enemies.length })')
    print('while enemies remain:', s)
    pg.screenshot(path=str(out / 'cp01_waiting.png'))
    pg.evaluate('() => { for (const e of G.enemies) kill(e, null, {}); }'); pg.wait_for_timeout(500)
    s = pg.evaluate('() => ({ cp: G.checkpoint, hud: document.querySelector("#nextw").textContent, banner: !document.querySelector("#cpBanner").hidden, wave: G.wave })')
    print('after clearing:', s)
    b.close()
print('ERRORS:', errs)
