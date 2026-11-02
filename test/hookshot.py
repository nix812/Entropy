"""5.8 The Hook on the real page: the setup screen's sector contracts (and none on a fresh profile), the bounty card with the
Bounty Purse and three jump doors, the purse on the HUD's bounty chip, an escalation pick at Wave 50, sector, purse, escalations
and a pending pick surviving a reload and resume, the purse on the game-over card, and the Daily Hunt using the day's contract.
usage: python3 hookshot.py [W H]"""
import pathlib, sys, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; out = root / 'test' / 'out' / 'hook'; out.mkdir(parents=True, exist_ok=True)
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (852, 393)
mkpage.mk(); errs = []; checks = []
def ok(name, v): checks.append((name, bool(v))); print(('ok   ' if v else 'FAIL ') + name)
def shot(pg, n): pg.screenshot(path=str(out / (f'{n}_{W}.png')))
CLAIM = '''() => { const w = G.wanted.w; G.wave = w; const L = G.map.lanes[0]; const e = spawnBoss({ boss: G.wanted.boss, lane: L, hpm: 1 });
  kill(e, null, {}); for (const o of G.enemies.slice()) if (o.wanted && !o.dead) kill(o, null, {}); return !!G.huntChoice; }'''
# a modal's whole card fits on screen (or scrolls inside itself) and nothing in it spills sideways
FITS = '''() => { const c = document.querySelector('#modal .card'); if (!c) return 'no card'; const r = c.getBoundingClientRect();
  if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) return 'card off screen ' + JSON.stringify([r.left, r.top, r.right, r.bottom]);
  for (const el of c.querySelectorAll('button, p, b, span')) { const q = el.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) return 'spills: ' + el.className + ' ' + el.textContent.slice(0, 30); }
  return ''; }'''
CHIP = '''() => { const c = document.querySelector('#chips [data-wanted]'); if (!c) return 'no chip'; const r = c.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; const out = [];
  for (const s of ['#bZoom', '#railL', '#railR', '#abils', '#log', '#docbar', '#panel']) { const e = document.querySelector(s); if (!e || e.hidden) continue; const q = e.getBoundingClientRect(); if (q.width > 2 && hit(r, q)) out.push(s); }
  if (r.right > innerWidth || r.left < 0) out.push('off screen'); return out.join(','); }'''
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(400)
    # a fresh profile: no contract to pick, the gentle default sector
    pg.evaluate('''() => { PROF.seenVer = VERSION; PROF.seenHelp = true; PROF.zoomHint = 1; PROF.bestWave = 0; PROF.settings.briefings = 'off'; UI.renderHangar(); }''')
    pg.click('#bLaunch'); pg.wait_for_timeout(300)
    ok('fresh profile: no contract on the setup screen', pg.evaluate('() => !document.querySelector("#modal .secs")'))
    pg.click('[data-act=launch]'); pg.wait_for_timeout(600)
    ok('fresh profile: first run in the default sector', pg.evaluate('() => G.sector === SECTOR_START && G.recOpts.sector === SECTOR_START'))
    pg.evaluate('() => { G.paused = true; window.act("abandon"); }'); pg.wait_for_timeout(1200)
    pg.evaluate('() => { const b = document.querySelector("[data-act=hangar]"); b && b.click(); }'); pg.wait_for_timeout(300)
    # a seasoned profile picks one of three contracts
    pg.evaluate('() => { PROF.bestWave = 45; PROF.xp = 400000; PROF.nemesis = null; PROF.runSnap = null; UI.renderHangar(); }')
    pg.click('#bLaunch'); pg.wait_for_timeout(300)
    offers = pg.evaluate('() => [...document.querySelectorAll("#modal .secb")].map(b => b.dataset.v)')
    ok('setup offers three contracts from the setup seed', len(offers) == 3 and offers == pg.evaluate('() => sectorOffers(UI._dbg.setup().seed)'))
    pg.click(f'#modal .secb[data-v="{offers[1]}"]'); pg.wait_for_timeout(250)
    shot(pg, 'setup_contract')
    ok('setup card fits: ' + (pg.evaluate(FITS) or 'yes'), not pg.evaluate(FITS))
    ok('the picked contract is highlighted and described', pg.evaluate('(id) => document.querySelector("#modal .secb.on").dataset.v === id && document.querySelector("#modal .secnote").textContent.includes(SECTOR_BY[id].pitch)', offers[1]))
    pg.click('[data-act=launch]'); pg.wait_for_timeout(700)
    ok('the run starts in the picked sector (through newRun opts)', pg.evaluate('(id) => G.sector === id && G.recOpts.sector === id && G.hk === HOOK_VER', offers[1]))
    pg.evaluate('() => { G.wantedTold = 1; G.purse = 12345; UI._dbg.updateHud(true); }'); pg.wait_for_timeout(300)
    ok('bounty chip shows the purse', pg.evaluate('() => /12K XP/.test((document.querySelector("#chips [data-wanted]") || {}).textContent || "")'))
    ok('bounty chip clear of the controls: ' + (pg.evaluate(CHIP) or 'yes'), not pg.evaluate(CHIP))
    shot(pg, 'hud_purse')
    # the bounty: purse and three doors
    ok('a bounty kill opens the doors', pg.evaluate(CLAIM)); pg.wait_for_timeout(700)
    shot(pg, 'doors')
    ok('bounty card: purse amount and three doors plus Extract', pg.evaluate('() => { const m = document.querySelector("#modal .card.doors"); return !!m && m.querySelectorAll("[data-act=door]").length === 3 && !!m.querySelector("[data-act=extract]") && m.querySelector(".pursebox b").textContent === fmt(G.purse) + " XP" && !m.querySelector("[data-act=push]"); }'))
    ok('bounty card fits: ' + (pg.evaluate(FITS) or 'yes'), not pg.evaluate(FITS))
    d1 = pg.evaluate('() => ({ s: G.huntChoice.doors[1].sector, m: G.huntChoice.doors[1].mult, p: G.purse })')
    pg.click('#modal [data-act=door][data-v="1"]'); pg.wait_for_timeout(400)
    ok('door 2 taken: sector, tier and purse multiplier', pg.evaluate('(d) => G.sector === d.s && G.tier === 1 && Math.abs(G.purse - d.p * d.m) < 1e-6 && !G.huntChoice && G.inputs.some(i => i[1] === "push" && i[2] === 1)', d1))
    # an escalation at Wave 50
    pg.evaluate('() => { G.wanted.w = 999; G.wave = 50; const e = spawnBoss({ boss: "behemoth", lane: G.map.lanes[0], hpm: 1 }); kill(e, null, {}); }'); pg.wait_for_timeout(700)
    shot(pg, 'escalation')
    ok('Wave 50 boss: the escalation card with two twists', pg.evaluate('() => !!document.querySelector("#modal .card.twist") && document.querySelectorAll("#modal [data-act=boon]").length === 2'))
    ok('escalation card fits: ' + (pg.evaluate(FITS) or 'yes'), not pg.evaluate(FITS))
    tid = pg.evaluate('() => G.draft[0].id')
    pg.click('#modal [data-act=boon][data-v="0"]'); pg.wait_for_timeout(400)
    ok('twist taken through act', pg.evaluate('(id) => G.twists[id] === 1 && !G.draft && G.inputs.some(i => i[1] === "boon")', tid))
    # a pending escalation, then save, reload, resume
    pg.evaluate('() => { G.wave = 60; const e = spawnBoss({ boss: "queen", lane: G.map.lanes[0], hpm: 1 }); kill(e, null, {}); }'); pg.wait_for_timeout(500)
    before = pg.evaluate('() => { G.paused = true; snapshotNow(); Save.save(); return { s: G.sector, t: G.tier, p: Math.round(G.purse), tw: JSON.stringify(G.twists), d: G.draft && G.draft.map(x => x.id).join() }; }')
    pg.reload(); pg.wait_for_selector('#bLaunch', state='visible', timeout=60000); pg.wait_for_timeout(400)
    pg.click('#bLaunch'); pg.wait_for_timeout(1500)
    after = pg.evaluate('() => ({ s: G.sector, t: G.tier, p: Math.round(G.purse), tw: JSON.stringify(G.twists), d: G.draft && G.draft.map(x => x.id).join() })')
    print('   before', before, 'after', after)
    ok('reload and resume keep sector, tier, purse, escalations and the pending pick', before == after and before['d'])
    ok('the pending escalation card reopens', pg.evaluate('() => !!document.querySelector("#modal .card.twist")'))
    pg.click('#modal [data-act=boon][data-v="1"]'); pg.wait_for_timeout(300)
    # game over: the purse share
    pg.evaluate('() => { G.purse = 5000; G.paused = false; window.act("abandon"); }'); pg.wait_for_timeout(1500)
    shot(pg, 'over_purse')
    ok('game over says what the purse paid', pg.evaluate('() => /you kept 30%, \\+1,?500 of 5,?000 XP/i.test(document.querySelector("#modal").textContent) || /kept 30%/.test(document.querySelector("#modal").textContent)'))
    # Daily Hunt: the day's contract, for everyone
    pg.evaluate('() => { document.querySelector("[data-act=hangar]").click(); }'); pg.wait_for_timeout(300)
    pg.evaluate('() => { PROF.daily = null; UI.renderHangar(); document.querySelector("#hHunt [data-hact=daily]").click(); }'); pg.wait_for_timeout(400)
    shot(pg, 'daily_contract')
    ok('Daily card names the day\'s zone', pg.evaluate('() => { const s = dailySpec(dailyKey()).sector; return document.querySelector("#modal").textContent.includes("Today\'s zone: " + SECTOR_BY[s].name); }'))
    pg.click('[data-act=launchDaily]'); pg.wait_for_timeout(300)
    pg.evaluate('() => { const b = document.querySelector("[data-act=launchDaily][data-v=anyway]"); b && b.click(); }'); pg.wait_for_timeout(800)
    ok('Daily Hunt runs in the day\'s contract', pg.evaluate('() => G.daily && G.sector === dailySpec(dailyKey()).sector && G.recOpts.sector === G.sector'))
    b.close()
print('ERRORS:', errs[:5])
print('FAILED:', [n for n, v in checks if not v])
