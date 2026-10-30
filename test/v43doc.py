# v4.3 Doctrines part 2: drawer with all 8, Zenith seal in the web, Circuit wires + Glacier jam + Horizon wells on the field. usage: v43doc.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v43d'
import mkpage; mkpage.mk()
errs = []
XP = 'let x=0; for (let i=0;i<LV;i++) x += 3000 + 250*i + 3*i*i; PROF.xp = x + 1;'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:3])))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { const LV = 130; ' + XP + ' PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; PROF.seenEvo = true; PROF.seenAssault = true; PROF.alloc = ["start"]; UI.renderHangar(); }')
    pg.evaluate('() => Tree.open()'); pg.wait_for_timeout(500)
    pg.click('[data-tact=docs]'); pg.wait_for_timeout(300)
    print('drawer rows:', pg.evaluate('() => document.querySelectorAll(".docrow").length'))
    pg.screenshot(path=str(out / f'{tag}01_drawer.png'))
    pg.click('[data-tact=docgo][data-n="d6"]'); pg.wait_for_timeout(1300)
    print('zenith seal info:', pg.inner_text('#tinfo')[:160].replace('\n', ' | '))
    pg.screenshot(path=str(out / f'{tag}02_zenith_seal.png'))
    pg.evaluate('() => Tree.close()'); pg.wait_for_timeout(200)
    pg.evaluate('() => { PROF.alloc = ["start"]; treeAllocate("d2"); treeAllocate("d3"); treeAllocate("d4"); UI.renderHangar(); }')
    print('seals', pg.evaluate('() => PROF.alloc.filter(id => id[0] === "d")'))
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(600)
    pg.evaluate('''() => { G.credits = 40000; const L = G.map.lanes[0], mid = L.tiles[Math.floor(L.tiles.length * 0.45)];
      const cand = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y)) cand.push([Math.abs(x - mid.x) + Math.abs(y - mid.y), x, y]);
      cand.sort((a, b) => a[0] - b[0]); const placed = [];
      for (const [d, x, y] of cand) { if (placed.length >= 5) break; if (!placed.length || placed.some(([px, py]) => Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1)) { if (buildTower(['cryo', 'pulse', 'cryo', 'lens', 'pulse'][placed.length], x, y)) placed.push([x, y]); } }
      G.wave = 10; for (let i = 0; i < 12; i++) { const e = spawnEnemy('drone', { lane: L, hpm: 60 }); e.d = Math.max(0, L.len * 0.45 - 4 + i * 0.35); }
      G.enemies[G.enemies.length - 1].st.frozen = 6; G.next = 999; }''')
    pg.wait_for_timeout(2500)
    print('chains', pg.evaluate('() => (G.chains || []).map(c => c.m.length)'), 'jammed', pg.evaluate('() => G.enemies.filter(e => e.jammed).length'), 'wells', pg.evaluate('() => (G.wells || []).length'))
    print('docbar:', pg.evaluate('() => document.querySelector("#docbar").innerText.replace(/\\n/g, " | ")'))
    pg.screenshot(path=str(out / f'{tag}03_field.png'))
    b.close()
print('ERRORS:', errs)
