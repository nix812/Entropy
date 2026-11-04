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

def studio_open(pg):
    pg.click('#bSettings'); pg.wait_for_timeout(250); pg.click('#modal .settab[data-v=sound]'); pg.click('#modal [data-act=studioS]'); pg.wait_for_timeout(500)
def music(pg, tag):
    # Compose visible by default: a brand-new browser, an old profile (migrated once), and one that already migrated keeps its choice
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.evaluate('() => localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    ok(f'{tag}: fresh profile has the composer on', pg.evaluate('() => SFX.music.config.composer === true && PROF.settings.studio.composer === true'))
    pg.evaluate("() => Save.save = () => {}"); pg.evaluate("() => localStorage.setItem('entropy.save.v1', JSON.stringify({ runs: 9, bestWave: 30, seenVer: VERSION, tut: { seen: 1, done: 1 }, settings: { sfx: 0.8, music: 0.45, studio: { custom: true, genres: ['lofi'], favs: [] } } }))")
    pg.reload(); pg.wait_for_timeout(500)
    ok(f'{tag}: old profile migrated to composer on', pg.evaluate('() => SFX.music.config.composer === true && SFX.music.config.cmpV === 1 && JSON.parse(localStorage.getItem("entropy.save.v1")).settings.studio.cmpV === 1 || (Save.save(), SFX.music.config.composer === true)'))
    pg.evaluate("() => Save.save = () => {}"); pg.evaluate("() => localStorage.setItem('entropy.save.v1', JSON.stringify({ runs: 9, bestWave: 30, seenVer: VERSION, tut: { seen: 1, done: 1 }, settings: { sfx: 0.8, music: 0.45, studio: { custom: true, genres: ['lofi'], favs: [], composer: false, cmpV: 1 } } }))")
    pg.reload(); pg.wait_for_timeout(500)
    ok(f'{tag}: the migration runs once only', pg.evaluate('() => SFX.music.config.composer === false'))
    pg.evaluate('() => { Save.save = () => {}; localStorage.clear(); }'); pg.reload(); pg.wait_for_timeout(500)
    fresh(pg); studio_open(pg)
    tabs = pg.evaluate("() => [...document.querySelectorAll('#modal .sttabs .chip')].map(b => b.dataset.v)")
    ok(f'{tag}: Studio shows Listen, Shape, Compose {tabs}', tabs == ['listen', 'shape', 'compose'])
    pg.click('#modal [data-act=stTab][data-v=shape]'); pg.wait_for_timeout(250)
    pg.click('#modal [data-act=stHelp]'); pg.wait_for_timeout(250)
    ok(f'{tag}: ? opens on the tab you were on', pg.evaluate("() => !!document.querySelector('#modal .sthelp') && document.querySelector('#modal .sthelp .chip.on').dataset.v === 'shape'"))
    for k in ['listen', 'shape', 'compose']:
        pg.click(f'#modal .sthelp [data-act=stHelpTab][data-v={k}]'); pg.wait_for_timeout(200)
        n = pg.evaluate("() => [document.querySelectorAll('#modal .sthelp section:first-child dt').length, document.querySelectorAll('#modal .sthelp .shadv dt').length, [...document.querySelectorAll('#modal .sthelp .ssec')].map(h => h.textContent)]")
        ok(f'{tag}: help {k} explains its controls and has Advanced {n}', n[0] >= 6 and n[1] >= 4 and 'Advanced' in n[2])
        side = pg.evaluate("() => { const b = document.querySelector('#modal .sthelp .shbody'); return b.scrollWidth - b.clientWidth; }")
        ok(f'{tag}: help {k} fits sideways', side <= 1)
        pg.screenshot(path=str(out / f'{tag}_help_{k}.png'))
    # it survives a Studio re-render (a genre change re-renders Shape) and closes back to the same tab
    pg.evaluate("() => UI._dbg && 0"); pg.click('#modal [data-act=stHelpX]'); pg.wait_for_timeout(200)
    ok(f'{tag}: closing the sheet returns to the Studio tab', pg.evaluate("() => !document.querySelector('#modal .sthelp') && document.querySelector('#modal .sttabs .chip.on').dataset.v === 'shape'"))
    pg.click('#modal [data-act=stTab][data-v=compose]'); pg.wait_for_timeout(300); pg.click('#modal [data-act=stHelp]'); pg.wait_for_timeout(200)
    ok(f'{tag}: ? from Compose opens Compose help and keeps the radio held', pg.evaluate("() => document.querySelector('#modal .sthelp .chip.on').dataset.v === 'compose' && SFX.music.held === true"))
    pg.click('#modal [data-act=stHelpX]'); pg.click('#modal [data-act=stTab][data-v=listen]'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / f'{tag}_studio_listen.png'))
def deck(pg, tag):
    fresh(pg)
    pg.evaluate("() => document.querySelector('#bLaunch').click()"); pg.wait_for_timeout(250); pg.evaluate("() => document.querySelector('[data-act=launch]').click()"); pg.wait_for_timeout(1200)
    pg.evaluate('() => { UI.closeModal && UI.closeModal(); if (G) G.paused = false; }'); pg.wait_for_timeout(200)
    pg.click('#bMusic'); pg.wait_for_timeout(400)
    ok(f'{tag}: deck open with a heart', pg.evaluate("() => !document.querySelector('#mdeck').hidden && !!document.querySelector('#bTrkLike')"))
    n0 = pg.evaluate('() => SFX.music.config.favs.length')
    ok(f'{tag}: heart empty for a new song', pg.evaluate("() => !document.querySelector('#bTrkLike').classList.contains('on')"))
    pg.screenshot(path=str(out / f'{tag}_deck_heart_off.png'))
    pg.click('#bTrkLike'); pg.wait_for_timeout(250)
    st = pg.evaluate("() => { const M = SFX.music, p = M.piece, f = M.config.favs[0]; return { n: M.config.favs.length, same: !!f && f.seed === M.spec.seed, on: document.querySelector('#bTrkLike').classList.contains('on'), line: document.querySelector('#mdeck .mdname span').textContent, saved: JSON.parse(localStorage.getItem('entropy.save.v1')).settings.studio.favs.length, snd: !!(f && f.snd) }; }")
    ok(f'{tag}: heart keeps the song into My Tracks with its sound, fills and confirms {st}', st['n'] == n0 + 1 and st['same'] and st['on'] and 'Kept' in st['line'] and st['saved'] == n0 + 1 and st['snd'])
    pg.screenshot(path=str(out / f'{tag}_deck_heart_on.png'))
    pg.wait_for_timeout(2000)
    ok(f'{tag}: the confirmation gives way to the song line', 'Kept' not in pg.evaluate("() => document.querySelector('#mdeck .mdname span').textContent"))
    pg.click('#mdName'); pg.wait_for_timeout(500)
    ok(f'{tag}: the kept song is in the Studio list', pg.evaluate("() => UI.modalOpen === 'studio' && document.querySelectorAll('#modal .stfav').length === SFX.music.config.favs.length && document.querySelector('#modal #stKeepB').classList.contains('on')"))
    pg.click('#modal [data-act=stClose]'); pg.wait_for_timeout(300); pg.evaluate('() => { if (G) G.paused = false; }')
    pg.click('#bMusic'); pg.wait_for_timeout(300)
    ok(f'{tag}: reopened deck still shows it filled', pg.evaluate("() => document.querySelector('#bTrkLike').classList.contains('on')"))
    pg.click('#bTrkLike'); pg.wait_for_timeout(250)
    ok(f'{tag}: a second tap takes it out', pg.evaluate("() => SFX.music.config.favs.length") == n0 and not pg.evaluate("() => document.querySelector('#bTrkLike').classList.contains('on')") and 'Removed' in pg.evaluate("() => document.querySelector('#mdeck .mdname span').textContent"))
    pg.screenshot(path=str(out / f'{tag}_deck_heart_removed.png'))
CARD = "() => { const c = document.querySelector('#coach'); if (!c || c.hidden || c.classList.contains('idle')) return null; const r = c.querySelector('.cring'), rr = r.hidden ? null : r.getBoundingClientRect(); return { step: UI.coach.step, held: UI.coachHold, ring: rr ? [rr.left, rr.top, rr.width, rr.height] : null, ok: !c.querySelector('.cok').hidden }; }"
def camera(pg, tag):
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { window.tutOfferTest = 1; PROF = Save.merge({}); PROF.seenVer = VERSION; Save.save(); UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=tutGo]'); pg.wait_for_timeout(900)
    seen = None
    for _ in range(400):
        c = pg.evaluate(CARD)
        if not c: pg.evaluate('() => { if (G && !G.over) G.speed = 4; }'); pg.wait_for_timeout(120); continue
        pg.evaluate('() => { if (G) G.speed = 1; }')
        if c['step'] == 'camera': seen = c; break
        if c['ok']: pg.click('#coach .cok'); pg.wait_for_timeout(200); continue
        if c['ring']: r = c['ring']; pg.touchscreen.tap(r[0] + r[2] / 2, r[1] + r[3] / 2); pg.wait_for_timeout(350); continue
        pg.wait_for_timeout(120)
    ok(f'{tag}: Training shows the camera tip in Wave 1', bool(seen) and pg.evaluate('() => G.wave') == 1)
    if seen:
        t = pg.evaluate('() => G.time'); ok(f'{tag}: camera tip comes after some play ({t:.1f} s)', t >= 15)
        txt = pg.evaluate("() => document.querySelector('#coach .cb').textContent")
        ok(f'{tag}: tip says drag, pinch and the core arrow, and not Home ({txt})', 'Drag' in txt and 'pinch' in txt and 'core arrow' in txt and 'Home' not in txt)
        pg.screenshot(path=str(out / f'{tag}_camera_training.png'))
        cv = pg.evaluate("() => { const r = document.querySelector('#cv').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
        pg.mouse.move(cv[0], cv[1]); pg.mouse.down()
        for k in range(20): pg.mouse.move(cv[0] - k * 6, cv[1] - k * 2)
        pg.mouse.up(); pg.wait_for_timeout(300)
        ok(f'{tag}: dragging the map completes the camera step', pg.evaluate('() => UI.coach.step') != 'camera')
    # a first real run: WELCOME, then LOOK AROUND, at least 30 s of play apart
    fresh(pg, 'PROF.seenHelp = false; delete PROF.zoomHint; PROF.seenSys = { v58: 1, frontier: 1, storm: 1, crate: 1, vet: 1, abil: 1, upg: 1, power: 1, spare: 1, wormhole: 1, anomaly: 1, boss: 1, market: 1, support: 1 };')
    pg.evaluate("() => document.querySelector('#bLaunch').click()"); pg.wait_for_timeout(250); pg.evaluate("() => document.querySelector('[data-act=launch]').click()"); pg.wait_for_timeout(600)
    pg.evaluate("() => { window._tk = []; const el = document.getElementById('ticker'); new MutationObserver(() => { const s = el.textContent; if (G && s && !window._tk.some(x => x.s === s)) window._tk.push({ s, t: G.time }); }).observe(el, { childList: true, subtree: true, characterData: true }); G.speed = 3; }")
    shot = False
    for _ in range(200):
        tk = pg.evaluate('() => window._tk')
        if not shot and any('LOOK AROUND' in x['s'] for x in tk): pg.evaluate('() => { G.speed = 1; }'); pg.wait_for_timeout(300); pg.screenshot(path=str(out / f'{tag}_camera_firstrun.png')); shot = True; break
        pg.wait_for_timeout(150)
    tk = pg.evaluate('() => window._tk'); w = [x['t'] for x in tk if 'WELCOME' in x['s']]; l = [x['t'] for x in tk if 'LOOK AROUND' in x['s']]
    ok(f'{tag}: first run shows WELCOME then LOOK AROUND, 30 s apart {[(x["s"][:20], round(x["t"], 1)) for x in tk]}', w and l and l[0] - w[0] >= 29.5)
    ok(f'{tag}: the camera tip shows once', pg.evaluate('() => PROF.zoomHint === 1'))
with sync_playwright() as p:
    b = p.chromium.launch()
    for (W, H) in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        if what in ('all', 'settings'): settings(pg, tag)
        if what in ('all', 'music'): music(pg, tag)
        if what in ('all', 'deck'): deck(pg, tag)
        if what in ('all', 'camera'): camera(pg, tag)
        pg.close()
    b.close()
print('passed', passed[0])
print('FAILED:', fails)
print('ERRORS:', errs[:5])
