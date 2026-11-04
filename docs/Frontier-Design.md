# Frontier: design plan (draft 1)

*Last Gradient · November 3, 2026 · status: Phase 1 prototype in progress (branch `frontier`, test link /Entropy/lab/)*

## The problem

Nic, after 6.0: "It doesn't feel epic enough or decision-making enough. It's spam towers in differing ways."

Today almost every decision is *which tower, on which tile beside the road*. The road is fixed, the core never really moves, and the map only grows around you. More towers and more enemy types add more ways to stack towers; they don't change the kind of game it is.

**Where things stand (6.0):**
- **Board:** about 48 × 26 tiles on Normal. A run starts on 60% of it and grows as wormholes open.
- **Enemies:** a Drone walks about 1.15 tiles a second; the main road runs about 55–100 tiles, so it crosses in about a minute.
- **Towers:** reach 2–4.6 tiles. The best play is always to line the road and stack.
- **Core relocation already exists** (v1.16), but it is so restricted it is effectively never used: only at a checkpoint, field clear, within 10 tiles, 800 credits after the first move. The useful part is the plumbing: `planRelocation()` already re-routes every road to a new core spot and draws a preview.
- **The core already has** an element picker (5 buttons, free to switch), its own affixes, Shield/Hull/Uplink upgrades, and a ×1.5 damage bonus when it sits on a Power Node.

## The goal

A game about **where you are** and **what you're shooting with**, not only what you've stacked along a road. It should feel like commanding a mothership on a big, dangerous map: slow, heavy threats you see coming, and a big move to make every few waves.

## The pillars

1. **The base flies.** Lift off at any time, fly across the map, land somewhere new. The swarm's roads swing to follow.
2. **Docking.** Land the base on one of your towers and the core's cannon becomes a big version of that tower, with everything it has earned.
3. **Links.** The landed base links to the towers around it; they make each other stronger. You build a fortress, then move it.
4. **A big, slow, cinematic map.** Bigger board, slower and heavier enemies, fewer and bigger waves, places worth flying to.

## 1. Lift-off

- A **Lift Off** button on the core (or its panel). The core rises and you tap where to land.
- **Flying costs something**, like a Terran building:
  - The core's gun is offline and its shield is down while airborne.
  - The flight takes time, longer for farther trips (starting guess: about 1 s per 3 tiles).
  - Enemies keep walking. Their roads re-route to the landing spot the moment you commit, so they head to where you're going.
  - A **cooldown** after landing instead of a credit price (starting guess: 3 waves, shortened by core upgrades).
- **Landing preview** before you commit: the new roads (longer or shorter per lane), which tower you'd dock on, what the cannon becomes, and which towers would link. Extends the existing relocation preview.
- **Landing rules:** inside the current sector, not on a road, not too close to a wormhole (the existing rules), and any tower tile is allowed (that's docking).

## 2. Docking

- Land on a tower and it is **mounted on the core**. The core's cannon becomes that tower's attack, scaled up:
  - Rail Lance → a huge piercing beam. Flame Projector → a ring of fire around the base. Cryo Emitter → a freezing pulse around home. Void Lens → a ramping beam. Missile → salvos. And so on for every attack tower.
  - **It keeps** the tower's element, affixes, specialty, Ascend perks, veteran mutations and Technique.
  - **Scaling:** the core's own Battery level multiplies the docked weapon (starting guess: ×2 damage, +1 range, then Battery upgrades on top).
- **Lift off again** and the tower is set back down where it was, intact. Docking never costs you a tower.
- **Landing on empty ground** gives the core its plain cannon (today's core gun).
- **Support towers** (Pylon, Forge, Snare) can be docked for a different kind of base: a Pylon core boosts every linked tower, a Forge core makes credits, a Snare core holds fliers at the gate. To decide in playtest.
- **The element buttons on the core go away** in this mode: docking is how you change the core's damage. Otherwise docking loses half its point.

### Why this is the heart of it

The swarm already reads your damage mix and breeds counters (shells, plating, element wards), and it warns a wave ahead before a Strain Assault. Today your only answer is selling and rebuilding. With docking, **the answer is a move**: "They're plated against Kinetic now? Fly to my Arc Coil." The core's damage counts toward what the swarm reads, so it adapts back. A real back-and-forth.

And because enemies walk to the core, **where you dock is also where the swarm goes**. Two consequences from one choice: your gun and their path. That tension is the decision-making.

## 3. Links

- When the core lands it **links to nearby towers**: visible glowing lines from the base to each.
- **Starting guess:** 3 links within 4 tiles. More links come from a core upgrade (the existing Uplink line could become this).
- **Linked towers get stronger** (starting guess: +10% damage and rate). Later idea: they also gain a little of the docked tower's element.
- **Linked towers make the core stronger** (starting guess: +5% core damage per linked tower).
- **Moving breaks the links**: the towers you leave behind lose the bonus until you come back, link them again, or extend the network.

The natural play becomes: build a fortress around the base, then pick the whole operation up when the swarm shifts.

## 4. Moving towers

If the base moves, the roads move, and towers built for the old roads guard empty ground. So **towers can lift off too**:
- Tap a tower, tap **Move**, tap a new tile. The tower is offline while it relocates (starting guess: 4 s) and costs a small fee (starting guess: 10% of its value).
- No more selling and rebuilding to adapt. You reposition.
- Rejected alternative: towers only work near the base (Protoss pylon style). It creates territory but makes moving feel punishing. Keep it as a softer form: the link bonus.

## 5. The big, slow map

- **Board:** about twice the area of today's (starting guess: 64 × 36 on Normal), with a camera that follows the action.
- **Enemies about 60% of today's speed,** with more health so waves take as long or longer to clear, and **fewer, heavier waves**: more Juggernaut-class threats, fewer streams of chaff.
- **Siege enemies:** one or two huge, slow units per wave that you see coming from across the map. Bosses feel like events.
- **Places worth flying to:**
  - **Salvage fields:** credits per wave while the base sits nearby.
  - **High ground:** towers on it get +range.
  - **Power Nodes:** these already exist, and the core already gets ×1.5 damage on one.
  - Later: relics to claim, wormhole nests to suppress.
- **Camera help for a bigger map on a phone:** edge arrows pointing at off-screen threats; tap the minimap to jump; a "home" button back to the base.

## The loop

1. Build a fortress around the base.
2. The swarm studies it and adapts.
3. You see the counter coming (Arms Race strip, assault warning).
4. Lift off and dock on a different gun.
5. The roads swing to the new landing spot.
6. Fortify again.

## Risks and how we handle them

| Risk | Why it matters | Answer |
|---|---|---|
| One dock is always best (e.g. always the Lens) | Kills the decision | Flight cost, cooldown, roads moving, the swarm adapting to the core's damage. Measure with bots: no single dock should hold the core more than about half the time. |
| Readability on an iPhone in landscape | A bigger board means smaller tiles or more panning | Camera help, big landing targets, one-tap flow: Lift Off → tap a tower → preview → Land. Check every screen at 667×375. |
| Runs get too long | Slower enemies mean longer runs | Fewer, heavier waves; fast-forward. Target a run length (open question 2). |
| It touches everything | Roads, waves, balance, saves, Daily Hunt, tutorial, recordings | Build it as a separate mode. Classic stays exactly as it is. |

## How we build it

- **A separate mode, "Frontier".** The current game (Classic), its saves, Dailies, records and recordings are untouched. Every new rule is switched on only in Frontier runs.
- **A separate branch and a separate test link** while it's being built (see below).

### Phases

1. **Prototype (1–2 sessions):** bigger map, slower and heavier enemies, Lift Off at any time with flight cost and cooldown, docking (core takes the tower's weapon and affixes), roads re-route on landing. Basic links. Placeholder art. **Goal: Nic plays it and tells us whether it feels epic.**
2. **Make it a game:** moving towers, link upgrades, salvage fields and high ground, siege enemies, camera help, the swarm reading the core's damage, balance with the bots.
3. **Make it beautiful:** lift-off and landing effects, docking animation (the tower rising onto the core), link beams, sounds, a Frontier tutorial lesson.
4. **Ship it** as a mode on the main menu. If it's the better game, it becomes the default.

### Test environment

- **Branch:** `frontier`, made from `source`. All Frontier work happens there; `source` and the live game are untouched until it's ready.
- **Test link:** builds from `frontier` go to **nix812.github.io/Entropy/lab/**, a copy of the game with its **own save**, so testing can never touch real progress. A "start as new player" button for fresh tests. The same setup worked for the 6.0 tutorial test copy.
- **When it's ready:** merge `frontier` into `source`, ship it in a normal release, take down the lab link.

## Decisions (Nic, November 3: "your assumptions are good")
- Towers can lift off and move with the base; links are a bonus, not a power switch.
- Fewer, heavier waves so runs aren't much longer than Classic.
- Both the flying base and the bigger, slower battles matter.
- Core keeps Shield, Hull and Uplink; Battery level scales the docked weapon; the core's element buttons are removed in Frontier.
- Support towers dockable only if cheap to build; otherwise attack towers first.

## Open questions for Nic (original list; answered above)

1. When the base moves, do towers come with it (lift off too), or stay and lose their link? *(Current lean: they can lift off, and links are a bonus, not a power switch.)*
2. How long should a typical run be, in minutes?
3. Is the flying base the core of the dream, or the bigger and slower cinematic battles? *(It decides what the prototype proves first.)*
4. Can support towers be docked (Pylon, Forge, Snare cores), or only attack towers?
5. Should the core keep its own upgrades (Shield, Hull, Battery) in Frontier, or does the docked tower replace the Battery line?

## Starting numbers (all to tune in playtest)

| Thing | Starting guess |
|---|---|
| Board (Normal) | 64 × 36 tiles |
| Enemy speed | ×0.6 of Classic |
| Flight speed | about 3 tiles per second |
| Lift-off cooldown | 3 waves |
| Docked weapon | ×2 damage, +1 range, × Battery level |
| Links | 3 within 4 tiles; +10% damage and rate each; +5% core damage per link |
| Moving a tower | 4 s offline, 10% of its value |
