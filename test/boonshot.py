# Boss kill -> boon pick -> game resumes. Also: the whole Gloop family gives exactly one pick.
import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'audit'; out.mkdir(exist_ok=True)
import mkpage; mkpage.mk()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html'))
    pg.add_style_tag(content=':root{--sal:59px!important;--sar:59px!important;--sab:21px!important}'); pg.wait_for_timeout(400)
    pg.evaluate('() => { PROF.bestWave = 34; PROF.seenHelp = true; PROF.zoomHint = true; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(250)
    pg.click('[data-act=launch]'); pg.wait_for_timeout(400)
    # a core boss on the field, then kill it
    pg.evaluate('() => { G.wave = 10; spawnBoss({ boss: "behemoth", L: G.map.lanes[0], d: 3, hpm: 1 }); }')
    pg.wait_for_timeout(200)
    r = pg.evaluate('() => { const e = G.enemies.find(e => e.boss); for (let i = 0; i < 4 && !e.dead; i++) { e.phaseT = 0; hit(e, e.hp + e.shield + 1e9, "K", null, { noStatus: 1 }); } return { dead: e.dead, draft: !!G.draft, modal: UI.modalOpen, tokens: G.tokens }; }')
    pg.wait_for_timeout(400)
    r['modalAfter'] = pg.evaluate('() => UI.modalOpen')
    print('core boss kill:', r)
    pg.screenshot(path=str(out / 'boon01_pick.png'))
    pg.click('[data-act=boon][data-v="0"]'); pg.wait_for_timeout(300)
    t0 = pg.evaluate('() => G.time'); pg.wait_for_timeout(800); t1 = pg.evaluate('() => G.time')
    print('after pick: draft', pg.evaluate('() => G.draft'), 'modal', pg.evaluate('() => UI.modalOpen'), 'sim advancing', t1 > t0, 'boons', pg.evaluate('() => G.boonsTaken'))
    # Gloop family: kill everything repeatedly, count picks
    picks = pg.evaluate('''() => {
      let n = 0; const orig = Hooks.onDraft; Hooks.onDraft = o => { n++; takeBoon(o[0]); };
      spawnBoss({ boss: 'gloop', L: G.map.lanes[0], d: 3, hpm: 1 });
      for (let k = 0; k < 6; k++) for (const e of G.enemies.slice()) if (e.boss === 'gloop' && !e.dead) { e.phaseT = 0; hit(e, e.hp + e.shield + 1e9, 'K', null, { noStatus: 1 }); }
      Hooks.onDraft = orig;
      return { picks: n, gloopsLeft: G.enemies.filter(e => e.boss === 'gloop' && !e.dead).length };
    }''')
    print('gloop family:', picks)
    # self-heal: a pending pick with no modal reopens
    pg.evaluate('() => { G.draft = [BOONS[0], BOONS[1], BOONS[2]]; }'); pg.wait_for_timeout(400)
    print('self-heal modal:', pg.evaluate('() => UI.modalOpen'))
    pg.screenshot(path=str(out / 'boon02_heal.png'))
    b.close()
print('ERRORS:', errs)
