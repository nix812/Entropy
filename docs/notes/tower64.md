# tower64: the capstone tier and seven new towers (6.4.0)

Nic: "I want to expand tower types too. Maybe with keystone talents or even a higher tier talent we let there be new tower
unlocks so the spec feels even more involved." He picked a capstone tier: a new top tier in each talent tree, one node per
tree, and each node unlocks one new tower.

## Design on paper (before building)

### The tier
- One node per tree, above the Capstones (`TALENTS[i].top`, row 5 in `TAL`). Needs 16 points in that tree (`TTOP`), costs 1
  point, takes no Capstone slot. Stored like any talent (`PROF.tal[id] = 1`), so old profiles and saved builds load unchanged.
- The unlock reaches a run only through `newRun({ capT: [...] })` (it lands in `G.recOpts`), read as `G.capT`. The sim never
  reads `PROF` for it. Learning the node mid-run unlocks the tower from the next run.
- Daily Hunts: **none**. `G.capT` is forced to `[]` for Daily Hunts, Training and lessons, and the node can't be learned in the
  Hunt build. Why: the Daily build is 30 points and the ladder compares play with the same 12 towers; a fixed rotating
  prototype was the other option, but it adds a new variable to the one mode that must stay identical.
- Gate: `G.capT` is only non-empty at `G.frV >= 4`. Every new rule lives in code that only runs when one of the new towers
  exists, so frV 1–3 recordings replay bit for bit.

### The towers (each plays a job none of the 12 does)
| Tree | Tower | Job | How it plays |
|---|---|---|---|
| K Ballistics | **Buzzsaw** (`saw`) | Road clearer | Throws a blade onto the road ahead of its target. The blade runs back up the road (against the flow) for 5 tiles and cuts every ground enemy it meets once. Ignores Plating. Can't hit air. Best beside long, bending roads. |
| T Combustion | **Flashover** (`flashover`) | Burn payoff | Pulses fire in a ring. Enemies already Burning explode for their remaining Burn ×2.5 plus a hit, splashing 40% around. Enemies not Burning catch fire. Alone it alternates ignite/explode; beside Flame and Missile it detonates their Burn. |
| A Voltaic | **Surge Spire** (`surge`) | Alpha strike | Chain lightning that stores 1 charge a second while it has nothing to shoot (10 max). With charge it fires ×4 as fast until the cells are empty. Hits hardest at the start of every wave and when a boss walks in. |
| C Cryogenics | **Rimewall** (`rime`) | Blocker | Raises an ice wall on the nearest road tile. Ground enemies stop at it, take cold damage and Chill (and Freeze) until they wear it down (8 enemy-seconds at LV 1, elites ×2). Bosses smash it. Regrows after 8 s. Makes a pile for splash towers. |
| V Singularity | **Entangler** (`tangle`) | Damage sharing | Links 3 enemies for 4 s. 35% of any hit one of them takes is copied to the others (bosses take half of a copy). Turns single-target fire into crowd damage and crowd damage into boss damage. |
| E Bastion | **Aegis Station** (`aegis`) | Leak insurance | While the core is in its range, it stops 2 leaks a wave (3 at LV 3, 4 at LV 5): the enemy dies at the gate and pays as a kill. Bosses are never stopped. A light gun shoots what comes close. |
| X Command | **Wildcard** (`joker`) | Combo engine | Every shot rolls an element (K T C A V) and a delivery (bolt, lance, burst, arc), with a 50% chance of that element's status. Every 10th shot is a Jackpot: all three heavy forms at ×2 with every status. No element of its own. |

Each tower: base stats, LV 1–5 damage, two Specializations, 6–8 Ascension perks, a Mastery 5 legendary, a sprite in the art
kit (`UNITS.TOP`), a muzzle/idle detail, a fire sound through `ev()`/`allow()`, a role line, a codex line, smartbot support.
