"""v5.8 Techniques in the tower panel: the Fire row is in a fixed slot, locked until its talent is learned (and says which), switches
through act('fire') (recorded), survives a refund and re-learn at a checkpoint, and survives a save, reload and resume.
usage: python3 fireshot.py [W H]"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out'
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (852, 393)
mkpage.mk(); errs, fails = [], []
def check(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = xpToLevel(40) + 1; PROF.runs = 5; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; PROF.seenSys = { storm: 1, crate: 1, vet: 1, abil: 1 }; Save.save(); UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(300); pg.click('[data-act=launch]'); pg.wait_for_timeout(600)
    pg.evaluate('''() => { if (UI.closeModal) UI.closeModal(); G.credits = 50000; G.paused = true;
      const L = G.map.lanes[0]; let t = null, c = null;
      for (const p0 of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const x = p0.x + dx, y = p0.y + dy;
        if (!canBuildAt(x, y) || !inRegion(x, y, G.region)) continue; if (!t) { if (window.act('build', 'pulse', x, y)) t = G.towerAt[tIdx(x, y)]; } else if (!c && Math.abs(x - t.x) + Math.abs(y - t.y) > 2) { if (window.act('build', 'cryo', x, y)) c = G.towerAt[tIdx(x, y)]; } }
      window.__t = t; window.__c = c; UI._dbg.openTower(t); }''')
    pg.wait_for_timeout(300)
    check(pg.evaluate('() => !!document.querySelector("#panel .firerow")'), 'Fire row in the tower panel')
    check(pg.evaluate('() => document.querySelector("#panel .firerow [data-v=supp]").classList.contains("lock")'), 'Suppressor is locked before its talent')
    check(pg.evaluate('() => /learn Suppressor in Ballistics/.test(document.querySelector("#panel .firedesc").textContent)'), 'locked hint names the talent')
    SLOT = '() => { const r = document.querySelector("#panel .firerow"), c = r.closest(".pbody") || r.parentElement; return Math.round(r.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop); }'
    y0 = pg.evaluate(SLOT)
    pg.click('#panel .firerow [data-v=supp]'); pg.wait_for_timeout(200)
    check(pg.evaluate('() => !__t.fire && !G.inputs.some(x => x[1] === "fire")'), 'tapping a locked mode changes nothing')
    pg.screenshot(path=str(out / f'fire_locked_{W}.png'))
    # learn it mid-run (adding a talent is free), the panel unlocks the chip in the same slot
    pg.evaluate('() => { talentAdd("kSupp"); UI.renderPanel(); }'); pg.wait_for_timeout(200)
    check(not pg.evaluate('() => document.querySelector("#panel .firerow [data-v=supp]").classList.contains("lock")'), 'Suppressor unlocks once learned')
    pg.click('#panel .firerow [data-v=supp]'); pg.wait_for_timeout(250)
    check(pg.evaluate('() => __t.fire === "supp" && __t.s.fire === "supp"'), 'switch to Suppressor')
    check(pg.evaluate('() => G.inputs.some(x => x[1] === "fire" && x[4] === "supp")'), 'the switch is a recorded act')
    check(pg.evaluate('() => document.querySelector("#panel .firerow [data-v=supp]").classList.contains("on")'), 'Suppressor chip shows as on')
    y1 = pg.evaluate(SLOT)
    check(abs(y0 - y1) < 1, f'Fire row stays in its slot ({y0} vs {y1})')
    pg.screenshot(path=str(out / f'fire_on_{W}.png'))
    # a cryo tower (no targeting row) still gets the Fire row
    pg.evaluate('() => UI._dbg.openTower(__c)'); pg.wait_for_timeout(250)
    check(pg.evaluate('() => !!document.querySelector("#panel .firerow [data-v=lance]")'), 'Cryo panel has the Cold Lance slot')
    pg.evaluate('() => { talentAdd("cLance"); UI.renderPanel(); }'); pg.wait_for_timeout(150)
    pg.click('#panel .firerow [data-v=lance]'); pg.wait_for_timeout(200)
    check(pg.evaluate('() => __c.fire === "lance" && __c.s.kind === "beam"'), 'Cold Lance on')
    pg.screenshot(path=str(out / f'fire_cryo_{W}.png'))
    # refund at a checkpoint: the tower falls back to Standard, keeps its choice, and takes it back when re-learned
    pg.evaluate('() => { G.checkpoint = 1; talentRemove("kSupp"); UI._dbg.openTower(__t); }'); pg.wait_for_timeout(250)
    check(pg.evaluate('() => __t.fire === "supp" && __t.s.fire === "" && document.querySelector("#panel .firerow [data-v=\\"\\"]").classList.contains("on")'), 'refund returns the tower to Standard')
    pg.evaluate('() => { talentAdd("kSupp"); UI.renderPanel(); G.checkpoint = 0; }'); pg.wait_for_timeout(200)
    check(pg.evaluate('() => __t.s.fire === "supp"'), 're-learned: the tower is back on Suppressor')
    # save, reload, resume
    pg.evaluate('() => { snapshotNow(); Save.save(); }')
    xy = pg.evaluate('() => [__t.x, __t.y, __c.x, __c.y]')
    pg.reload(); pg.wait_for_timeout(700)
    check(pg.evaluate('() => !!PROF.runSnap'), 'run saved')
    pg.click('#bLaunch'); pg.wait_for_timeout(1200)
    st = pg.evaluate('([x, y, cx, cy]) => { const t = G.towerAt[tIdx(x, y)], c = G.towerAt[tIdx(cx, cy)]; return [t && t.fire, t && t.s.fire, c && c.fire, c && c.s.kind]; }', xy)
    check(st == ['supp', 'supp', 'lance', 'beam'], f'Techniques survive a reload and resume: {st}')
    pg.evaluate('([x, y]) => { G.paused = true; UI._dbg.openTower(G.towerAt[tIdx(x, y)]); }', xy); pg.wait_for_timeout(300)
    check(pg.evaluate('() => document.querySelector("#panel .firerow [data-v=supp]").classList.contains("on")'), 'resumed panel shows Suppressor on')
    pg.screenshot(path=str(out / f'fire_resumed_{W}.png'))
    b.close()
print('FAILED:', fails); print('ERRORS:', errs[:5])
