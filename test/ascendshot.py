"""v5.8 Ascension perks and Mastery through the real page: Ascend shows the perk cards (fixed slots), a tap picks one
through the recorder, the pending pick blocks the next Ascend, shows a pip on the tower, survives a checkpoint and a
reload + resume with the same cards, Mastery 4 offers 4 cards, the build card shows the Mastery badge, the Archive
lists Mastery, and the game-over screen shows Mastery gained. usage: python3 ascendshot.py [W H]"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'ascend'; out.mkdir(parents=True, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (852, 393)
tag = f'{W}x{H}'
mkpage.mk(); errs = []; checks = []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name)
def shot(pg, n): pg.screenshot(path=str(out / f'{n}_{tag}.png'))
def tap_tower(pg, i):
    c = pg.evaluate(f'() => {{ const t = G.towers[{i}], r = document.querySelector("#cv").getBoundingClientRect(), p = Render.tileToScreen(t.cx, t.cy); return [r.left + p.x * UIS, r.top + p.y * UIS]; }}')
    pg.touchscreen.tap(c[0], c[1]); pg.wait_for_timeout(350)
def tap(pg, sel):
    pg.locator(sel).first.scroll_into_view_if_needed(); pg.wait_for_timeout(150)
    box = pg.locator(sel).first.bounding_box(); pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); pg.wait_for_timeout(300)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = 1; PROF.settings.briefings = "off"; PROF.bestWave = 40; PROF.seenSys = { storm: 1, crate: 1, vet: 1, abil: 1 }; PROF.mastery = { v: 2, xp: { rail: 800, pulse: 70, cryo: 420 } }; Save.save(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(700)
    ok('the run carries the profile Mastery ranks', pg.evaluate('() => JSON.stringify(G.mastery) === JSON.stringify({ pulse: 1, rail: 4, cryo: 3 })'))
    pg.evaluate('''() => { G.credits = 1e6; G.gridBonus = 10; const L = G.map.lanes[0]; let n = 0;
      for (const p0 of L.tiles) for (const [dx, dy] of [[1,0],[0,1]]) if (n < 3 && canBuildAt(p0.x + dx, p0.y + dy) && window.act('build', ['lens','rail','cryo'][n], p0.x + dx, p0.y + dy)) n++;
      for (const t of G.towers) while (t.lvl < 5) window.act('up', t.x, t.y, t.lvl === 3 ? 1 : null); G.paused = true; }''')
    # build menu: Mastery badge on the cards
    xy = pg.evaluate('() => { const L = G.map.lanes[0]; for (let i = L.tiles.length - 4; i > 0; i--) { const p0 = L.tiles[i]; for (const [dx, dy] of [[0,-1],[-1,0],[0,1]]) if (canBuildAt(p0.x + dx, p0.y + dy)) return [p0.x + dx, p0.y + dy]; } }')
    c = pg.evaluate(f'() => {{ const r = document.querySelector("#cv").getBoundingClientRect(), p = Render.tileToScreen({xy[0]} + 0.5, {xy[1]} + 0.5); return [r.left + p.x * UIS, r.top + p.y * UIS]; }}')
    pg.touchscreen.tap(c[0], c[1]); pg.wait_for_timeout(400)
    ok('build menu: Mastery badges on Pulse, Rail and Cryo', pg.evaluate('() => [...document.querySelectorAll("#panel .bt .mrank")].map(e => e.closest(".bt").dataset.type + e.textContent).sort().join(",") === "cryo3,pulse1,rail4"'))
    shot(pg, 'build')
    pg.evaluate('() => document.querySelector("#panel [data-act=close]").click()'); pg.wait_for_timeout(300)
    tap_tower(pg, 0)
    ok('tower panel open on the Lens', pg.evaluate('() => !!document.querySelector("#panel [data-act=up]") && /Void Lens/.test(document.querySelector("#panel").textContent)'))
    ok('Ascend button names the perk and ×1.15', pg.evaluate('() => /Ascend to LV 6/.test(document.querySelector("#panel [data-act=up]").textContent) && /×1.15 Damage, perk/.test(document.querySelector("#panel [data-act=up]").textContent)'))
    FOOT = '() => { const r = document.querySelector("#panel .pfoot .lvup").getBoundingClientRect(), q = document.querySelector("#panel .pfoot .row2").getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), Math.round(q.top)]; }'
    foot0 = pg.evaluate(FOOT)
    tap(pg, '#panel [data-act=up]')
    ok('Ascend opens three perk cards', pg.evaluate('() => document.querySelectorAll("#panel .perk").length === 3 && G.towers[0].ascPend === 1'))
    foot1 = pg.evaluate(FOOT)
    ok(f'the Ascend slot stays put and is disabled ({foot0} -> {foot1})', foot0 == foot1 and pg.evaluate('() => document.querySelector("#panel .pfoot .lvup").disabled && /Choose a perk/.test(document.querySelector("#panel .pfoot .lvup").textContent)'))
    hs = pg.evaluate('() => [...document.querySelectorAll("#panel .perk")].map(e => Math.round(e.getBoundingClientRect().height))')
    ok(f'perk cards are fixed-height slots {hs}', len(set(hs)) == 1 and hs[0] >= 44)
    shot(pg, 'cards')
    ok('the tower shows a pending pip (pick waiting)', pg.evaluate('() => G.towers.some(t => t.ascPend > 0)'))
    offer = pg.evaluate('() => ascOffer(G.towers[0]).slice()')
    tap(pg, '#panel .perk >> nth=1')
    ok(f'tapping a card picks it through the recorder ({offer[1]})', pg.evaluate(f'() => (G.towers[0].perks || [])[0] === "{offer[1]}" && !G.towers[0].ascPend && G.inputs.some(x => x[1] === "ascPick" && x[4] === 1)'))
    ok('cards close after the pick; Details lists the perk', pg.evaluate('() => !document.querySelector("#panel .perk")'))
    tap(pg, '#panel [data-act=tab][data-v=info]')
    ok('Details tab shows the perk', pg.evaluate('() => /Perks/.test(document.querySelector("#panel").textContent)'))
    shot(pg, 'details')
    tap(pg, '#panel [data-act=tab][data-v=act]')
    # Mastery 4: the Rail gets four cards
    pg.evaluate('() => { const t = G.towers[1]; window.act("up", t.x, t.y); UI._dbg.openTower(t); }'); pg.wait_for_timeout(300)
    ok('Mastery 4 Rail: four perk cards', pg.evaluate('() => document.querySelectorAll("#panel .perk").length === 4'))
    shot(pg, 'cards4')
    # pending pick through a checkpoint
    pg.evaluate('() => { const t = G.towers[0]; window.act("up", t.x, t.y); G.paused = false; G.cpDue = G.wave + 1; G.next = 0.1; G.speed = 3; }')
    pend = pg.evaluate('() => [ascOffer(G.towers[0]).slice(), ascOffer(G.towers[1]).slice()]')
    for i in range(40):
        if pg.evaluate('() => !!G.checkpoint'): break
        pg.wait_for_timeout(250)
    ok('checkpoint reached with picks pending', pg.evaluate('() => !!G.checkpoint && G.towers[0].ascPend === 1'))
    pg.evaluate('() => { window.act("cpResume", 1); }'); pg.wait_for_timeout(400)
    ok('pending picks and their cards survive the checkpoint', pg.evaluate('() => !G.checkpoint') and pend == pg.evaluate('() => [ascOffer(G.towers[0]).slice(), ascOffer(G.towers[1]).slice()]'))
    # save, reload, resume
    pg.evaluate('() => { G.paused = true; snapshotNow(); Save.save(); }')
    perks0 = pg.evaluate('() => G.towers.map(t => (t.perks || []).join(","))')
    pg.reload(); pg.wait_for_timeout(700)
    ok('hangar has the saved run', pg.evaluate('() => !!PROF.runSnap && PROF.runSnap.ascV === 2'))
    pg.click('#bLaunch'); pg.wait_for_timeout(900)
    ok('resumed: perks kept', perks0 == pg.evaluate('() => G.towers.map(t => (t.perks || []).join(","))'))
    ok('resumed: the same perk cards are waiting', pend == pg.evaluate('() => [ascOffer(G.towers[0]) || [], ascOffer(G.towers[1]) || []].map(o => o.slice())'))
    pg.evaluate('() => { G.paused = true; }')
    tap_tower(pg, 0)
    ok('resumed: the panel shows the cards', pg.evaluate('() => document.querySelectorAll("#panel .perk").length === 3'))
    print('   ', pg.evaluate('() => [document.querySelector("#modal") && !document.querySelector("#modal").hidden && document.querySelector("#modal").textContent.slice(0, 80), G.towers[0].ascPend, G.towers[0].perks]'))
    tap(pg, '#panel .perk >> nth=0')
    ok('resumed: picking applies', pg.evaluate(f'() => G.towers[0].perks.length === 2 && G.towers[0].perks[1] === "{pend[0][0]}"'))
    shot(pg, 'resumed')
    # game over: Mastery gained
    pg.evaluate('() => { G.wave = Math.max(G.wave, 12); G.towers[0].dmgDone = 90000; G.towers[1].dmgDone = 30000; G.towers[2].dmgDone = 6000; G.paused = false; window.act("abandon"); }'); pg.wait_for_timeout(1600)
    ok('game over shows Mastery gained', pg.evaluate('() => !!document.querySelector("#modal .mgain") && /Mastery/.test(document.querySelector("#modal .mgain").textContent)'))
    print('   ', pg.evaluate('() => document.querySelector("#modal .mgain") && document.querySelector("#modal .mgain").textContent'))
    ok('profile Mastery grew', pg.evaluate('() => PROF.mastery.xp.lens > 0 && PROF.mastery.xp.rail > 800'))
    shot(pg, 'gameover')
    pg.evaluate('() => document.querySelector("[data-act=hangar]").click()'); pg.wait_for_timeout(500)
    pg.evaluate('() => UI._dbg.openArchive()'); pg.wait_for_timeout(400)
    ok('Archive lists Mastery pips', pg.evaluate('() => document.querySelectorAll("#modal .arow .mpip").length >= 10 && document.querySelectorAll("#modal .mpip i.on").length >= 8'))
    shot(pg, 'archive')
    b.close()
print('ERRORS:', errs[:5]); print('FAILED:', [n for n, v in checks if not v])
