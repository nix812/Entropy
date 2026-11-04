"""6.4 tower64: the capstone tier and its seven towers on a real page.
usage: python3 tower64shot.py [W H tag]   (default 667 375 p; also run 1180 820 i)
 - Talents: a tree with its tier unlocked (and selected), a tree with the tier still locked
 - a run started from the hangar carries the learned towers in G.capT (and in recOpts), the build menu lists them with a gold
   corner; with only some learned, the rest sit greyed in the Capstone tier strip and a tap says how to unlock them
 - the one-time intro card for a new tower comes through the teaching queue
 - each new tower (base + both specs) fires on the field beside the road: one PNG each
Screens land in test/out/tower64/. Prints FAIL lines and ERRORS: [...] like the other suites."""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (667, 375)
tag = sys.argv[3] if len(sys.argv) > 3 else ('p' if W < 900 else 'i')
outd = root / 'test' / 'out' / 'tower64'; outd.mkdir(parents=True, exist_ok=True)
mkpage.mk(); errs, fails = [], []
def ok(c, msg):
    if not c: fails.append(msg); print('FAIL ' + msg)
    else: print('ok   ' + msg)
CAP = ['saw', 'flashover', 'surge', 'rime', 'tangle', 'aegis', 'joker']
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.set_default_timeout(120000)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FILE' not in m.text and 'TUNNEL' not in m.text else None)
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(500)
    # a profile at Level 60 with Ballistics filled to 16 points and its tier learned, Voltaic at 7 points (tier locked)
    pg.evaluate('''() => { Object.assign(PROF, { bestWave: 60, seenHelp: true, runs: 9, seenVer: VERSION, zoomHint: 1, xp: xpToLevel(60) + 10 });
      PROF.settings.briefings = 'pause'; PROF.seenSys = { v58: 1, frontier: 1, storm: 1, crate: 1, vet: 1, abil: 1, upg: 1, power: 1, spare: 1, wormhole: 1, anomaly: 1, boss: 1, market: 1, support: 1, tech: 1 };
      PROF.tal = { kDmg: 3, kCrit: 3, kSupp: 1, kRate: 3, kPen: 2, kOver: 1, kHollow: 1, kLeth: 2, kTop: 1, aDmg: 3, aRate: 3, aFence: 1 }; PROF.caps = []; Save.save(); UI.renderHangar(); }''')
    # ---- Talents: the tier on the Ballistics tree (learned) and the Voltaic tree (locked)
    pg.evaluate('() => { Tree.open(); Tree.select("kTop"); const g = document.getElementById("tgrid"); g.scrollTop = g.scrollHeight; }'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(outd / f'{tag}_talents_tier.png'))
    ok(pg.evaluate('() => !!document.querySelector("#tgrid .ttile.tier.have")'), 'Ballistics shows its capstone tier tile, learned')
    pg.evaluate('() => { Tree.select("aTop"); }'); pg.wait_for_timeout(200)
    pg.evaluate('() => { const g = document.getElementById("tgrid"); g.scrollTop = g.scrollHeight; }'); pg.wait_for_timeout(100)
    pg.screenshot(path=str(outd / f'{tag}_talents_locked.png'))
    ok(pg.evaluate('() => !!document.querySelector("#tgrid .ttile.tier.locked") && /Needs 16 points/.test(document.getElementById("tinfo").textContent)'), 'Voltaic tier is locked and says it needs 16 points')
    # learn a second tier through the real button: fill Cryogenics to 16 and add its node
    got = pg.evaluate('''() => { const tr = TREE_BY_ID.C; let g = 0; while (treePts('C', 5) < 16 && g++ < 40) { const t = tr.rows.flat().find(x => !talentBlock(x.id)); if (!t) break; talentAdd(t.id); }
      Tree.select('cTop'); return talentBlock('cTop'); }''')
    ok(got == '', f'Cryogenics tier opens at 16 points (block: "{got}")')
    pg.click('#tinfo [data-tact=add]'); pg.wait_for_timeout(250)
    pg.evaluate('() => { const g = document.getElementById("tgrid"); g.scrollTop = g.scrollHeight; }'); pg.wait_for_timeout(100)
    ok(pg.evaluate('() => PROF.tal.cTop === 1'), 'Unlock tower button learns the Rimewall node')
    pg.screenshot(path=str(outd / f'{tag}_talents_learned.png'))
    pg.evaluate('() => Tree.close()'); pg.wait_for_timeout(200)
    # ---- a run from the hangar carries exactly the learned towers
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(600)
    cap = pg.evaluate('() => [G.capT.slice(), (G.recOpts.capT || []).slice(), G.frV]')
    ok(cap[0] == ['saw', 'rime'] and cap[1] == ['saw', 'rime'] and cap[2] >= 4, f'run carries the learned towers in G.capT and recOpts: {cap}')
    # the intro card for the first new tower comes through the teaching queue (pause briefings: a modal)
    pg.evaluate('() => { G.wantedTold = 1; G.paused = false; if (UI._dbg.closeModal) UI._dbg.closeModal(); }')
    for i in range(40):
        pg.wait_for_timeout(250)
        if pg.evaluate('() => !!document.querySelector("#modal .brief.intro")'): break
    txt = pg.evaluate('() => (document.querySelector("#modal .brief.intro") || {}).textContent || ""')
    ok('New tower' in txt and ('Buzzsaw' in txt or 'Rimewall' in txt), 'intro card for a new tower: ' + txt[:90])
    pg.screenshot(path=str(outd / f'{tag}_intro.png'))
    pg.evaluate('() => { const b = document.querySelector("#modal [data-act=brief]"); if (b) b.click(); }'); pg.wait_for_timeout(200)
    ok(pg.evaluate('() => !!(PROF.seenSys.capT_saw || PROF.seenSys.capT_rime)'), 'the card is marked seen once shown')
    # ---- build menu: unlocked tier towers in the grid (gold corner), the rest greyed in the strip
    def open_build():
        return pg.evaluate('''() => { if (UI._dbg.closeModal) UI._dbg.closeModal(); G.paused = true; for (const s of ['#toasts', '#tip', '#feed']) { const el = document.querySelector(s); if (el) el.style.visibility = 'hidden'; }
          const c = G.map.core; let best = null; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && (!best || Math.hypot(x - c.x, y - c.y) < Math.hypot(best[0] - c.x, best[1] - c.y))) best = [x, y];
          UI._dbg.openBuild(best[0], best[1]); return best; }''')
    spot = open_build(); pg.wait_for_timeout(300)
    n = pg.evaluate('() => [document.querySelectorAll("#panel .bt.capt").length, document.querySelectorAll("#panel .capstrip .cst").length]')
    ok(n == [2, 5], f'build menu: 2 tier towers in the grid, 5 in the locked strip ({n})')
    pg.screenshot(path=str(outd / f'{tag}_build.png'))
    pg.evaluate('() => document.querySelector("#panel .capstrip .cst[data-type=tangle]").click()'); pg.wait_for_timeout(250)
    lock = pg.evaluate('() => (document.querySelector("#panel .lockline") || {}).textContent || ""')
    ok('Unlock: Singularity capstone tier' in lock, 'a locked tier tower says how to unlock it: ' + lock)
    pg.screenshot(path=str(outd / f'{tag}_build_locked.png'))
    ok(pg.evaluate('([x, y]) => !act("build", "tangle", x, y)', spot), 'a locked tier tower cannot be built')
    # ---- every new tower fires on the field (the UI test unlocks all seven for this run)
    pg.evaluate('''() => { UI.closePanel(); G.capT = CAP_TOWERS.slice(); G.credits = 1e8; G.gridBonus = 300; G.wave = 30; G.paused = true; G.core.max = G.core.hp = 1e12;
      window.__setup = (type, D) => {
        for (const t of G.towers.slice()) sellTower(t); for (const e of G.enemies) e.dead = true; G.enemies = []; G.projs = []; G.zones = []; G.tangles = [];
        const L = G.map.lanes[0], at = {}; lanePos(L, D, at);
        const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
        spots.sort((a, b) => Math.hypot(a[0] + 0.5 - at.x, a[1] + 0.5 - at.y) - Math.hypot(b[0] + 0.5 - at.x, b[1] + 0.5 - at.y));
        const built = [];
        for (const sp of [0, 1, 2]) { const s = spots.shift(); const t = buildTower(type, s[0], s[1]); if (!t) continue; if (sp) { upgradeTower(t); upgradeTower(t); upgradeTower(t, sp); } built.push(t); }
        if (type === 'flashover') { const s = spots.shift(); if (s) buildTower('flame', s[0], s[1]); }
        if (type === 'aegis') { G.core.x = built[0].cx + 1; G.core.y = built[0].cy; }
        const walk = type === 'rime' || type === 'saw' || type === 'aegis';
        for (let i = 0; i < 9; i++) { const e = spawnEnemy(i === 4 && type !== 'saw' && type !== 'rime' ? 'flyer' : i % 2 ? 'tank' : 'drone', { L, d: Math.max(0.5, D - (walk ? 4 : 2) + i * 0.55) }); e.hp = e.maxHp = 1e9; if (!walk) e.spd = 0; else e.spd = 1.2; e.cloak = false; }
        recomputeAuras();
        const xs = built.map(t => t.cx), ys = built.map(t => t.cy);
        return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, n: built.length };
      };
      window.__step = n => { for (let i = 0; i < n; i++) { G.core.hp = G.core.max; G.paused = false; simStep(1 / 30); UI.tick(1 / 30); G.paused = true; Render.draw(1 / 30); } }; }''')
    D = pg.evaluate('() => { const L = G.map.lanes[0]; return Math.min(L.len * 0.55, Math.max(6, L.len - 8)); }')
    for fam in CAP:
        info = pg.evaluate('([t, D]) => __setup(t, D)', [fam, D])
        ok(info['n'] == 3, f'{fam}: base and both specs built ({info["n"]})')
        pg.evaluate('''([x, y]) => { Render.resetCam(); let s = Render.tileToScreen(x, y); Render.zoomAt(s.x, s.y, 2.2);
          s = Render.tileToScreen(x, y); const L = Render.layout; Render.panBy(L.W / 2 - s.x, L.H / 2 - s.y); }''', [info['cx'], info['cy']])
        pg.evaluate('() => __step(50)')
        dmg0 = pg.evaluate('() => G.towers.filter(t => CAP_TOWERS.includes(t.type)).reduce((a, t) => a + t.dmgDone, 0)')
        pg.evaluate('() => { let i = 0; for (const t of G.towers) if (t.s && t.s.rate && t.s.rate < 1 && t.s.kind !== "wall") t.cd = Math.min(t.cd, 0.05 + 0.1 * i++); }')
        pg.evaluate('() => __step(14)')
        if fam == 'aegis': pg.evaluate('() => { const e = G.enemies.find(e => !e.fly && !e.dead); if (e) leak(e); __step(2); }')
        if fam == 'joker': pg.evaluate('() => { for (const t of G.towers) if (t.type === "joker") t.jn = t.s.jack - 1; __step(30); }')
        pg.screenshot(path=str(outd / f'{tag}_fire_{fam}.png'))
        st = pg.evaluate('''(fam) => { const T = G.towers.filter(t => t.type === fam); return { dmg: G.towers.filter(t => CAP_TOWERS.includes(t.type)).reduce((a, t) => a + t.dmgDone, 0),
          wall: T.some(t => t.wall), held: G.enemies.some(e => e.jammed), charge: Math.max(...T.map(t => t.charge || 0)), links: (G.tangles || []).length, stops: G.stats.aegis || 0,
          saws: G.projs.filter(p => p.k === 'saw').length + (T.some(t => t.aimT !== undefined) ? 1 : 0) }; }''', fam)
        ok(st['dmg'] > dmg0 or fam == 'aegis', f'{fam}: deals damage on the field ({int(dmg0)} -> {int(st["dmg"])})')
        if fam == 'rime': ok(st['wall'] and st['held'], f'rime: a wall stands and holds enemies ({st})')
        if fam == 'tangle': ok(st['links'] >= 1, f'tangle: links enemies ({st["links"]} groups)')
        if fam == 'aegis': ok(st['stops'] >= 1, f'aegis: stopped a leak ({st["stops"]})')
    b.close()
print('FAILED:', fails)
print('ERRORS:', errs[:8])
