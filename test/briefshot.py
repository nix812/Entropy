"""v4.6.1 notifications: Most Wanted and boss briefings pause the game, HUD chips never truncate (+N opens the Field Report),
and Settings > Notifications filters alert cards. usage: python3 briefshot.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
mkpage.mk()
errs, fails = [], []
def check(c, m):
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 3; PROF.seenVer = VERSION; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(3400)
    st = pg.evaluate('() => ({ modal: UI.modalOpen, paused: G.paused, brief: !!document.querySelector(".card.brief.wanted") })')
    check(st['brief'] and st['paused'], f'wanted briefing did not pause: {st}')
    pg.screenshot(path=str(out / 'brief_wanted.png'))
    if st['brief']: pg.click('[data-act=brief]'); pg.wait_for_timeout(200)
    check(not pg.evaluate('() => G.paused'), 'Got it did not resume')
    # crowd the chip bar
    pg.evaluate('''() => { G.wave = 18; G.evList = [{ name: 'Swarm Tide', desc: 'More enemies this wave', good: 0 }, { name: 'Overcharge', desc: 'Towers fire faster', good: 1 }]; G.flux = { el: 'A' };
      for (const L of G.map.lanes) if (!L.openWave) {} }''')
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(out / 'brief_chips.png'))
    more = pg.evaluate('() => { const m = document.querySelector("#chips [data-more]"); const ch = document.querySelector("#chips"); const vis = [...ch.children].filter(k => !k.hidden), r = ch.getBoundingClientRect(); return { more: m ? m.textContent : null, over: vis.reduce((a, k) => Math.max(a, k.getBoundingClientRect().right), 0) - r.right }; }')
    check(more['over'] <= 1, f'chips overflow the bar: {more}')
    if more['more']:
        pg.click('#chips [data-more]'); pg.wait_for_timeout(300)
        check(pg.evaluate('() => !!document.querySelector(".card.report")'), 'report did not open')
        pg.screenshot(path=str(out / 'brief_report.png'))
        pg.click('.card.report [data-act=resume]'); pg.wait_for_timeout(200)
    # boss arrival
    pg.evaluate('() => { const e = spawnBoss({ boss: "cat", lane: G.map.lanes[0], hpm: 1, elite: 0 }); }')
    pg.wait_for_timeout(500)
    st = pg.evaluate('() => ({ brief: !!document.querySelector(".card.brief.boss"), paused: G.paused })')
    check(st['brief'] and st['paused'], f'boss briefing did not pause: {st}')
    pg.screenshot(path=str(out / 'brief_boss.png'))
    if st['brief']: pg.click('[data-act=brief]'); pg.wait_for_timeout(200)
    check(not pg.evaluate('() => G.paused'), 'Fight did not resume')
    # notifications Off: an alert goes to the feed instead of a card
    pg.evaluate('() => { PROF.settings.notes = "off"; UI.toast("PIRATES", "test", "#fff"); }'); pg.wait_for_timeout(300)
    check(pg.evaluate('() => !document.querySelector("#toasts .toast")'), 'Off still showed an alert card')
    pg.evaluate('() => { PROF.settings.notes = "key"; UI.toast("PIRATES", "test2", "#fff"); UI.toast("LEVEL UP", "test3", "#fff"); }'); pg.wait_for_timeout(300)
    txt = pg.evaluate('() => [...document.querySelectorAll("#toasts .toast b")].map(b => b.textContent)')
    check(txt == ['PIRATES'], f'Key filter wrong: {txt}')
    b.close()
print('FAILS:', fails); print('ERRORS:', errs[:5])
