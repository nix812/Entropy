"""5.5.6: a composed song plays exactly what is written at any energy (the menu runs at low energy, which used to drop most of
the grid and the whole melody). For several styles: every lit drum cell and every melody note is heard in every bar.
usage: python3 complow.py"""
import pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent; mkpage.mk(); errs = []; fails = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    res = pg.evaluate('''() => {
      const M = SFX.music, oc = new OfflineAudioContext(2, 44100, 44100); SFX.offlineCtx(oc); let clock = 1; const out = []; M.start(); M.renderAhead(clock);
      const grid = { K: '9000900090009000', S: '0000900000009000', C: '0000000800000008', H: '6060606060606060', O: '0000000700000007', R: '0006000000060000', P: '4444444444444444', D: '5000500050005000' };
      const mel = [0, null, 2, null, 4, null, 2, null, 5, null, 4, null, 2, null, 1, null];
      const want = {}; for (const k in grid) want[k] = [...grid[k]].filter(c => c !== '0').length;
      for (const [g, f] of [['ambient', 'drift'], ['lofi', 'jazzhop'], ['downtempo', 'triphop'], ['house', 'disco'], ['techno', 'minimal'], ['trance', 'progressive'], ['dnb', 'liquid'], ['chiptune', 'nes'], ['dub', 'onedrop'], ['synthwave', 'outrun']]) {
        M.setConfig({ custom: true, genres: [g], energy: 0.05, follow: 1 }); M.setIntensity(0.1);
        const cp = { v: 1, genre: g, flav: f, seed: 5, name: 'T', mode: 'aeolian', key: 9, loop: { degs: [0, 5], q: [], bars: 1 }, drums: grid, bass: ['sub', 'long'], lead: 'piano', mel, melSeed: 3, bpm: 110 };
        M.skip({ genre: g, flav: f, seed: 5, name: 'T', comp: cp, start: 8 }); clock += 4; M.renderAhead(clock);
        M.debug = true; clock += 12; M.renderAhead(clock); const ev = M.events.filter(e => e[7] === g + '/' + f); M.debug = false;
        const bars = [...new Set(ev.map(e => e[5]))].sort((a, b) => a - b).slice(1, -1); // whole bars only
        const res = { style: g + '/' + f, bars: bars.length, missing: [] };
        for (const bn of bars) {
          for (const k in grid) { const n = ev.filter(e => e[5] === bn && e[1] === 'drums' && e[2] === k).length; if (n < want[k]) res.missing.push(`bar ${bn} ${k} ${n}/${want[k]}`); }
          const ln = ev.filter(e => e[5] === bn && e[1] === 'lead').length; if (ln < 8) res.missing.push(`bar ${bn} lead ${ln}/8`);
          const bs = ev.filter(e => e[5] === bn && e[1] === 'bass').length; if (bs < 1) res.missing.push(`bar ${bn} no bass`);
        }
        out.push(res);
      }
      return out;
    }''')
    b.close()
for r in res:
    print(r['style'], 'bars', r['bars'], 'missing', r['missing'][:6])
    if r['bars'] < 3 or r['missing']: fails.append(r['style'])
print('ERRORS:', errs[:5])
print('FAILED:', fails)
