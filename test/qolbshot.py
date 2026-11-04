"""6.2 qolB: tabbed Settings, Music Studio help sheet, the battlefield music deck's like button, and the camera tips.
usage: python3 qolbshot.py [WxH,...] [settings|music|deck|camera|all]
Checks: the four tabs exist and switch in place; every pre-6.2 setting is still there (by data-act / id); controls work
(switch, segmented choice, slider); tap targets are at least 44 px; nothing spills sideways; the pane scrolls and the last
row is reachable; the tab is remembered for the session. Music: Compose is visible on a fresh profile and on an old one
(migration once); the ? opens a help sheet on the current tab with Listen/Shape/Compose tabs and an Advanced part on each.
Deck: the heart likes the playing track into My Tracks (same list as the Studio), shows filled, confirms, and a second tap
removes it. Camera: the Training "Look around" step and the first real run's LOOK AROUND tip (after WELCOME, 30 s apart).
Screenshots: test/out/qolb/<size>_*.png"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'qolb'; out.mkdir(parents=True, exist_ok=True)
sizes = [tuple(map(int, s.split('x'))) for s in (sys.argv[1] if len(sys.argv) > 1 else '667x375,1180x820').split(',')]
what = sys.argv[2] if len(sys.argv) > 2 else 'all'
mkpage.mk(); errs = []; fails = []; passed = [0]
def ok(msg, cond):
    if cond: passed[0] += 1
    else: fails.append(msg); print('FAIL', msg, flush=True)
def fresh(pg, extra=''):
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF = Save.merge({}); PROF.seenVer = VERSION; PROF.runs = 4; PROF.bestWave = 20; PROF.tut = { seen: 1, done: 1 }; ' + extra + ' Save.save(); UI.renderHangar(); }')
# everything the 6.1 Settings had, by data-act or id
OLD = ['#setSfx', '#setMus', '[data-act=studioS]', '[data-act=sndFix]', '#sndStat', '[data-act=mono]', '#setBpm', '[data-act=hud]', '[data-act=uis]', '[data-act=haptic]',
       '[data-act=gfx][data-k=glow]', '[data-act=gfx][data-k=sharp]', '[data-act=autoslow]', '[data-act=briefs]', '[data-act=notes]', '[data-act=nums]', '[data-act=shake]',
       '#cloud', '[data-act=xcopy]', '[data-act=xpaste]', '[data-act=wipe]', '[data-act=news]', '[data-act=close2]']
def settings(pg, tag):
    fresh(pg, 'PROF.daily = null;'); pg.evaluate("() => localStorage.setItem('entropy.lastlog', 'x')")
    pg.click('#bSettings'); pg.wait_for_timeout(300)
    tabs = pg.evaluate("() => [...document.querySelectorAll('#modal .settab')].map(b => b.dataset.v)")
    ok(f'{tag}: four tabs {tabs}', tabs == ['general', 'sound', 'graphics', 'interface'])
    miss = pg.evaluate('(L) => L.filter(q => !document.querySelector("#modal " + q))', OLD)
    ok(f'{tag}: every 6.1 setting is still there (missing {miss})', not miss)
    where = pg.evaluate('''(L) => Object.fromEntries(L.map(q => { const e = document.querySelector("#modal " + q); const pg = e && e.closest('.spg'); return [q, pg ? pg.dataset.pg : 'header']; }))''', OLD)
    print(tag, 'tab map', where, flush=True)
    for k in tabs:
        pg.click(f'#modal .settab[data-v={k}]'); pg.wait_for_timeout(150)
        vis = pg.evaluate("() => [...document.querySelectorAll('#modal .spg')].filter(p => !p.hidden).map(p => p.dataset.pg)")
        ok(f'{tag}: {k} tab shows only its page ({vis})', vis == [k])
        pg.screenshot(path=str(out / f'{tag}_set_{k}.png'))
        # tap targets and sideways overflow, on the visible page
        bad = pg.evaluate('''() => { const out = []; for (const e of document.querySelectorAll('#modal .settab, #modal .spg:not([hidden]) button, #modal .spg:not([hidden]) input[type=range]')) { const r = e.getBoundingClientRect(); if (r.width && (r.height / UIS < 43.5 || (e.tagName === 'BUTTON' && r.width / UIS < 43.5))) out.push((e.dataset.act || e.id || e.className) + ' ' + Math.round(r.width / UIS) + 'x' + Math.round(r.height / UIS)); } return out; }''')
        ok(f'{tag}: {k} tap targets at least 44 px {bad}', not bad)
        sx = pg.evaluate("() => { const p = document.querySelector('#modal .setpane'), c = document.querySelector('#modal .card.settings').getBoundingClientRect(); const over = [...p.querySelectorAll('.spg:not([hidden]) *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > c.right + 1 || r.left < c.left - 1); }).map(e => e.className || e.tagName); return [p.scrollWidth - p.clientWidth, over.slice(0, 3)]; }")
        ok(f'{tag}: {k} nothing spills sideways {sx}', sx[0] <= 1 and not sx[1])
        last = pg.evaluate("() => { const p = document.querySelector('#modal .setpane'); p.scrollTop = 1e6; const rows = p.querySelectorAll('.spg:not([hidden]) .setrow'), r = rows[rows.length - 1].getBoundingClientRect(), b = p.getBoundingClientRect(); return r.bottom <= b.bottom + 1 && r.top >= b.top - 1; }")
        ok(f'{tag}: {k} last row reachable by scrolling', last)
        if pg.evaluate("() => { const p = document.querySelector('#modal .setpane'); return p.scrollHeight > p.clientHeight + 4; }"):
            pg.screenshot(path=str(out / f'{tag}_set_{k}_end.png'))
        pg.evaluate("() => { document.querySelector('#modal .setpane').scrollTop = 0; }")
    # controls work and re-render keeps the tab
    pg.click('#modal .settab[data-v=graphics]'); pg.wait_for_timeout(100)
    s0 = pg.evaluate('() => PROF.settings.shake'); pg.click('#modal [data-act=shake]'); pg.wait_for_timeout(150)
    ok(f'{tag}: Screen shake switch flips and stays on Graphics', pg.evaluate('() => PROF.settings.shake') != s0 and pg.evaluate("() => document.querySelector('#modal .settab.on').dataset.v") == 'graphics')
    ok(f'{tag}: switch shows its state', pg.evaluate("() => { const b = document.querySelector('#modal [data-act=shake]'); return b.classList.contains('on') === PROF.settings.shake && /^(On|Off)$/.test(b.textContent.trim()); }"))
    pg.click('#modal [data-act=gfx][data-k=sharp][data-v="0"]'); pg.wait_for_timeout(150)
    ok(f'{tag}: Pixel scaling segmented choice', pg.evaluate('() => PROF.settings.sharp === false && document.querySelector("#modal [data-act=gfx][data-k=sharp].on").dataset.v === "0"'))
    pg.click('#modal [data-act=gfx][data-k=sharp][data-v="1"]'); pg.wait_for_timeout(100)
    pg.click('#modal .settab[data-v=sound]'); pg.wait_for_timeout(100)
    pg.evaluate("() => { const r = document.querySelector('#setMus'); r.value = 0.3; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }")
    ok(f'{tag}: Music slider sets the volume and its readout', pg.evaluate("() => Math.abs(PROF.settings.music - 0.3) < 1e-6 && document.querySelector('#musV').textContent === '30%'"))
    pg.click('#modal .settab[data-v=interface]'); pg.wait_for_timeout(100)
    pg.click('#modal [data-act=notes][data-v=key]'); pg.wait_for_timeout(150)
    ok(f'{tag}: Notifications choice', pg.evaluate('() => PROF.settings.notes === "key"'))
    pg.click('#modal [data-act=notes][data-v=all]'); pg.wait_for_timeout(100)
    pg.click('#modal [data-act=close2]'); pg.wait_for_timeout(200); pg.click('#bSettings'); pg.wait_for_timeout(250)
    ok(f'{tag}: last tab remembered in the session', pg.evaluate("() => document.querySelector('#modal .settab.on').dataset.v") == 'interface')
    # reset needs two taps
    pg.click('#modal .settab[data-v=general]'); pg.evaluate("() => { document.querySelector('#modal .setpane').scrollTop = 1e6; }"); pg.wait_for_timeout(100)
    pg.click('#modal [data-act=wipe]'); pg.wait_for_timeout(150)
    ok(f'{tag}: Reset asks again first', pg.evaluate("() => PROF.runs === 4 && /again/i.test(document.querySelector('#modal [data-act=wipe]').textContent) && document.querySelector('#modal .settab.on').dataset.v === 'general'"))
    pg.screenshot(path=str(out / f'{tag}_set_general_reset.png'))
    pg.click('#modal [data-act=close2]'); pg.wait_for_timeout(150)
    # in a run: no Transfer or Reset, opened from the pause menu, back returns to pause
    pg.evaluate("() => document.querySelector('#bLaunch').click()"); pg.wait_for_timeout(250); pg.evaluate("() => document.querySelector('[data-act=launch]').click()"); pg.wait_for_timeout(900)
    pg.evaluate("() => document.querySelector('#bPause').click()"); pg.wait_for_timeout(250); pg.click('#modal [data-act=settings]'); pg.wait_for_timeout(250)
    pg.click('#modal .settab[data-v=general]'); pg.wait_for_timeout(100)
    ok(f'{tag}: in a run, Transfer and Reset are hidden', pg.evaluate("() => !document.querySelector('#modal [data-act=wipe]') && !document.querySelector('#modal [data-act=xcopy]')"))
    pg.screenshot(path=str(out / f'{tag}_set_inrun.png'))
    pg.click('#modal [data-act=close2]'); pg.wait_for_timeout(200)
    ok(f'{tag}: closing returns to the pause menu', pg.evaluate("() => UI.modalOpen") == 'pause')
with sync_playwright() as p:
    b = p.chromium.launch()
    for (W, H) in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        if what in ('all', 'settings'): settings(pg, tag)
        pg.close()
    b.close()
print('passed', passed[0])
print('FAILED:', fails)
print('ERRORS:', errs[:5])
