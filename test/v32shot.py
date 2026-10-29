# v3.2: difficulty evolution note on the setup screen, Pandemonium's pre-adapted swarm toast, Swarm Codex strains in
# the Archive, signature strain in the recap and Hall of Fame. usage: v32shot.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'v32'
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e) + ' @ ' + ' / '.join(l.strip() for l in (e.stack or '').split('\n')[1:3])))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 60; PROF.runs = 3; PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; PROF.seenEvo = true; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    pg.click('[data-act=ch][data-v="3"]'); pg.wait_for_timeout(200)
    print('setup evolution note:', pg.evaluate('() => [...document.querySelectorAll(".setup .note")].map(n => n.textContent).find(t => /Evolution/.test(t))'))
    pg.screenshot(path=str(out / f'{tag}01_setup.png'))
    pg.click('[data-act=launch]'); pg.wait_for_timeout(2300)
    print('preAdapted:', pg.evaluate('() => G.preAdapted'), 'toast:', pg.evaluate('() => (document.querySelector("#toasts .toast") || {}).textContent'))
    print('geneCap at wave 4:', pg.evaluate('() => geneCap(4)'), 'at 20:', pg.evaluate('() => geneCap(20)'))
    pg.screenshot(path=str(out / f'{tag}02_preadapted.png'))
    # run a few waves so strains get met, then end the run
    pg.evaluate('() => { G.credits = 30000; G.speed = 3; G.wave = 9; G.prep = null; prepareWave(10); G.next = 0.1; }'); pg.wait_for_timeout(6000)
    print('strains met:', pg.evaluate('() => Object.keys(PROF.codex.strains || {}).length'), 'run strains:', pg.evaluate('() => Object.keys(G.strainN || {}).length'))
    pg.evaluate('() => { G.score = 5000; G.core.hp = 0; gameOver(); }'); pg.wait_for_timeout(1600)
    print('recap strain:', pg.evaluate('() => [...document.querySelectorAll("#modal .note.hl")].map(n => n.textContent).join(" | ")'))
    pg.screenshot(path=str(out / f'{tag}03_recap.png'))
    pg.click('[data-act=hangar]'); pg.wait_for_timeout(500)
    pg.evaluate('() => { const b = [...document.querySelectorAll("#hangar button")].find(b => /archive|record|hall/i.test(b.textContent + (b.getAttribute("aria-label") || "") + (b.id || ""))); if (b) b.click(); }')
    pg.wait_for_timeout(400)
    print('archive open:', pg.evaluate('() => UI.modalOpen'), 'strains row:', pg.evaluate('() => (document.querySelector(".codex.strains") || {}).textContent || ""')[:160])
    pg.screenshot(path=str(out / f'{tag}04_archive.png'), full_page=True)
    b.close()
print('ERRORS:', errs)
