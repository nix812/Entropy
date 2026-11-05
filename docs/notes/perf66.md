# Performance sweep (builder "perf66", for 6.6)

Nic: "After we get all of these features in let's do a performance sweep. Tweak anything that seems like it's using a lot of
resources or energy. The game needs to be accessible to most newish phone hardware. Let's not lose fidelity or quality lets
just look for low hanging fruit with it."

Target: an iPhone 12-class phone and a base iPad. Easy wins only, no visible or audible change, no gameplay change.
Built on v650 (6.5.0). No simulation code changed: replays and every fixture match.

## What the player gets

- **Less work in menus over a run.** With the Talents screen open over a run, the battlefield behind it is no longer drawn at
  all (it is fully covered). Under the Pause menu, Settings, a boon or card pick and the briefing cards, the dimmed field
  behind the dark veil is drawn 30 times a second instead of 60; its animations keep their speed.
- **Fewer HUD rewrites.** The top bar and rails rewrote 11 numbers and labels 10 times a second even when nothing changed.
  Now only changed values are written.
- **Memory stays flat in long sessions.** Tinted copies of enemy sprites (hit flash, frost, chill, regrowth, elite and strain
  rims) were kept forever, one per enemy frame per colour, across runs. Now at most 1024 are kept (about 9 MB).
- Nothing looks or sounds different. `test/pixeq.py` plays the same late-wave scene in the old and new build with a fixed
  clock and compares the battlefield pixel for pixel: identical at 667×375, 852×393 and 1180×820, fog on and off, at home,
  zoomed in, zoomed out and panned.

## Numbers (before = v650, after = perf66)

All browser numbers come from headless Chromium on this Linux box with a software canvas (no GPU), at 852×393 and 3× pixel
density unless noted. The box was quiet (one builder), but frame times still swing ±10% between runs, so each row is the
range of the runs made. Absolute numbers are much higher than on an iPhone (its canvas uses the GPU for compositing);
compare rows, not absolute values.

| Measure | Before | After | Notes |
|---|---|---|---|
| Render, mid scene (36 towers, 90 enemies), home / zoomed in / zoomed out | 32.4–35.9 / 24.5–29.0 / 41.6–47.6 | 32.8–34.1 / 25.0–26.2 / 42.0–43.2 (unchanged) | ms per frame, `drawbench.py`, FRAMES=150 |
| Render, late stress scene (`LATE=1`), home / in / out | 43.0–47.3 / 34.7–41.0 / 53.4–56.6 | 43.9–44.5 / 35.8–37.6 / 54.4–56.3 (unchanged) | Wave 60, 48 towers incl. the 7 tier towers, 220 enemies + boss, 2 storms, fog, Black Hole, probe + 5 sites, live sim |
| Sim, early / mid / late scene | 0.15–0.19 / 0.41–0.45 / 1.14–1.28 | same (no sim change) | ms per 1/30 s tick, `node test/simbench.js` |
| Sim, a played run W1–10 / W11–20 / W21+ | 0.09–0.10 / 0.11–0.12 / 0.18–0.21 | same | ms per tick |
| DOM mutations in battle | 102 per s | 17 per s | the rest are the music meter bars, which really move |
| Layout / style time in battle | 4.8 / 4.7 ms per s | 3.1 / 4.1 ms per s | `uiperf.py` |
| Talents open over a run | 997 ms busy per s | 107 ms busy per s | main thread |
| Pause menu over a run | 995 ms busy per s, 29 fps (saturated) | 793 ms busy per s, 43 fps | at 60 Hz: 60 → 30 field draws per s |
| Settings over a run | 997 ms busy per s | 799 ms busy per s | same as Pause |
| Hangar | 400–620 ms busy per s | same | the animated backdrop, by design (see below) |
| Hidden page | audio context suspended, rAF stops (real browsers) | same | already right |
| Tinted sprite canvases kept | 730+ after a 10-minute run to Wave 14; 910 after 20 s of the late scene, still rising ~35 per s | at most 1024 | `longrun.py`, `Render.tintStats()` |
| JS heap over a 12-minute run | 7.6 → 9.4–10.5 MB, flat after the first minutes | same | after forced GC; DOM nodes flat at ~510 |
| Audio sources playing in battle | 22–97 | same | `longrun.py` |
| Music render cost (`perfcheck.py`, 16 s per genre) | 0.13–0.25× realtime | same | per desktop core |

## The fixes (one commit each)

1. **HUD skips unchanged text** (`ui.js` `updateHud`, helpers `setT`, `setHid` right above it). A text write always replaces
   the text node and marks the layout dirty, even with the same text. Core HP, credits, wave, the Next button, score, speed,
   entropy, the Talents badge and the checkpoint banner now compare first.
2. **No battlefield drawing under the Talents screen** (`ui.js` main loop `frame`). The Talents screen is opaque and covers the
   whole game; the loop now skips `Render.draw` while it is open (the sprite warm-up queue still runs).
3. **Half rate under a full modal** (`ui.js` `frame`, `render.js` `draw(dt, fs)`). When the run is halted by a modal with the
   normal 80% veil, the field draws every other frame and advances its animation counter by 2, so pulses keep their speed.
   The Ready walkthrough (light veil, `#modal.side`) and the checkpoint wait (no modal) keep 60 fps. This is the one change
   with a theoretical visual difference: effects that flicker every single frame (path glow dots, a few dithers) hold one
   phase while behind the dark veil. Behind 80% black it is not visible; revert commit "the paused field under a full modal
   draws at 30 fps" if Nic disagrees.
4. **Tinted sprite cache capped** (`render.js` `tintOf`, `TINT_CAP = 1024`, test hook `Render.tintStats()`). Least recently
   used copies are dropped and their canvas reused; a dropped copy is redrawn identically when needed (checked with a cap of
   40: pixel-identical).

## Measured and left alone (Nic can choose)

- **Pixel density (the biggest lever).** The battlefield canvas renders at the phone's full density (3× on iPhones, capped at
  3). Rendering it at 2× and letting the screen scale it would cut frame time by about 45% (mid scene at home 35 → 19 ms,
  late scene 46 → 29 ms here). But it is not visibly identical: at home zoom the pixel art and the canvas text get slightly
  softer (checked with side-by-side crops of the same late scene at 3× and capped at 2×). Zoomed in it is almost the same. Left at
  3×. If phones run hot in late waves, a "Battery saver" setting that caps the field at 2× is the one big win available.
- **Sharp pixel scaling.** The renderer scales the art up by a whole number first and then smooths to the exact size, so every
  art pixel is the same width (no shimmer). That pass is about 12% of a frame here (`RDBG=8` turns it off for measuring). It is
  the look; left alone.
- **Clears and the background fill.** The view buffer, the upscale buffer and the screen are cleared or filled each frame
  although the opaque board covers them. Skipping those (pixel-identical, tried) made no measurable difference in Chromium
  (it already discards full-canvas clears), so it was reverted.
- **Simulation.** A very late stress tick costs about 1.3 ms on this box (2–4% of a core at 30 ticks per second); a normal
  W21+ tick 0.2 ms. The biggest parts are enemy movement and target search (every tower scans every enemy). A spatial grid
  would cut it but must keep the target order bit-identical for replays; not an easy win, left alone.
- **Music.** The generative music costs 0.13–0.25 of a desktop core while it plays. About half of that is the reverb
  (convolution): synthwave 0.233 → 0.114 and lofi 0.159 → 0.109 with the reverbs replaced by plain gains (measurement only).
  Only the active room is fed already. Nothing to cut without changing the sound. With Music volume at 0 the composer still
  plays into a silent bus (the music tile's meter still moves); stopping it there would save that CPU for players who mute
  music, but the meter would go still.
- **Hangar backdrop.** 400–620 ms busy per second here at 59 fps: the attractor animation, title shards and the nebula, at a
  third of the screen's resolution. By design; small items (a `matchMedia` call per frame) are under 1% and were left.
- **Hidden page.** Already right: the audio context suspends on `visibilitychange`, the run pauses and saves, and Safari stops
  `requestAnimationFrame`. The music scheduler's 100 ms timer keeps ticking but does nothing while the context is suspended.

## Tests and tools added

- `test/drawbench.py`: `LATE=1` stress scene; a fixed map (`SEED`, default 4242); `FRAMES`, `MED`, `RDBG`, `W`/`H`/`DPR`;
  `DRAWSTATS=1` (drawImage calls and destination pixels per frame by call site); `CPUPROF=n` (top functions).
- `test/simbench.js`: ms per sim tick in fixed early, mid and late scenes (with run hashes) and in a played run.
- `test/uiperf.py`: DOM mutations, layouts, style time and main-thread busy time in battle, Pause, Settings, Talents, the
  hangar and a hidden page.
- `test/longrun.py MINUTES`: a run that plays itself; heap after GC, DOM nodes, canvases, sprite cache, audio sources;
  `SNAP=1` heap growth by constructor; canvas creation call sites.
- `test/pixeq.py BASE [NEW] [WxH …]`: pixel-identical check of two builds with a fixed clock (`DPR` env).

## How to re-check

```
python3 build.py && cd test
python3 pixeq.py <old page.html> 667x375 852x393 && DPR=2 python3 pixeq.py <old page.html> 1180x820
FRAMES=150 python3 drawbench.py && LATE=1 FRAMES=150 python3 drawbench.py
node simbench.js 5 && python3 uiperf.py 8 && python3 longrun.py 10
```

## Gate

All clean on the final build: `audit.py n` and `audit.py ipadA 1180 820 0,0,20` (`ERRORS: []`), `uiaudit.py` (errors []
at all three sizes), `trackcollide.py` (`FAILED: []`), `splashshot.py` (all ok), `node replay.js` ("all replays match").
Node fixtures: qola 28/28, cards64 28/28, tower64 41/41, probe65 53/53, sky65 48/48, hookcompat ("old recordings match"),
frontier 92/0. Screenshot tests: cards64shot, tower64shot, probe65shot, sky65shot clean. `zone63shot.py` failed once at
1180×820 ("tempest/oddball differ by 5.7, want >= 6") and passed on the rerun (6.5 at both sizes): that check samples zone
colours that include random weather, so it is flaky on its own; nothing here touches zone looks. `simbench.js` run hashes are
the same before and after (b6f9f722 / 6e6a51f3 / 944987d3, played 3936df40). `pixeq.py` against v650: identical at 667×375
(3×), 852×393 (3×) and 1180×820 (2×), 8 checkpoints each; the late-scene frames are in `test/out/pixeq/`.

## Files touched

- `src/ui.js`: `updateHud` (+ `setT`, `setHid`), the boot loop `frame` (Talents skip, veiled half rate). Hotspots: none of the
  listed shared ones; `updateHud` is shared HUD code, the edits only wrap existing writes.
- `src/render.js`: `draw(dt, fs)` first line, `tintOf` (+ `tintLRU`, `TINT_CAP`), `tintStats` test hook in the returned API.
- `test/`: drawbench.py (extended), simbench.js, uiperf.py, longrun.py, pixeq.py (new).
