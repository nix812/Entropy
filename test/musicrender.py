"""Renders the generative score offline with an intensity curve and reports loudness over time and the pieces it wrote.
usage: python3 musicrender.py [seconds] [seed-tag]  -> test/out/music_<tag>.mp3 (+ .wav), music_<tag>_rms.png"""
import pathlib, base64, wave, sys, mkpage, math, subprocess, array
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
secs = int(sys.argv[1]) if len(sys.argv) > 1 else 240
tag = sys.argv[2] if len(sys.argv) > 2 else 'a'
mkpage.mk()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(300)
    res = pg.evaluate('''async (secs) => {
      const sr = 44100, oc = new OfflineAudioContext(2, sr * (secs + 4), sr);
      SFX.offlineCtx(oc);
      // calm menu, a run that builds, a boss, then easing off
      const curve = x => x < 0.2 ? 0.15 : x < 0.55 ? 0.15 + (x - 0.2) / 0.35 * 0.5 : x < 0.75 ? 0.92 : 0.4;
      SFX.music.setMood('calm');
      SFX.music.renderAhead(secs, x => { SFX.music.setMood(x >= 0.55 && x < 0.75 ? 'boss' : 'calm'); return curve(x); });
      const buf = await oc.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, i16 = new Int16Array(n * 2);
      let pk = 0;
      for (let i = 0; i < n; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); i16[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; i16[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
      const rms = []; for (let s0 = 0; s0 + sr <= n; s0 += sr) { let a = 0; for (let i = s0; i < s0 + sr; i++) a += L[i] * L[i] + R[i] * R[i]; rms.push(Math.sqrt(a / (2 * sr))); }
      let str = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 32768) str += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      return { wav: btoa(str), peak: pk, rms, log: SFX.music.log };
    }''', secs)
    b.close()
raw = base64.b64decode(res['wav'])
wp = out / f'music_{tag}.wav'
with wave.open(str(wp), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100); w.writeframes(raw)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wp), '-b:a', '160k', str(out / f'music_{tag}.mp3')])
db = [20 * math.log10(max(r, 1e-6)) for r in res['rms']]
print('peak dBFS', round(20 * math.log10(max(res['peak'], 1e-9)), 1))
for k in range(0, len(db), 10): print(f"{k:4d}s  rms {sum(db[k:k+10]) / len(db[k:k+10]):6.1f} dB   min {min(db[k:k+10]):6.1f}  max {max(db[k:k+10]):6.1f}")
print('pieces:')
for x in res['log']: print('  ', x)
