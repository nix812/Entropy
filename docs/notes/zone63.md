# Zone looks and the zone banner (builder "zone63", for 6.3.0)

Nic: "Let's make some choices more cosmetically different. You should know when you're in a different zone."

Render, UI and one small sound only. No simulation changes: nothing reads `G.r`, no new `ACTS`, no new run or snapshot fields.

## What the player sees

**Each zone has its own board.** The ground colour, tile seams, road colour and edges, road glow, decals, the backdrop past the map edge and one light weather layer all change with the zone.

| Zone | Board | Road | Weather layer |
|---|---|---|---|
| Quiet Drift | Deep teal ground. Few decals: soft lights and still ripples. | Periwinkle edges | Slow cyan motes |
| The Hive | Plum ground with honeycomb patches, egg sacs and veins. Rocks become brood mounds. | Amber resin road | Pink and amber spores |
| Iron Reach | Light steel plates, rivets on every tile, treadplate, weld seams, grilles. | Purple, bright edges | Sparks off the road edges |
| Open Skies | Sky-blue ground with pale cloud banks under the board. | Blue-white lanes with runway lights | Clouds drift across |
| Ghost Lanes | Dark violet ground, fog banks, broken lane markings, old lanes that lead nowhere. | Pale lavender edges | Mist banks and flickering wisps |
| Salvage Belt | Rust-brown ground with hull fragments, cables and gold glints. Rusty crates. | Purple | Glints on the scrap, dust |
| Tempest Front | Wet charcoal ground with puddles and rain sheen. | Wet blue highlight on the edges | Rain, and lightning lights the board every 7–16 s |
| Demolition Row | Warm concrete with cracks, rubble and hazard plates. | Dark asphalt with orange edges and hazard curbs | Dust and embers |
| Green Choir | Deep green ground with moss, vines, flowers and spore pods. Mossy rocks. Vines creep along the roads. | Purple | Rising spores and small rings of light |
| The Odd Belt | Purple and teal checkerboard with small errors: checkers inside checkers, wavy seams, a rare rubber duck, cat paw prints. | Purple with duck-yellow edges and chevrons | Colour-changing squares, and a duck floats past every 12–20 s |

Training and old runs without a zone keep the board from before 6.3.

**Zone arrival.** When a run starts (or resumes) in a zone, and when a jump door takes you to a new zone:
- A banner shows "ENTERING", the zone name in its colour, and the zone's pitch line. It stays 2.5 s. Taps go through it. It waits until no card is open. It moves to the lower half when the core is in the upper half. Beside an open side panel it moves to the other half.
- The new board spreads out from the core behind a ring in the zone's colour. This takes 1 s. At run start the plain board shows for 0.35 s first.
- A short arrival sound plays: a soft rise and two bell notes, pitched per zone.

**Jump doors** show a strip of each door's board on the left of the door button. **New Run** zone buttons show a patch of each zone's board behind the name. The map preview takes the picked zone's colours. The core panel's Details tab shows the zone name in its colour and its pitch line.

**Settings · Graphics · Zone effects** (On/Off). Off stops the weather layer and the lightning. The zone colours and decals stay, and the board change becomes a plain 1 s fade. The default is On, or Off when the device asks for reduced motion and the player never chose. Pixel scaling "Simple" halves the particles.

**Zone colours** changed for three zones so all ten are easy to tell apart: Open Skies `#9ad8ff` → `#7fb4ff` (it was close to Quiet Drift), Salvage Belt `#ffd84a` → `#e0a458` (close to Tempest Front), Green Choir `#59f0b4` → `#8ee35a` (same as the core colour). This is the only data.js edit.

## Code map
- **render.js** (all new code sits before and after `drawMap`, in the map layer section)
  - `ZL0` (the pre-6.3 board), `ZLOOK` (one look per zone, built by `zlook(id, ground, seamTint, overrides)`), `zpal()` derives seams, scratches, bolts, rocks and crates from the ground colour.
  - `ZDECO[id]` per-tile ground decals, `ZUNDER[id]` decals that span tiles under the roads (Skies clouds, Ghost fog, markings and old lanes), `ZOVER[id]` decals on the outside of road edges (Skies runway lights, Choir vines, Demolition curbs). Helpers: `hp`, `hline`, `ell`, `vn` (value noise), `combStamp` (honeycomb tile), `duck`, `paw`.
  - `bakeBoard(ctx, B, zid, glow)`: the old `drawMap` body, generalised to any board and look. `drawMap()` calls it for the map layer. Decals draw from the map seed through their own `mulberry32` stream.
  - Zone change: `mapZone` (the look in the map layer), `startWipe`, `oldLayer` (kept only for the 1 s wipe, then shrunk to 1×1). `draw()` marks the map dirty when `zoneId()` changes; the blit draws the old layer, then the new one inside a growing circle from the core.
  - Backdrop: `backdrop(zid)` builds a dithered two-colour nebula with stars at one third of CSS resolution, once per zone and screen size. It draws only when the view reaches past the map, and only in the strips outside the board.
  - Ambient: `zoneAmb(v)`, `AMB` (cap, spawn rate), `AMBC` (colours), pool `zp`/`zn` (objects reused, swap-remove), `puffSprites` (cloud and mist sprites, made once). Real time, so weather moves at a checkpoint. Halved under `LITE` and with Simple pixel scaling.
  - `preview_map(canvas, map, frac, zid)` takes the zone. `zoneSwatch(cv, zid, cols, rows)` paints a cached board patch (`swatchPatch`, `SIG` picks decal values so each patch shows its zone's signature decals).
  - `Render.zfx` (setter/getter), `Render.zoneWipe`, `Render.zoneLook(id)`, `Render.zoneMs` (zone layer time, summed while `__rdbg & 16`).
  - The path-glow dots and the dashed sector frontier use the zone's colours.
- **ui.js**
  - `zoneBanner(id)`, `zoneSeen`, `zfxOn()` next to `bossIntro`. `UI.tick` shows the banner when `G.sector` differs from `zoneSeen` and nothing modal is open. `UI.zoneBanner` is a test hook.
  - `zoneSwatches(cols, rows)` after `renderSetup`. **Hotspots (small):** `renderSetup` (one line: map preview zone and swatches), `setupSectorHTML` (canvas in each button), `openDoors` (canvas in each door, one call), `launch` (two lines: `Render.zfx`, reset `zoneSeen`), `corePanelHTML` (one zone line in Details), settings Graphics page (one row), `case 'gfx'` (sets `Render.zfx`).
- **audio.js (flag for mus63):** one entry, `EVT.zone(id)`, next to `unbreak`. Trimmed +5 dB through its own `trim` option (no `TRIM` table edit). Offline render: rms50 about −22 to −24 dB (notice tier), 1.4 s.
- **template.html:** `#zoneBan` markup beside `#cpBanner`; CSS for `#zoneBan`, `.zsw` swatches on `.secb` and `.dchoice .hopt.door`, `.sts.zline`.
- **data.js:** three `col` values in `SECTORS` (above).
- **PROF:** `settings.zfx` (undefined = follow reduced motion). No migration needed.

## Tests
- `python3 test/zone63shot.py [WxH ...]` (default 667×375 and 1180×820): New Run swatches, the run-start wipe and banner (text, clear of every control, gone after 2.5 s), all ten zones busy at home zoom, zoomed out for three zones on phone and all on iPad, a pairwise colour check of the ten fields, the door picker with swatches, taking a door (zone, wipe, banner), the core panel zone line, Zone effects off and on. Screenshots in `test/out/zone63/`.
- `test/trackcollide.py`: the zone banner is shown in every state at all four sizes and must not overlap Lift Off, Ready, the rails, abilities, HUD, chips, the side panel, the checkpoint banner or the doctrine bar. The music deck is a popover and may cover it.
- `test/drawbench.py`: `ZONE=id` runs in a zone. `ZFXAB=1` also times each view with Zone effects off, interleaved, and prints `<view>ZoneLayer`, the measured time inside the zone layer per frame.

## Performance (drawbench, headless Chromium, 852×393 at 3× DPR, busy scene)
- Zone layer per frame at home zoom: 0.02–0.15 ms across the ten zones (target 0.5 ms). Zoomed in: 0.01–0.10 ms.
- Zoomed all the way out: 0.6–0.8 ms, almost all of it the backdrop blit in the strips past the map (software rasteriser; a GPU canvas on iPhone does this blit far faster). It only draws while the view reaches past the map.
- Whole-frame A/B (Zone effects on minus off) stays inside the bench noise (±3 ms on 40–60 ms frames on the shared machine).
- Board decals are baked into the map layer with the board, so they cost nothing per frame. A run start bakes the board twice (plain and zone) for the wipe. Bakes happen only when the map or zone changes.
- No per-frame gradients, no `shadowBlur`, no `createPattern`. Rain draws as one path and one stroke.

## Open issues
- The pitch lines in `SECTORS` (shown on the banner) come from the hook builder and predate the Simple Technical English rule. Some use idioms ("learn the trade", "Ride them or drown"). They were left as they are; the integrator may want to rewrite them.
- The banner text is the zone's existing pitch. On a 667-wide phone with a side panel open the banner wraps to four lines for 2.5 s.
- iPhone Safari was not available here. The backdrop blit and the 1 s wipe (one extra map-layer blit and a clip) are worth a look on a real device.
- The ambient layer uses `Math.random` (cosmetic only).
