"""6.3 zone looks (zone63): every zone's battlefield at phone and iPad size with towers and a wave on the field, the board zoomed
out (the backdrop past the map edge), the "Entering" banner at run start (clear of every control), a jump door picker with the
zone swatches, taking a door (the banner and the wipe from the core), the New Run zone buttons, the Zone effects setting (off
stops the ambient layer and keeps the palette). Also checks that every zone's ground reads as its own colour.
Screenshots in test/out/zone63/. usage: python3 zone63shot.py [WxH ...]  (default 667x375 1180x820)"""
import pathlib, sys, itertools
from playwright.sync_api import sync_playwright
from PIL import Image
import mkpage
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out' / 'zone63'; out.mkdir(parents=True, exist_ok=True)
sizes = [tuple(int(v) for v in a.split('x')) for a in sys.argv[1:]] or [(667, 375), (1180, 820)]
ZONES = ['drift', 'hive', 'iron', 'skies', 'ghost', 'salvage', 'tempest', 'demo', 'choir', 'oddball']
mkpage.mk(); errs = []; fails = []
def check(cond, msg, tag):
    print(('ok   ' if cond else 'FAIL ') + f'{tag}: {msg}')
    if not cond: fails.append(f'{tag}: {msg}')
SEEN = '{v58:1,storm:1,crate:1,vet:1,abil:1,upg:1,power:1,spare:1,wormhole:1,anomaly:1,boss:1,market:1,support:1,tech:1,frontier:1}'
PREP = f'''() => {{ PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.bestWave = 40; PROF.runs = 6; PROF.runSnap = null; PROF.seenSys = {SEEN};
  PROF.settings.briefings = "off"; PROF.settings.notes = "off"; PROF.tut = Object.assign(PROF.tut || {{}}, {{ seen: 1, done: 1 }}); UI.renderHangar(); }}'''
def start(pg, z):
    pg.evaluate('() => { if (UI.screen !== "hangar") { G = null; UI.show("hangar"); } }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    pg.evaluate(f'() => {{ const s = UI._dbg.setup(); s.seed = 4242; s.map = genMap(mulberry32(4242)); s.secSeed = s.seed; s.secOffers = ["{z}"].concat(["iron", "hive", "skies"].filter(v => v !== "{z}")).slice(0, 3); s.sector = "{z}"; UI._dbg.renderSetup(); }}')
    pg.evaluate('() => document.querySelector("[data-act=launch]").click()'); pg.wait_for_timeout(150)
BUSY = '''() => { document.querySelectorAll("#modal [data-act=brief], #modal [data-act=close]").forEach(b => b.click());
  G.credits = 1e6; const c = G.map.core, sp = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y) && inRegion(x, y, G.region)) sp.push([x, y]);
  sp.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
  const ty = ['pulse', 'rail', 'cryo', 'flame', 'missile', 'coil', 'emp', 'pulse']; for (let i = 0; i < 7 && sp.length; i++) { const s = sp.splice(i * 2, 1)[0]; if (s) window.act('build', ty[i % ty.length], s[0], s[1]); }
  for (let i = 0; i < 40; i++) spawnEnemy(['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic', 'phantom', 'leech'][i % 8], { d: 2 + (i * 0.61) % 22 });
  G.paused = false; }'''
def wipe_done(pg):
    pg.wait_for_function('() => !Render.zoneWipe', timeout=6000)
def ground_rgb(path, W, H):
    im = Image.open(path).convert('RGB'); w, h = im.size
    box = im.crop((int(w * 0.2), int(h * 0.25), int(w * 0.8), int(h * 0.9))).resize((1, 1), Image.BOX)
    return box.getpixel((0, 0))
HITS = '''() => { const vis = el => { if (!el) return null; const cs = getComputedStyle(el); if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden') return null; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const z = vis(document.querySelector('#zoneBan')); if (!z) return ['banner not shown'];
  const out = []; for (const s of ['#bLift', '#bReady', '#railL', '#railR', '#abils', '#hud', '#chips', '#panel', '#bMusic', '#cpBanner', '#docbar']) { const q = vis(document.querySelector(s)); if (q && hit(z, q)) out.push('banner x ' + s); }
  const st = document.querySelector('#stage').getBoundingClientRect(); if (z.left < st.left || z.right > st.right) out.push('banner off the stage');
  if (getComputedStyle(document.querySelector('#zoneBan')).pointerEvents !== 'none') out.push('banner takes taps');
  return out; }'''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W, H in sizes:
        tag = f'{W}x{H}'
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errs.append(f'{tag}: {e}'))
        pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
        pg.evaluate(PREP)
        # 1. the New Run zone buttons and the map preview in the picked zone's look
        pg.click('#bLaunch'); pg.wait_for_timeout(250)
        pg.evaluate('() => { const s = UI._dbg.setup(); s.secSeed = s.seed; s.secOffers = ["hive", "choir", "tempest"]; s.sector = "choir"; UI._dbg.renderSetup(); }')
        pg.screenshot(path=str(out / f'z00_setup_{tag}.png'))
        n = pg.evaluate('() => [...document.querySelectorAll("#modal .secb canvas.zsw")].filter(c => { const d = c.getContext("2d").getImageData(c.width / 2, c.height / 2, 1, 1).data; return d[3] > 0; }).length')
        check(n == 3, f'New Run: 3 zone buttons carry a painted swatch ({n})', tag)
        pg.evaluate('() => UI._dbg.closeModal()')
        # 2. every zone, at home zoom, busy
        cols = {}
        for z in ZONES:
            start(pg, z)
            if z == ZONES[0]:
                pg.wait_for_timeout(500)
                check(pg.evaluate('() => !!Render.zoneWipe'), 'run start: the board washes into the zone', tag)
                pg.screenshot(path=str(out / f'z01_wipe_runstart_{tag}.png'))
                pg.wait_for_timeout(250)
                v = pg.evaluate(HITS); check(not v, f'run start banner shown, clear of controls {v}', tag)
                txt = pg.inner_text('#zoneBan')
                check('QUIET DRIFT' in txt.upper() and 'ENTERING' in txt.upper(), f'banner text: {txt!r}', tag)
                pg.screenshot(path=str(out / f'z02_banner_{tag}.png'))
                pg.wait_for_timeout(2900)
                check(pg.evaluate('() => document.querySelector("#zoneBan").hidden'), 'banner gone after about 2.5 s', tag)
            wipe_done(pg)
            pg.evaluate(BUSY); pg.wait_for_timeout(1500)
            pg.evaluate('() => { G.paused = true; }'); pg.wait_for_timeout(120)
            path = out / f'z10_{z}_{tag}.png'; pg.screenshot(path=str(path)); cols[z] = ground_rgb(path, W, H)
            if W >= 1000 or z in ('skies', 'tempest', 'hive'):
                pg.evaluate('() => { Render.overview(); Render.zoomAt(Render.layout.W / 2, Render.layout.H / 2, 0.01); UI.zoomChanged(); }'); pg.wait_for_timeout(250)
                pg.screenshot(path=str(out / f'z11_{z}_out_{tag}.png'))
                pg.evaluate('() => { Render.resetCam(); UI.zoomChanged(); }')
        # every pair of zones differs in its overall field colour (RGB distance)
        close = [(a, c, round(sum((x - y) ** 2 for x, y in zip(cols[a], cols[c])) ** 0.5, 1)) for a, c in itertools.combinations(ZONES, 2)]
        worst = min(close, key=lambda t: t[2])
        print(f'     field colours: {cols}')
        check(worst[2] >= 6, f'closest pair of zone fields {worst[0]}/{worst[1]} differ by {worst[2]} (want >= 6)', tag)
        # 3. a jump door picker (three doors with swatches), then taking a door: banner, wipe from the core, new palette
        pg.evaluate('''() => { G.paused = false; G.huntChoice = { w: G.wave, name: 'Test Bounty', cr: 500, next: 40, nextName: 'Behemoth', purse: 1000,
          doors: [{ sector: 'choir', tier: 0, mult: 1.25, wanted: 'Colossal Immortal Snail' }, { sector: 'demo', tier: 1, mult: 1.4, wanted: 'Hasted Overmind' }, { sector: 'ghost', tier: 2, mult: 1.6, wanted: 'Spectral Phase Wraith' }] };
          G.purse = 1000; UI._dbg.openHunt(); }''')
        pg.wait_for_timeout(300)
        n = pg.evaluate('() => [...document.querySelectorAll("#modal .hopt.door canvas.zsw")].filter(c => c.getBoundingClientRect().width > 20).length')
        check(n == 3, f'door picker: 3 doors show their zone swatch ({n})', tag)
        ov = pg.evaluate('() => { const m = document.querySelector("#modal .card"); return m ? m.scrollHeight - m.clientHeight : -1; }')
        print(f'     door card overflow {ov}px (the card scrolls when needed)')
        pg.screenshot(path=str(out / f'z20_doors_{tag}.png'))
        pg.click('#modal .hopt.door[data-v="0"]'); pg.wait_for_timeout(420)
        check(pg.evaluate('() => G.sector === "choir" && !!Render.zoneWipe'), 'door taken: Green Choir, the board re-tints', tag)
        pg.screenshot(path=str(out / f'z21_door_wipe_{tag}.png'))
        v = pg.evaluate(HITS); check(not v and 'GREEN CHOIR' in pg.inner_text('#zoneBan').upper(), f'door banner shown, clear of controls {v}', tag)
        wipe_done(pg); pg.wait_for_timeout(200)
        pg.screenshot(path=str(out / f'z22_door_after_{tag}.png'))
        # 4. the core panel's zone line
        pg.evaluate('() => { UI._dbg.openCore(); }'); pg.wait_for_timeout(250)
        pg.evaluate('() => { const t = document.querySelector("#panel [data-act=tab][data-v=info], #panel [data-tab=info]"); if (t) t.click(); }'); pg.wait_for_timeout(200)
        pg.screenshot(path=str(out / f'z23_core_{tag}.png'))
        pg.evaluate('() => UI.closePanel()')
        # 5. Settings · Graphics · Zone effects: off stops the ambient layer, the board keeps its look
        pg.evaluate('() => { UI._dbg.openSettings(); document.querySelector("[data-act=setTab][data-v=graphics]").click(); }'); pg.wait_for_timeout(250)
        check('Zone effects' in pg.inner_text('#modal'), 'Settings · Graphics has Zone effects', tag)
        pg.screenshot(path=str(out / f'z30_settings_{tag}.png'))
        pg.click('#modal [data-k=zfx]'); pg.wait_for_timeout(250)
        check(pg.evaluate('() => PROF.settings.zfx === false && Render.zfx === false'), 'Zone effects off', tag)
        pg.click('#modal [data-k=zfx]'); pg.wait_for_timeout(150)
        check(pg.evaluate('() => PROF.settings.zfx === true && Render.zfx === true'), 'Zone effects back on', tag)
        pg.evaluate('() => UI._dbg.closeModal()')
        pg.close()
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', fails)
