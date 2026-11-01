"""v5.1 Know Your Enemy: the four new enemies, the inspect panel, a new-enemy card, Scan, the rail, storm outlines and
conditions, outage tags. usage: python3 enemyshot.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'v51'; out.mkdir(parents=True, exist_ok=True)
mkpage.mk(); errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 40; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 3; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; PROF.seenEvo = true; PROF.seenAssault = true; PROF.codex.enemies = {drone:1,swarmer:1,tank:1,flyer:1,splitter:1,phantom:1,medic:1,shielder:1}; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    # a few towers, then the field at Wave 30 with the newcomers
    pg.evaluate('''() => { G.credits = 1e6; const L = G.map.lanes[0]; let n = 0;
      for (const p of L.tiles.slice(2, 14)) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0]]) { const x = p.x + dx, y = p.y + dy; if (n < 6 && canBuildAt(x, y)) { buildTower(['pulse', 'cryo', 'rail', 'missile', 'coil', 'pulse'][n], x, y); n++; } }
      G.wave = 29; for (const k of ['reflector', 'carrier', 'sapper', 'leech']) ENEMIES[k].from = 1;
      G.abilOn = { strike: 1, nova: 1, stasis: 1, overclock: 1, scan: 1 }; G.charges = { strike: 2, nova: 0, stasis: 1, overclock: 0, scan: 1 }; G.abilCd = { nova: 120, overclock: 30 };
      let k = 0; for (const t of ['reflector', 'carrier', 'sapper', 'leech', 'medic', 'shielder', 'tank', 'phantom']) { const e = spawnEnemy(t, { lane: L, hpm: 1 }); e.d = 2 + k * 1.3; e.hp = e.maxHp = 5e6; k++; }
      for (let i = 0; i < 40; i++) simStep(1/30);
      G.paused = true; const e = G.enemies[1]; const p = Render.tileToScreen(e.x, e.y); Render.zoomAt(p.x, p.y, 1.8); }''')
    pg.wait_for_timeout(400); pg.screenshot(path=str(out / 'enemies.png'))
    # inspect: tap the reflector
    pos = pg.evaluate('() => { const e = G.enemies.find(e => e.type === "reflector"); const p = Render.tileToScreen(e.x, e.y); const r = document.querySelector("#cv").getBoundingClientRect(); return [r.left + p.x * UIS, r.top + p.y * UIS]; }')
    pg.touchscreen.tap(pos[0], pos[1]); pg.wait_for_timeout(400); pg.screenshot(path=str(out / 'inspect.png'))
    pg.evaluate('() => document.querySelector("[data-act=close]") && document.querySelector("[data-act=close]").click()')
    # scan
    pg.evaluate('() => { G.paused = false; useAbility("scan"); for (let i = 0; i < 10; i++) simStep(1/30); G.paused = true; }'); pg.wait_for_timeout(500); pg.screenshot(path=str(out / 'scan.png'))
    # storm over the towers, a sapped tower, the conditions line
    pg.evaluate('''() => { const t = G.towers[0]; G.storms = []; spawnStorm(['ion'], t.cx, t.cy, 0, 0); G.towers[1].disabled = 4; G.towers[1].disCause = 'SAPPED'; G.ev = Object.assign({}, G.ev, { blackout: 1 });
      for (let i = 0; i < 3; i++) simStep(1/30); G.paused = true; }''')
    tw = pg.evaluate('() => { const t = G.towers.find(t => t.type === "coil") || G.towers[0]; const p = Render.tileToScreen(t.cx, t.cy); const r = document.querySelector("#cv").getBoundingClientRect(); return [r.left + p.x * UIS, r.top + p.y * UIS]; }')
    pg.touchscreen.tap(tw[0], tw[1]); pg.wait_for_timeout(400); pg.screenshot(path=str(out / 'storm.png'))
    pg.evaluate('() => document.querySelector("[data-act=close]") && document.querySelector("[data-act=close]").click()')
    # new-enemy card
    pg.evaluate("() => { PROF.settings.briefings = \"pause\"; Hooks.newEnemy(\"carrier\"); }"); pg.wait_for_timeout(700); pg.screenshot(path=str(out / 'card.png'))
    pg.evaluate('() => document.querySelector("[data-act=brief]") && document.querySelector("[data-act=brief]").click()')
    b.close()
print('ERRORS:', errs[:5])
