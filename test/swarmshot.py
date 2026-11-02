"""v5.8 the visible swarm: gene marks on the field (phone and iPad), a crowd, Strain Assault outlines, the Threat Board's
Arms Race strip, the recap's swarm timeline, the Archive's Swarm Collection (migration, recording, NEW), and that ghost runs
record nothing. usage: python3 swarmshot.py   -> screenshots test/out/swarm_*.png, prints FAIL lines and ERRORS: [...]"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out'
mkpage.mk(); errs = []; fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
GENES_ORDER = ['plating', 'wings', 'haste', 'bulk', 'brood', 'shell', 'regen', 'ward', 'cloak']
LINEUP = '''(opts) => { const L = G.map.lanes[0]; G.wave = 30; G.enemies.length = 0; G.queue.length = 0;
  const gs = GS_HERE; let k = 0;
  const put = (type, q, gap) => { const e = spawnEnemy(type, Object.assign({ lane: L }, q)); e.d = Math.max(0.5, e.L.len - 2.2 - k * gap); k++; return e; };
  for (const g of gs) { const e = put('drone', { genes: [g], gel: 'T' }, opts.gap); if (g === 'cloak') { e.cloakT = 50; e.cloaked = false; } }
  if (opts.assault) { G.assault = { w: 30, genes: ['plating', 'haste'], el: null, key: 'haste+plating', state: 'live', n: 3, killed: 0, leaked: 0, name: 'Plated Zippy Strain' };
    for (let i = 0; i < 3; i++) put(['drone', 'splitter', 'medic'][i], { genes: ['plating', 'haste'], assault: 1 }, opts.gap); }
  if (opts.pairs) for (const p of [['shell', 'ward'], ['plating', 'regen'], ['wings', 'haste'], ['bulk', 'brood']]) put('drone', { genes: p, gel: 'A' }, opts.gap);
  for (let i = 0; i < 2; i++) simStep(1 / 30);
  G.paused = true; Render.resetCam();
  // lay them out in rows on screen, facing right, each with a label (DOM, for review only)
  const cv = document.querySelector('#cv'), rc = cv.getBoundingClientRect(), L0 = Render.layout, sx = rc.width / L0.W;
  const tp = Render.tileToScreen(1, 0).x - Render.tileToScreen(0, 0).x, per = opts.per || 8, gapx = tp * 2.0, gapy = tp * 2.2;
  document.querySelectorAll('.swlbl').forEach(n => n.remove());
  G.enemies.forEach((e, i) => { const px = L0.W * 0.18 + (i % per) * gapx, py = L0.H * 0.3 + Math.floor(i / per) * gapy, t = Render.screenToTile(px, py);
    e.x = t.x; e.y = t.y + (e.fly ? 7 / TILE : 0); e._hx = e.x; e._hy = e.y; e._ha = 0; e.cloaked = false; if (e.genes && e.genes.includes('cloak')) e.cloakT = 50;
    const d = document.createElement('div'); d.className = 'swlbl'; d.textContent = (e.assault ? 'A:' : '') + (e.genes || []).join('+');
    d.style.cssText = `position:fixed;z-index:99;pointer-events:none;font:9px monospace;color:#fff;background:#000a;padding:0 2px;left:${rc.left + px * sx - 20}px;top:${rc.top + py * sx + tp * 0.75 * sx}px`;
    document.body.appendChild(d); });
  return G.enemies.length; }'''.replace('GS_HERE', repr(GENES_ORDER).replace("'", '"'))

def start(pg):
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenEvo = true; PROF.seenAssault = true; PROF.settings.briefings = "off"; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(200); pg.click('[data-act=launch]'); pg.wait_for_timeout(500)
    pg.evaluate('() => { if (UI.closeModal) UI.closeModal(); }')

def lineup(pg, tag, W, H):
    n = pg.evaluate(LINEUP, {'gap': 1.0, 'assault': True, 'pairs': True}); pg.wait_for_timeout(350)
    check(n == len(GENES_ORDER) + 3 + 4, f'{tag}: lineup spawned {n}')
    pg.screenshot(path=str(out / f'swarm_{tag}_genes.png'))
    pg.evaluate("() => document.querySelectorAll('.swlbl').forEach(n => n.remove())")
    # a close crop around the lineup at the same (default) zoom, scaled up for review
    box = pg.evaluate('''() => { const ps = G.enemies.map(e => Render.tileToScreen(e.x, e.y)); const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }''')
    x0, y0, x1, y1 = box; pad = 26
    clip = {'x': max(0, x0 - pad), 'y': max(0, y0 - pad), 'width': min(W, x1 + pad) - max(0, x0 - pad), 'height': min(H, y1 + pad) - max(0, y0 - pad)}
    if clip['width'] > 10 and clip['height'] > 10: pg.screenshot(path=str(out / f'swarm_{tag}_genes_crop.png'), clip=clip)
    return box

CROWD = """() => { const L = G.map.lanes[0]; G.enemies.length = 0; G.wave = 40; const types = ['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic', 'phantom', 'shielder'];
  const GS = [['plating', 'shell'], ['haste', 'regen'], ['ward', 'bulk'], ['cloak', 'haste'], ['wings', 'regen'], ['brood', 'ward'], ['shell'], ['plating', 'haste', 'regen'], []];
  for (let i = 0; i < 60; i++) { const ty = types[i % types.length], q = { lane: L, genes: GS[i % GS.length].filter(g => geneOk(ty, g, 40)), gel: ['K', 'T', 'A'][i % 3], d: ((i * 0.37) % 1) * Math.min(L.len, L.fly ? L.fly.len : L.len) * 0.9 };
    const e = spawnEnemy(ty, q); }
  for (let i = 0; i < 4; i++) simStep(1 / 30); G.paused = true; Render.resetCam(); return G.enemies.length; }"""

THREAT_SETUP = """() => { G.intel = { type: { pulse: 900, missile: 300, cryo: 60 }, el: { K: 900, T: 260, C: 60, A: 12 }, el0: {} };
  G.geneHist = [{ w: 27, g: { plating: 0.12, shell: 0.3, ward: 0.08 } }, { w: 28, g: { plating: 0.2, shell: 0.28 } }, { w: 29, g: { plating: 0.3, shell: 0.2, ward: 0.15 } }, { w: 30, g: { plating: 0.38, shell: 0.18, ward: 0.22 } }];
  G.stats.gTier = { plating: 2, shell: 1, ward: 1 };
  G.assault = { w: 31, genes: ['plating', 'shell'], el: null, key: 'plating+shell', state: 'warn', n: 0, killed: 0, leaked: 0, name: 'Plated Bubbled Strain', why: ['only 9% of your fire pierces armour'] };
  UI._dbg.openThreat(); return !!document.querySelector('#modal .arms'); }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for tag, W, H in [('phone', 852, 393), ('ipad', 1180, 820)]:
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=3 if tag == 'phone' else 2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        start(pg); lineup(pg, tag, W, H)
        # 60 evolved enemies on the default view: marks must stay legible, not noisy
        n = pg.evaluate(CROWD); pg.wait_for_timeout(300); check(n >= 55, f'{tag}: crowd of {n}')
        pg.screenshot(path=str(out / f'swarm_{tag}_crowd.png'))
        marks = pg.evaluate('() => G.enemies.filter(e => e._gmOn).map(e => e._gmOn.length)')
        check(len(marks) > 30 and max(marks) <= 2, f'{tag}: marked units {len(marks)}, at most {max(marks) if marks else 0} marks each (crowded field shows 1)')
        # the Threat Board opens on the Arms Race strip
        ok = pg.evaluate(THREAT_SETUP); pg.wait_for_timeout(300)
        check(ok, f'{tag}: Threat Board has the Arms Race strip')
        first = pg.evaluate('() => (document.querySelector("#modal .cbody .lbl, #modal .lbl") || {}).textContent || ""')
        check(first.startswith('Arms Race'), f'{tag}: Arms Race is the first section ({first[:30]})')
        rows = pg.evaluate('() => [...document.querySelectorAll("#modal .armrow b")].map(b => b.textContent)')
        check(len(rows) >= 2, f'{tag}: arms rows {rows}')
        icons = pg.evaluate('() => [...document.querySelectorAll("#modal canvas[data-gico]")].filter(c => c.dataset.sized).length')
        check(icons >= 9, f'{tag}: gene icons drawn {icons}')
        pg.screenshot(path=str(out / f'swarm_{tag}_threat.png'))
        pg.evaluate('() => UI._dbg.closeModal()')
        pg.close()
    # ---- Swarm Collection: migration, recording in real runs only, the Archive grid, then the recap timeline ----
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    start(pg)
    m = pg.evaluate("""() => { const old = { v: 1, bestWave: 60, codex: { combos: {}, strains: { 'drone:plating': { n: 3, w: 9 }, 'drone:haste+wings': { n: 1, w: 20 },
        'tank:brood+cloak+regen': { n: 2, w: 50 }, 'flyer:ward|K': { n: 1, w: 30 }, 'bogus:plating': { n: 1, w: 1 }, 'drone:': { n: 1, w: 1 } } } };
      const p = Save.merge(old), C = p.codex, gi = g => GENE_IDS.indexOf(g);
      const r = { v: C.collV, plating: +C.coll.drone[gi('plating')], haste: +C.coll.drone[gi('haste')], wings: +C.coll.drone[gi('wings')],
        brood: +C.coll.tank[gi('brood')], ward: +C.coll.flyer[gi('ward')], combo: C.collC['haste+wings'], combo2: C.collC['brood+cloak'], nnew: C.collNew.length,
        kept: Object.keys(C.strains).length, have: collHave(C), max: collMax() };
      const again = Save.merge(JSON.parse(JSON.stringify(p))); r.idem = collHave(again.codex) === r.have;
      PROF.codex = C; return r; }""")
    print('migration:', m)
    check(m['v'] == 1 and m['plating'] == 1 and m['haste'] == 2 and m['wings'] == 2 and m['brood'] == 3 and m['ward'] == 1, 'old strains migrate into collection cells')
    check(m['combo'] == 'drone' and m['combo2'] == 'tank' and m['nnew'] == 0 and m['kept'] == 6 and m['idem'], 'named pairs migrate, nothing flagged NEW, old list kept, merge is idempotent')
    check(m['max'] > 250 and 0 < m['have'] < m['max'], f"collection is finite: {m['have']}/{m['max']}")
    rec = pg.evaluate("""() => { const C = PROF.codex, before = (C.coll.medic || ''), r0 = G.r ? G.seed : 0;
      spawnEnemy('splitter', { genes: ['shell', 'regen'] });
      const real = { cell: C.coll.splitter, combo: C.collC['regen+shell'], fresh: C.collNew.slice() };
      G.replaying = true; spawnEnemy('medic', { genes: ['bulk'] }); G.replaying = false;
      G.watch = true; spawnEnemy('medic', { genes: ['haste'] }); G.watch = false;
      return Object.assign(real, { ghost: C.coll.medic || '' , ghostBefore: before }); }""")
    print('recording:', rec)
    check(bool(rec['cell']) and rec['combo'] == 'splitter' and 'splitter.shell' in rec['fresh'] and 'c:regen+shell' in rec['fresh'], 'a real run records the sighting and flags it NEW')
    check(rec['ghost'] == rec['ghostBefore'], 'replays and watch mode record nothing')
    pg.evaluate('() => { G.paused = true; UI._dbg.openArchive(); }'); pg.wait_for_timeout(400)
    a = pg.evaluate("""() => ({ grid: !!document.querySelector('#modal .collgrid'), cells: document.querySelectorAll('#modal .ccell:not(.x)').length,
      newc: document.querySelectorAll('#modal .ccell.new, #modal .collc span.new').length, lbl: (document.querySelector('#modal .coll .lbl') || {}).textContent || '',
      cleared: PROF.codex.collNew.length })""")
    print('archive:', a)
    check(a['grid'] and a['cells'] * 3 + 12 == m['max'], f"Archive grid has every cell ({a['cells']})")
    check(a['newc'] >= 2 and 'NEW' in a['lbl'] and '%' in a['lbl'] and a['cleared'] == 0, 'Archive shows % complete and NEW entries, then clears NEW')
    pg.evaluate("() => document.querySelector('#modal .coll').scrollIntoView()"); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / 'swarm_archive.png'))
    pg.evaluate('() => UI._dbg.closeModal()')
    # recap: a run's adaptations on a timeline, and the strain that ended it
    pg.evaluate("""() => { G.wave = 47; G.startWave = 1; G.stats.evo = [[9, 'plating', 1], [12, 'haste', 1], [15, 'plating', 2], [21, 'shell', 1], [26, 'wings', 1], [30, 'plating', 3], [33, 'ward', 2], [41, 'shell', 2]];
      G.stats.assaults = { won: 2, lost: 1, list: [{ w: 14, name: 'Plated Strain', won: true, genes: ['plating', 'haste'] }, { w: 22, name: 'Bubbled Zippy Strain', won: true, genes: ['shell', 'haste'] }, { w: 38, name: 'Gunship Strain', won: false, genes: ['plating', 'wings'] }] };
      G.leakWave = { 'drone+plating+wings': 6, drone: 2 }; G.paused = false; act('abandon'); }""")
    pg.wait_for_timeout(1600)
    r = pg.evaluate("""() => ({ open: UI.modalOpen, tl: document.querySelectorAll('#modal .sxtl i, #modal .sxtl b').length, chips: document.querySelectorAll('#modal .sxc').length,
      end: (document.querySelector('#modal .sxend') || {}).textContent || '', rec: G.rec && G.rec.endStrain && G.rec.endStrain.name })""")
    print('recap:', r)
    check(r['tl'] == 11 and r['chips'] >= 5, f"recap timeline has 8 gains and 3 assaults ({r['tl']} marks, {r['chips']} chips)")
    check('Gunship' in r['end'], f"recap names the strain that ended the run ({r['end'].strip()[:60]})")
    pg.evaluate("() => { const el = document.querySelector('#modal .sxtl'); if (el) el.scrollIntoView({ block: 'center' }); }"); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / 'swarm_recap.png'))
    pg.close()
    b.close()
print('FAILED:', fails)
print('ERRORS:', errs[:5])
