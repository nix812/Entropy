# What's New popup (returning player on a new version), Settings version row, build menu roles, run recap highlights.
# usage: newsshot.py [W H tag]
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 852, int(sys.argv[2]) if len(sys.argv) > 2 else 393
tag = sys.argv[3] if len(sys.argv) > 3 else 'w'
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    # a returning player whose last seen version is older
    pg.add_init_script('''(() => { try { const k = Object.keys(localStorage).find(k => /entropy/i.test(k)); } catch (e) {} })()''')
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.runs = 12; PROF.seenVer = "1.21.0"; PROF.bestWave = 40; PROF.seenHelp = true; PROF.zoomHint = true; Save.save(); }')
    pg.reload(); pg.wait_for_timeout(1500)
    print('news modal after reload:', pg.evaluate('() => UI.modalOpen'))
    pg.screenshot(path=str(out / f'{tag}01_news.png'))
    pg.click('.foot [data-act=newsDone]'); pg.wait_for_timeout(300)
    print('seenVer now', pg.evaluate('() => PROF.seenVer'), 'modal', pg.evaluate('() => UI.modalOpen'))
    pg.reload(); pg.wait_for_timeout(1500)
    print('no repeat after reload:', pg.evaluate('() => UI.modalOpen'))
    # settings row
    pg.evaluate('() => { const b = [...document.querySelectorAll("#hangar button")].find(b => /settings/i.test(b.textContent + (b.getAttribute("aria-label") || ""))); if (b) b.click(); }')
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / f'{tag}02_settings.png'))
    pg.evaluate('() => { if (UI.modalOpen) document.querySelector("#modal [data-act=close], #modal .x").click(); }'); pg.wait_for_timeout(200)
    # build menu with a role line
    pg.evaluate('() => { PROF.runSnap = null; }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250); pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    pg.evaluate('() => { G.wave = 31; G.credits = 5000; }')
    sp = pg.evaluate('() => { let best = null, bd = 1e9; const c = G.map.core; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (canBuildAt(x, y)) { const d = (x - c.x) ** 2 + (y - c.y) ** 2; if (d > 4 && d < bd) { bd = d; best = [x, y]; } } const r = document.querySelector("#cv").getBoundingClientRect(); const p = Render.tileToScreen(best[0] + 0.5, best[1] + 0.5); return [r.left + p.x * UIS, r.top + p.y * UIS]; }')
    pg.mouse.click(sp[0], sp[1]); pg.wait_for_timeout(300)
    pg.click('[data-act=pick][data-type=grav]'); pg.wait_for_timeout(250)
    pg.screenshot(path=str(out / f'{tag}03_build_role.png'))
    # recap highlights
    pg.evaluate('() => { G.stats.crates = 4; G.stats.pirates = 3; G.stats.odKills = 212; G.relocUsed = 2; G.core.hp = 0; gameOver(); }')
    pg.wait_for_timeout(1600)
    print('over modal', pg.evaluate('() => UI.modalOpen'), 'highlights:', pg.evaluate('() => (document.querySelector("#modal .note.hl") || {}).textContent'))
    pg.screenshot(path=str(out / f'{tag}04_recap.png'))
    b.close()
print('ERRORS:', errs)
