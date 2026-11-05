"""6.6 perf66: a long run in the real page, watching memory and live objects.
usage: python3 longrun.py [minutes] [page.html]   (default 6 minutes of real time at 2x game speed)
A run with 36 towers placed (and upgraded) around the core plays on its own: waves come on their timer, boon picks take the
first boon, card draws stabilise, bounty doors push on, checkpoints resume, and the core is kept alive. Every 30 s it prints:
wave, enemies, JS heap after a forced GC, DOM nodes, canvases created so far, ART sprite cache size, audio sources started and
still playing, and frames drawn. A heap or count that climbs without levelling off is a leak."""
import sys, time, json, pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
mins = float(sys.argv[1]) if len(sys.argv) > 1 else 6
page = sys.argv[2] if len(sys.argv) > 2 else None
if not page: mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
INIT = '''(() => { window.__cv = 0; const ce = document.createElement.bind(document); document.createElement = (t, o) => { if (String(t).toLowerCase() === 'canvas') { window.__cv++; if (window.__cvT) { const st = new Error().stack.split('\\n').slice(2, 5).map(x => x.replace(/.*page.html:/, '').replace(/:\\d+\\)?$/, '')).join('<'); window.__cvS[st] = (window.__cvS[st] || 0) + 1; } } return ce(t, o); }; window.__cvS = {};
  window.__src = 0; window.__srcLive = 0; const AC = window.AudioContext || window.webkitAudioContext;
  for (const P of [AudioScheduledSourceNode.prototype]) { const st = P.start; P.start = function (...a) { window.__src++; window.__srcLive++; this.addEventListener('ended', () => { window.__srcLive--; }, { once: true }); return st.apply(this, a); }; }
  const raf = window.requestAnimationFrame.bind(window); window.__frames = 0; window.requestAnimationFrame = f => raf(t => { window.__frames++; f(t); }); })()'''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'])
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2)
    pg.add_init_script(INIT); pg.goto('file://' + page); pg.wait_for_timeout(800)
    cdp = pg.context.new_cdp_session(pg); cdp.send('HeapProfiler.enable')
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; PROF.settings.briefings = "off"; }')
    pg.mouse.click(5, 5)
    pg.click('#bLaunch'); pg.wait_for_timeout(300)
    pg.evaluate('() => { const s = UI._dbg.setup(); s.seed = 4242; UI._dbg.renderSetup(); }')
    pg.click('[data-act=launch]'); pg.wait_for_timeout(2000)
    pg.evaluate('''() => { window.__close = () => { const m = document.getElementById('modal'); if (!m || m.hidden) return; const bt = m.querySelector('.btn.primary') || m.querySelector('.foot button') || m.querySelector('button'); if (bt) bt.click(); };
      __close(); G.credits = 2e6; G.gridBonus = 200;
      const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
      const c = G.map.core; spots.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
      const types = TOWER_ORDER.filter(k => towerUnlocked(k)); for (let i = 0; i < 36 && spots.length; i++) { const s = spots.shift(); const t = buildTower(types[i % types.length], s[0], s[1]); if (t) for (let l = 1; l < 3; l++) upgradeTower(t, 1); }
      G.speed = 2; G.paused = false;
      let dw = 0; setInterval(() => { try { tickBot(); } catch (e) { window.__lrErr = String(e); } }, 500);
      function tickBot() { if (!G || G.over) return; G.core.hp = G.core.max; if (G.credits < 1e5) G.credits += 1e5;
        if (G.wave !== dw) { dw = G.wave; G.runMods.dmg = 300 + 120 * G.wave * G.wave; recomputeAll(); } // towers keep up with the waves (bosses end a run at the core)
        if (G.draft) act('boon', 0); if (G.anomOffers) act('stab'); if (G.huntChoice) act('push', 0); if (G.checkpoint && !G.enemies.length) act('cpResume', 3);
        if (UI.modalOpen) __close(); if (!UI.modalOpen) G.paused = false; } }''')
    def snap():  # object counts by constructor from a heap snapshot (SNAP=1)
        chunks = []; cdp.on('HeapProfiler.addHeapSnapshotChunk', lambda e: chunks.append(e['chunk']))
        cdp.send('HeapProfiler.collectGarbage'); cdp.send('HeapProfiler.takeHeapSnapshot', {'reportProgress': False})
        H = json.loads(''.join(chunks)); m = H['snapshot']['meta']; F = len(m['node_fields']); ti = m['node_fields'].index('type'); ni = m['node_fields'].index('name'); si = m['node_fields'].index('self_size')
        types = m['node_types'][0]; strs = H['strings']; N = H['nodes']; cnt = {}
        for i in range(0, len(N), F):
            t = types[N[i + ti]]
            if t in ('object', 'closure', 'array', 'native'): k = t + ':' + strs[N[i + ni]][:40]; c = cnt.get(k, [0, 0]); c[0] += 1; c[1] += N[i + si]; cnt[k] = c
        return cnt
    import os
    SNAP = os.environ.get('SNAP'); s0 = None
    def garr():
        return pg.evaluate('''() => G ? Object.entries(G).filter(([k, v]) => Array.isArray(v) && v.length > 20).map(([k, v]) => k + ':' + v.length).join(' ') : ""''')
    t0 = time.time(); n = 0
    while time.time() - t0 < mins * 60:
        pg.wait_for_timeout(30000); n += 1
        cdp.send('HeapProfiler.collectGarbage'); hu = cdp.send('Runtime.getHeapUsage')
        r = pg.evaluate('''() => ({ wave: G && G.wave, over: G && G.over, enemies: G ? G.enemies.length : 0, towers: G ? G.towers.length : 0,
          dom: document.getElementsByTagName('*').length, canvases: window.__cv,
          art: ART.cacheSize(), srcStarted: window.__src, srcLive: window.__srcLive, frames: window.__frames, rlog: G && G.rlog ? G.rlog.length : 0, e0: G ? G.enemies.slice(0, 3).map(e => e.type + ':' + (e.d || 0).toFixed(1) + ':' + Math.round(e.hp) + (e.boss ? ':B' : '')).join(' ') : '', spd: G && G.speed, err: window.__lrErr || '', halt: G && [G.paused, !!G.draft, !!G.huntChoice, !!G.checkpoint, UI.modalOpen, Tree.isOpen, UI.coachHold].join(','), inputs: G && G.inputs ? G.inputs.length : 0 })''')
        r = dict(heapMB=round(hu['usedSize'] / 1048576, 2), **r); print(f'{n * 30:4d}s', json.dumps(r), flush=True)
        if n == 2 or time.time() - t0 >= mins * 60: print('      G arrays:', garr(), flush=True)
        if n == 4: pg.evaluate('() => { window.__cvT = 1; window.__cvS = {}; }')  # canvas creation sites from 120 s on
        if n >= 5 and (n % 4 == 1 or time.time() - t0 >= mins * 60): print('      canvases made since 120 s, by call site (page lines):', pg.evaluate('() => Object.entries(window.__cvS).sort((a, b) => b[1] - a[1]).slice(0, 6)'), flush=True)
        if SNAP and n == 4: s0 = snap()
    if SNAP and s0:
        s1 = snap(); d = sorted(((k, s1.get(k, [0, 0])[0] - s0.get(k, [0, 0])[0], s1.get(k, [0, 0])[1] - s0.get(k, [0, 0])[1]) for k in set(s0) | set(s1)), key=lambda x: -x[2])
        print('heap growth from 120 s to the end, by constructor (count, bytes):')
        for k, dc, db in d[:15]: print(f'  {dc:+7d} {db:+9d}  {k}')
    b.close()
