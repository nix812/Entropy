"""v4.8 music CPU check: how long Chrome takes to render N seconds of each genre offline (render-time / audio-time).
Live playback must stay well under 1.0 on a phone. usage: python3 perfcheck.py [secs] [genre,...]"""
import sys, time, pathlib, mkpage
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
secs = float(sys.argv[1]) if len(sys.argv) > 1 else 16
gs = sys.argv[2].split(',') if len(sys.argv) > 2 else None
mkpage.mk()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto('file://' + str(root / 'test' / 'out' / 'page.html')); pg.wait_for_timeout(300)
    ids = gs or pg.evaluate('() => SFX.music.GENRE_IDS')
    for g in ids:
        pg.reload(); pg.wait_for_timeout(200)
        r = pg.evaluate('''async ([secs, g]) => { const sr = 44100, oc = new OfflineAudioContext(2, sr * secs, sr); SFX.offlineCtx(oc);
          SFX.music.setConfig({ custom: true, genres: [g], energy: 0.85, follow: 0 }); SFX.music.start(); SFX.music.skip({ genre: g });
          const t0 = performance.now(); let js = 0;
          for (let t = 0; t < secs; t += 0.25) oc.suspend(t).then(() => { const a = performance.now(); for (let k = 0; k < 6; k++) SFX.music.schedule(t + 0.5); js += performance.now() - a; oc.resume(); });
          await oc.startRendering(); return { total: (performance.now() - t0) / 1000, js: js / 1000, flav: SFX.music.piece.flav }; }''', [secs, g])
        print(f"{g:10s} {r['flav']:12s} render {r['total'] / secs:5.2f}x realtime   (JS scheduling {r['js'] / secs * 100:4.1f}% )", flush=True)
    b.close()
