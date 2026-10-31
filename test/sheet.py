"""Sprite sheet for art iteration: every tower (3 specs x 2 headings) and every enemy (4 frames), scaled up.
usage: python3 sheet.py [tag]  -> test/out/sheet_<tag>_towers.png, sheet_<tag>_enemies.png"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
tag = sys.argv[1] if len(sys.argv) > 1 else 'cur'
mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('''() => {
      document.body.innerHTML = ''; document.body.style.background = '#0d1022';
      const cv = document.createElement('canvas'); cv.id = 'sheet'; cv.width = 1400; cv.height = 900; document.body.appendChild(cv);
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#141831'; g.fillRect(0, 0, 1400, 900);
      g.font = '12px monospace'; g.fillStyle = '#8a8fa8';
      const types = TOWER_ORDER, Z = 2;
      types.forEach((ty, r) => {
        const el = TOWERS[ty].el, y = 4 + r * 74;
        g.fillText(ty, 4, y + 40);
        let x = 70;
        for (const spec of [0, 1, 2]) for (const ang of [-0.6, 2.2]) {
          const anim = { ld: 1, rk: 0, ph: 0 };
          g.drawImage(UNITS.base(el), x + 4 * Z, y + 4 * Z - 4, 52 * Z / 2 * 1.0 * 1, 52 * Z / 2);
          const t = UNITS.top(ty, el, spec, UNITS.ROT[ty] ? ang : ang * 0.3, anim);
          g.drawImage(t, x, y - 4, 60 * Z / 2, 60 * Z / 2);
          // the same at 2x for detail
          x += 70;
        }
        // one big one
        g.drawImage(UNITS.base(el), x + 8, y - 4 + 8 - 8, 104 * 0.68, 104 * 0.68);
        g.drawImage(UNITS.top(ty, el, 0, UNITS.ROT[ty] ? -0.4 : 0, { ld: 1 }), x, y - 8, 120 * 0.68, 120 * 0.68);
        // other elements for the plain version
        x += 90;
        for (const e2 of ['K', 'T', 'C', 'A', 'V']) { g.drawImage(UNITS.base(e2), x + 4, y, 52, 52); g.drawImage(UNITS.top(ty, e2, 0, -0.6, { ld: 1 }), x, y - 4, 60, 60); x += 64; }
      });
    }''')
    pg.wait_for_timeout(200)
    pg.locator('#sheet').screenshot(path=str(out / f'sheet_{tag}_towers.png'))
    pg.evaluate('''() => {
      const cv = document.getElementById('sheet'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#141831'; g.fillRect(0, 0, 1400, 900); g.fillStyle = '#251c3d'; g.fillRect(0, 0, 1400, 900);
      g.font = '12px monospace';
      const types = ['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'phantom', 'medic', 'shielder', 'voidling'];
      types.forEach((ty, r) => {
        const y = 6 + r * 98; g.fillStyle = '#c8c4e0'; g.fillText(ty, 4, y + 44);
        let x = 80;
        for (let f = 0; f < 4; f++) { const s = UNITS.enemy(ty, 0, f); g.drawImage(s, x, y, s.width * 2, s.height * 2); x += 100; }
        for (const a of [1.57, 3.14, -0.78]) { const s = UNITS.enemy(ty, a, 0); g.drawImage(s, x, y, s.width * 2, s.height * 2); x += 100; }
        // in-game scale (1 css px per world unit at dpr 2 -> sprite px)
        const s = UNITS.enemy(ty, 0, 0); g.drawImage(s, x + 20, y + 20, s.width, s.height);
      });
    }''')
    pg.locator('#sheet').screenshot(path=str(out / f'sheet_{tag}_enemies.png'))
    pg.evaluate('''() => {
      const cv = document.getElementById('sheet'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#251c3d'; g.fillRect(0, 0, 1400, 900);
      const ids = ['behemoth', 'queen', 'wraith', 'overmind', 'titan', 'cat', 'gloop', 'whale', 'duck', 'fsm', 'worm', 'auditor', 'snail'];
      ids.forEach((id, i) => { const x = (i % 5) * 280, y = Math.floor(i / 5) * 300; const s = UNITS.boss(id, 0); g.drawImage(s, x, y, 148 * 1.5, 148 * 1.5); const s2 = UNITS.boss(id, 1); g.drawImage(s2, x + 200, y + 200, 74, 74); });
      g.drawImage(UNITS.boss('cat', 0, 1), 1150, 650, 148, 148); g.drawImage(UNITS.wormSeg(), 1150, 820, 66, 66); g.drawImage(UNITS.meat(), 1250, 820, 56, 56);
    }''')
    pg.locator('#sheet').screenshot(path=str(out / f'sheet_{tag}_bosses.png'))
    b.close()
print('ERRORS:', errs[:10])
