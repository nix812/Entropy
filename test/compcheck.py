"""v5.5 composer engine: every style (genre + flavour) with every bass and every lead renders offline without errors, a
composed piece plays exactly its drum grid and its melody, and the same comp renders the same notes twice (share codes
must sound the same for a friend). usage: python3 compcheck.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; mkpage.mk(); errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    JS = '''async (only) => {
      const out = { combos: 0, silent: [], fails: [] };
      const M = SFX.music;
      const oc = new OfflineAudioContext(2, 44100 * 2, 44100); SFX.offlineCtx(oc); let clock = 0.2; M.renderAhead(clock); // start the music first: skip() needs a piece playing
      const render = (cp, secs) => { M.editing = true; M.setConfig({ custom: true, genres: [cp.genre], energy: 0.6 });
        M.skip({ genre: cp.genre, flav: cp.flav, seed: cp.seed, name: cp.name, comp: cp, start: 8 }); clock += 3; M.renderAhead(clock); M.debug = true; clock += secs; M.renderAhead(clock); const ev = M.events; M.debug = false; return ev; };
      const base = g => { const G0 = M.GENRES[g]; return { v: 1, genre: g, seed: 12345, name: 'T', mode: 'aeolian', key: 9, loop: { degs: [0, 5, 2, 6], q: [], bars: 1 }, bass: null, lead: 'bell', mel: null, melSeed: 99, bpm: G0.bpm[1] }; };
      for (const g of M.GENRE_IDS.filter(g => only.includes(g))) for (const f of Object.keys(M.GENRES[g].flavours)) {
        const cp = base(g); cp.flav = f; cp.drums = M.drumsFor(g, f);
        for (const B of M.BASSES) { cp.bass = [B[0], B[1]]; try { const ev = render(cp, 4); out.combos++; if (!ev.some(e => e[1] === 'bass')) out.silent.push(g + '/' + f + ' bass ' + B[2]); } catch (e) { out.fails.push(g + '/' + f + ' bass ' + B[2] + ': ' + e.message); } }
        cp.bass = [M.BASSES[0][0], M.BASSES[0][1]];
        for (const L of M.LEADS) { cp.lead = L[0]; try { const ev = render(cp, 6); out.combos++; if (L[0] !== 'none' && !ev.some(e => e[1] === 'lead')) out.silent.push(g + '/' + f + ' lead ' + L[1]); } catch (e) { out.fails.push(g + '/' + f + ' lead ' + L[1] + ': ' + e.message); } }
      }
      if (only.length) return out;
      // a composed piece plays its grid: only kicks where the grid has kicks
      const cp = base('house'); cp.flav = 'deep'; cp.drums = { K: '9000000000000000', S: '0000000000000000', C: '0000000000000000', H: '0000000000000000', O: '0000000000000000', R: '0000000000000000', P: '0000000000000000', D: '0000000000000000' };
      cp.mel = [0, null, null, null, 2, null, null, null, 4, null, null, null, 7, null, null, null]; cp.lead = 'piano';
      const ev = render(cp, 8), kicks = ev.filter(e => e[1] === 'drums' && e[2] === 'K'), others = ev.filter(e => e[1] === 'drums' && e[2] !== 'K' && e[2] !== 'S');
      out.gridKicksOnBeat1 = kicks.length > 0 && kicks.every(e => e[6] === 0);
      out.gridOnlyKicks = others.length === 0;
      const leads = ev.filter(e => e[1] === 'lead'); out.melSteps = [...new Set(leads.map(e => e[6]))].sort((a, b) => a - b);
      // determinism: the same comp twice gives the same notes
      const sig = () => { const cp = Object.assign(base('lofi'), { flav: 'jazzhop', drums: M.drumsFor('lofi', 'jazzhop'), bass: ['upright', 'lofi'] });
        M.setConfig({ custom: true, genres: ['lofi'], energy: 0.6 }); M.debug = true; M.skip({ genre: 'lofi', flav: 'jazzhop', seed: cp.seed, name: cp.name, comp: cp, start: 8 }); clock += 9; M.renderAhead(clock);
        const ev = M.events.filter(e => e[7] === 'lofi/jazzhop' && e[5] >= 8 && e[5] < 10); M.debug = false; return ev.map(e => e[1] + e[3] + ':' + e[5] + '.' + e[6]).join(','); };
      const a1 = sig(), a2 = sig();
      out.deterministic = a1 === a2 && a1.length > 0;
      return out;
    }'''
    # 6.3: one page per genre (40 styles x 34 parts in one offline context ran out of memory)
    res = { 'combos': 0, 'silent': [], 'fails': [] }
    for g in pg.evaluate('() => SFX.music.GENRE_IDS') + [None]:
        pg.reload(); pg.wait_for_timeout(200); r = pg.evaluate(JS, [g] if g else [])
        res['combos'] += r['combos']; res['silent'] += r['silent']; res['fails'] += r['fails']
        if not g: res.update({ k: r[k] for k in ('gridKicksOnBeat1', 'gridOnlyKicks', 'melSteps', 'deterministic') })
    b.close()
print('combos rendered:', res['combos'])
print('failures:', res['fails'][:10])
print('silent:', res['silent'][:20], len(res['silent']))
print('grid kicks only on step 1:', res['gridKicksOnBeat1'], '· no other drums:', res['gridOnlyKicks'])
print('melody steps heard:', res['melSteps'])
print('deterministic:', res['deterministic'])
print('ERRORS:', errs[:5])
