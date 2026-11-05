"""6.6 perf66: UI and idle cost in the real page (852x393 at 3x).
usage: python3 uiperf.py [page.html] [secs]
1. Battle (the drawbench mid scene, unpaused at 1x, the real game loop): per second, DOM mutation records (by target),
   style recalcs, layouts and the main-thread busy time (CDP Performance metrics).
2. Idle: the hangar, a paused run (Pause menu open), Settings open over a paused run, the Talents web, and a hidden page
   (document.hidden forced and visibilitychange sent): main-thread busy ms per second, frames drawn per second, and
   the audio context state.
Prints one dict per section."""
import sys, time, json, pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
page = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].endswith('.html') else None
secs = float([a for a in sys.argv[1:] if not a.endswith('.html')][0]) if [a for a in sys.argv[1:] if not a.endswith('.html')] else 8
if not page: mkpage.mk(); page = str(root / 'test' / 'out' / 'page.html')
INIT = '''(() => { const raf = window.requestAnimationFrame.bind(window); window.__frames = 0; window.__drawn = 0;
  window.requestAnimationFrame = f => raf(t => { window.__frames++; f(t); });
  window.__mut = {}; window.__mutN = 0;
  new MutationObserver(list => { for (const m of list) { window.__mutN++; let t = m.target; if (t.nodeType === 3) t = t.parentNode; let k = '';
    for (let n = t, d = 0; n && n.nodeType === 1 && d < 4; n = n.parentNode, d++) if (n.id) { k = '#' + n.id + (d ? '>' + (t.className && typeof t.className === 'string' ? '.' + t.className.split(' ')[0] : t.tagName) : ''); break; }
    k = (k || t.tagName) + ' ' + m.type + (m.attributeName ? ':' + m.attributeName : ''); window.__mut[k] = (window.__mut[k] || 0) + 1; } })
    .observe(document, { subtree: true, attributes: true, childList: true, characterData: true }); })()'''
def metrics(cdp):
    m = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
    return m
def window_(pg, cdp, s):
    pg.evaluate('() => { window.__frames = 0; window.__mut = {}; window.__mutN = 0; if (window.Render) Render.__d0 = 0; }')
    a = metrics(cdp); t0 = time.time(); pg.wait_for_timeout(int(s * 1000)); dt = time.time() - t0; b = metrics(cdp)
    js = pg.evaluate('() => ({ frames: window.__frames, mutN: window.__mutN, mut: Object.entries(window.__mut).sort((a, b) => b[1] - a[1]).slice(0, 14), audio: SFX.state })')
    return { 'busyMsPerSec': round((b['TaskDuration'] - a['TaskDuration']) / dt * 1000, 1), 'scriptMsPerSec': round((b['ScriptDuration'] - a['ScriptDuration']) / dt * 1000, 1),
             'layoutsPerSec': round((b['LayoutCount'] - a['LayoutCount']) / dt, 1), 'layoutMsPerSec': round((b['LayoutDuration'] - a['LayoutDuration']) / dt * 1000, 2), 'styleMsPerSec': round((b['RecalcStyleDuration'] - a['RecalcStyleDuration']) / dt * 1000, 2), 'styleRecalcsPerSec': round((b['RecalcStyleCount'] - a['RecalcStyleCount']) / dt, 1),
             'framesPerSec': round(js['frames'] / dt, 1), 'domMutationsPerSec': round(js['mutN'] / dt, 1), 'audio': js['audio'],
             'topMutations': [(k, round(v / dt, 1)) for k, v in js['mut']] }
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=3)
    pg.add_init_script(INIT); pg.goto('file://' + page); pg.wait_for_timeout(800)
    cdp = pg.context.new_cdp_session(pg); cdp.send('Performance.enable')
    pg.evaluate('() => { PROF.bestWave = 60; PROF.seenHelp = true; PROF.xp = 900000; PROF.runs = 5; PROF.seenVer = VERSION; }')
    pg.mouse.click(5, 5); pg.wait_for_timeout(300)  # a gesture so the audio context runs
    pg.wait_for_timeout(1500)
    out = {}
    out['hangar'] = window_(pg, cdp, secs)
    pg.click('#bLaunch'); pg.wait_for_timeout(300)
    pg.evaluate('() => { const s = UI._dbg.setup(); s.seed = 4242; UI._dbg.renderSetup(); }')
    pg.click('[data-act=launch]'); pg.wait_for_timeout(1800)
    pg.evaluate('''() => { if (UI.closeModal) UI.closeModal(); G.credits = 1e7; G.gridBonus = 200; G.wave = 30;
      const spots = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) spots.push([x, y]);
      const c = G.map.core; spots.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
      const types = Object.keys(TOWERS); for (let i = 0; i < 36 && spots.length; i++) { const s = spots.shift(); buildTower(types[i % types.length], s[0], s[1]); }
      for (let i = 0; i < 90; i++) { const ty = ['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic'][i % 6]; const e = spawnEnemy(ty, { d: (i * 0.37) % 25 }); if (e) e.maxHp = e.hp = 1e12; }
      G.core.max = G.core.hp = 1e12; G.paused = false; G.speed = 1; }''')
    pg.wait_for_timeout(1500); pg.evaluate('() => { if (UI.closeModal) UI.closeModal(); G.paused = false; }')
    out['battle'] = window_(pg, cdp, secs)
    pg.evaluate('() => UI._dbg.openPause()'); pg.wait_for_timeout(500)
    out['pause'] = window_(pg, cdp, secs)
    pg.evaluate('() => UI._dbg.openSettings()'); pg.wait_for_timeout(500)
    out['settings'] = window_(pg, cdp, secs)
    pg.evaluate('() => { if (UI.closeModal) UI.closeModal(); Tree.open(); }'); pg.wait_for_timeout(500)
    out['talents'] = window_(pg, cdp, secs)
    pg.evaluate('() => { Tree.close(); if (UI.closeModal) UI.closeModal(); }'); pg.wait_for_timeout(300)
    pg.evaluate('''() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }''')
    pg.wait_for_timeout(500)
    out['hidden (rAF still runs headless; see audio)'] = window_(pg, cdp, secs)
    b.close()
for k, v in out.items(): print(k, json.dumps(v))
