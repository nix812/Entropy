"""Renders every SFX offline (OfflineAudioContext) and reports peak dBFS, loudest-50ms RMS and audible length per sound.
Also writes test/out/sfx_all.wav (every sound in sequence, 1.6 s apart) and a spectrogram sheet sfx_spec.png.
usage: python3 sfxrender.py"""
import pathlib, base64, struct, wave, mkpage, math
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent.parent
out = root / 'test' / 'out'
mkpage.mk()
NAMES = ['ui', 'deny', 'shot', 'shotT', 'shotC', 'shotA', 'shotV', 'shotG', 'rail', 'pulse', 'missile', 'zap', 'flame', 'mortar', 'grav', 'coreshot',
         'hit', 'hitcrit', 'hitarmor', 'hitshield', 'die:drone', 'die:swarmer', 'die:tank', 'die:flyer', 'die:splitter', 'die:phantom', 'die:medic', 'die:shielder',
         'combo:SHATTER', 'combo:OVERLOAD', 'combo:THERMAL SHOCK', 'combo:SUPERCONDUCT', 'combo:COLLAPSE',
         'build', 'upgrade', 'reroll', 'sell', 'cash', 'wave', 'call', 'milestone', 'levelup', 'unbreak', 'freeze', 'net', 'boom', 'emp', 'blink',
         'leak', 'bigleak', 'crack', 'storm', 'converge', 'maelstrom', 'implode', 'lane', 'strikecharge', 'strike', 'nova', 'stasis', 'overclock',
         'boss', 'bossdie', 'gameover', 'quack', 'meow', 'whale', 'blorp']
GAP = 1.6
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto('file://' + str(out / 'page.html')); pg.wait_for_timeout(300)
    data = pg.evaluate('''async ([names, gap]) => {
      const sr = 44100, oc = new OfflineAudioContext(2, Math.ceil(sr * (names.length * gap + 3)), sr);
      SFX.offlineCtx(oc);
      names.forEach((n, i) => { SFX.setT(i * gap + 0.05);
        let name = n, arg = { cx: 0, cy: 0 };
        if (n.startsWith('shot')) { name = 'shot'; arg = { s: { el: { shot: 'K', shotT: 'T', shotC: 'C', shotA: 'A', shotV: 'V' }[n] || 'K' }, spec: n === 'shotG' ? 1 : 0 }; }
        if (n.startsWith('die:')) { name = 'die'; arg = { type: n.slice(4) }; }
        if (n.startsWith('combo:')) { name = 'combo'; arg = n.slice(6); }
        if (n === 'upgrade') arg = { lvl: 2 };
        SFX.play(name, arg); });
      const buf = await oc.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, i16 = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { i16[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; i16[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
      let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      return btoa(s);
    }''', [NAMES, GAP])
    b.close()
raw = base64.b64decode(data)
sr = 44100
with wave.open(str(out / 'sfx_all.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(raw)
import array
a = array.array('h'); a.frombytes(raw)
mono = [(a[2 * i] + a[2 * i + 1]) / 65534 for i in range(len(a) // 2)]
rows = []
for i, nm in enumerate(NAMES):
    s0, s1 = int(i * GAP * sr), int((i + 1) * GAP * sr)
    seg = mono[s0:s1]
    pk = max(abs(x) for x in seg) or 1e-9
    win = int(0.05 * sr); best = 0
    for k in range(0, len(seg) - win, win // 2):
        r = math.sqrt(sum(x * x for x in seg[k:k + win]) / win); best = max(best, r)
    thr = pk * 0.03; last = 0
    for k in range(len(seg) - 1, 0, -64):
        if abs(seg[k]) > thr: last = k; break
    rows.append((nm, 20 * math.log10(pk), 20 * math.log10(best or 1e-9), last / sr))
print(f"{'sound':22s} {'peak dB':>8s} {'rms50 dB':>9s} {'len s':>6s}")
for nm, pk, rm, ln in rows: print(f"{nm:22s} {pk:8.1f} {rm:9.1f} {ln:6.2f}")
try:
    import numpy as np
    from PIL import Image, ImageDraw
    x = np.array(mono, dtype=np.float32); N = 512
    tiles = []
    for i in range(len(NAMES)):
        seg = x[int(i * GAP * sr): int(i * GAP * sr) + int(1.2 * sr)]
        fr = np.array([np.abs(np.fft.rfft(seg[k:k + N] * np.hanning(N)))[:N // 2] for k in range(0, len(seg) - N, N // 2)])
        S = np.clip((20 * np.log10(fr.T + 1e-6) + 70) / 70, 0, 1)
        im = Image.fromarray((S[::-1] * 255).astype(np.uint8)).resize((200, 128)).convert('RGB')
        ImageDraw.Draw(im).text((3, 2), NAMES[i], fill=(255, 200, 80)); tiles.append(im)
    per = 8; rowsN = math.ceil(len(tiles) / per)
    sheet = Image.new('RGB', (per * 204, rowsN * 132), (0, 0, 0))
    for k, im in enumerate(tiles): sheet.paste(im, ((k % per) * 204, (k // per) * 132))
    sheet.save(out / 'sfx_spec.png')
except Exception as e:
    print('spectrogram skipped:', e)
