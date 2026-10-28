# Buildings — Weathering v2 generation

Technical reference for how buildings are generated in **Weathering v2** (`react-app/src/weatheringV2/`). Written for reviewers who need to explain the process precisely — not a feature summary.

Conceptual stance for *why* shells persist and vacate is in `decay.md`. This document covers *how* a lot becomes a readable building.

---

## Scope and entry points

| Concern | Lives in |
| --- | --- |
| Grid cell state, ortho neighbors, growth pick | `grid.ts` |
| Massing type + building program table | `program.ts` |
| Mesh construction (mass, openings, roof, program detail) | `buildShell.ts` |
| Claim / stack / log / render loop | `Town.tsx` |
| Stage / impact clocks (tint + late geometric bite) | `stages.ts` |
| Tunables (`cellSize`, story cap, grow timing) | `params.ts` |

Weathering v2 is a separate tab (`ViewMode` `'shift2'`). It does **not** share building code with Weathering (`weathering/`) or EP.

On grid reset, `Town` clears the map and claims every entry in `DEMO_CLUSTER` (`program.ts`) so a mixed set of programs is present immediately. Auto-growth defaults to **off** so that cluster stays inspectable.

---

## Grid and cell state

Buildings occupy an infinite integer grid. World XZ of cell `(ix, iz)`:

```
centroid = (ix * cellSize, iz * cellSize)
```

Default `cellSize = 2.2`. Clicking the noise ground resolves world `(x, z)` with `Math.round(x / cellSize)`, then calls `claim`.

Each claimed lot is a `V2Cell`:

| Field | Meaning |
| --- | --- |
| `ix`, `iz` | Grid coordinates |
| `height` | Story count (integer, clamped to `maxStories`, default cap 5) |
| `age` | Seconds of absence (upkeep not applied); drives vacate stage |
| `lastStage` | Last published vacate stage (for transition logging) |
| `baseY` | Terrain sample at the centroid when claimed: `heightAt(cx, cz)` |

The shell mesh is parented at `(cx, baseY, cz)`. Height follows the same noise heightfield as the ground (`useV2HeightAt` in `terrainGround.tsx`: noise × amplitude + `0.25`). Buildings sit on the terrain; they are not floated at y = 0.

Orthographic neighbors are fixed in order south → east → north → west:

```
(0,-1) south · (1,0) east · (0,1) north · (-1,0) west
```

Diagonals are never neighbors for massing, walls, or growth.

---

## How a lot is claimed

`Town.claim(ix, iz, height, reason)`:

1. **Already claimed** → if `height < maxStories`, increment by 1 (`stack`), re-log open/shared faces, re-resolve program for this cell and ortho neighbors, `publish` (forces mesh rebuild).
2. **Empty** → create `V2Cell` with the requested height (clamped), `age = 0`, `lastStage = 'held'`, `baseY = heightAt(centroid)`.
3. Append process-log events (claim, program, footprint, per-face neighbor rules).
4. For each already-claimed ortho neighbor, log that the shared face is now occupied.
5. Re-check program on self + ortho neighbors (a new claim can change a neighbor’s massing).
6. `publish()` bumps `revision` so every shell whose geometry depends on the map rebuilds.

Sources of claims:

- **Demo seed** — `DEMO_CLUSTER` on every `gridReset`
- **Click** — height 1
- **Step once** — `pickGrowthTarget` then claim
- **Auto growth** — same picker, every `growEvery` seconds when enabled and stepped mode is off

### Growth target picker (`pickGrowthTarget`)

Current implementation (not density-ranked):

- Empty map → `(0,0)` with height `1` or `2` (`Math.random`)
- Otherwise collect every empty ortho neighbor of every claimed cell, pick one uniformly at random, height `1 + floor(random * 3)` (so 1–3)

This is the one place building *placement* still uses `Math.random`. Massing, program, footprint jitter seed, and program detailing do not.

---

## Neighbor wall rule (structural backbone)

For a cell, `neighborFaces` returns four faces. A face is **open** when:

- there is no claimed neighbor on that side, **or**
- the neighbor exists but `neighbor.height < cell.height` (upper stories still read as exposed above a shorter abutting shell)

A face is **shared** when a neighbor exists with height ≥ this cell’s height.

Open faces get wall/opening treatment in `buildShellGeometry`. Shared faces do not get an open-face panel on that side — the party wall is implied by adjacency, not drawn as a freestanding facade.

This rule is independent of program. Program only decides *how* open faces are detailed (panels vs punches vs blank).

Process log per face, e.g.:

```
[rule]  1,0  east: open wall
[rule]  1,0  west: shared with 0,0
```

---

## Massing type (from occupancy pattern)

`massingType(ix, iz, map)` counts which of the four ortho cells are **claimed** (presence only — not height).

| Occupied ortho count / pattern | Massing |
| --- | --- |
| 0 | `isolated` |
| 1 | `row` (end of terrace / attached on one side) |
| 2, opposite directions (N+S or E+W) | `row` (mid-terrace) |
| 2, adjacent directions (e.g. N+E) | `corner` |
| 3 or 4 | `block-enclosed` |

No `cellHash`. Same neighborhood → same massing every time.

---

## Building program (from massing + height)

`programFor(massing, height)` — pure table, no salt:

| Massing | Height | Program (log label) |
| --- | --- | --- |
| isolated | ≤ 2 | `house` |
| isolated | ≥ 3 | `live-work` |
| row | ≤ 3 | `rowhouse` |
| row | ≥ 4 | `walk-up` |
| block-enclosed | any | `office-hall` → “office/market hall” |
| corner | ≤ 2 | `corner-shop` → “corner shop” |
| corner | ≥ 3 | `utility` → “utility/transit” |

Logged as:

```
[rule]  2,1  program: rowhouse (row massing, height 3)
```

Logged when the signature `program|massing|height` changes for that cell (including when a neighbor claim flips massing, or a stack crosses a height threshold such as rowhouse → walk-up).

In-world HTML labels show `ix,iz · program` and `massing · h{height} · impact`.

---

## Footprint

`footprintHalf(ix, iz, cellSize, map)` returns half-extent on XZ:

1. `density = occupiedNeighborCount / 4` (0 = isolated, 1 = fully surrounded)
2. Base fraction of cell: lerp `FOOTPRINT_MIN (0.75)` → `FOOTPRINT_MAX (0.95)` by density
3. Seeded jitter: `cellHash(ix, iz, 11)` mapped to ±0.04 on that fraction
4. Clamp to `[0.75, 0.95]`, then `half = cellSize * frac * 0.5`

Denser blocks tend toward larger footprints; isolated lots toward smaller. Jitter is stable per cell (not per frame).

Logged:

```
[rule]  0,0  footprint 87% of cell · density 4/4 (seeded ix,iz)
```

---

## Shell geometry pipeline (`buildShellGeometry`)

Constants: `STORY = 1.15` world units per floor.

For each story `0 .. height-1`:

1. Resolve program + faces + footprint half.
2. Compute **story profile** (inset, scaleX/Z, plan shift) — see below.
3. If top story and roof kind is `setback`, multiply inset by `0.72`.
4. Core box size:  
   `coreW = half * 2 * inset * 0.88 * scaleX`  
   `coreD = half * 2 * inset * 0.88 * scaleZ`  
   `coreH = STORY * 0.96`  
   Centered at story mid-height `y = story * STORY + STORY * 0.5`, plus profile shift × half.
5. Emit mass (solid, courtyard ring, bitten L, or chamfered shop — see programs).
6. Emit open-face panels unless program skips them.
7. Emit window punches for walk-up / utility.
8. On top story: roof + house chimney if applicable.
9. After all stories: ground-level program detail (porch, stoop, shop band).
10. Merge all `BufferGeometry` parts; vertex colors from stage/impact tint.

Material: `meshStandardMaterial` with `vertexColors`, roughness `0.95`.

### Story profile

Default (only used if a program branch does not override): seeded inset/scale/shift from `cellHash` with salts `40+7s`, `50+7s`, … and a mild upward taper (`inset *= 1 - t * 0.08` where `t` is story index normalized by `height - 1`).

**Program overrides replace those proportions** (no hash in the override branches):

| Program | Plan behavior |
| --- | --- |
| `house` | inset 0.9, scales ~0.95, no shift |
| `live-work` | story 0: inset 1, wider X; upper: inset ~0.82−, narrower |
| `rowhouse` | inset 0.94, compressed X (`scaleX` 0.78) — narrow frontage |
| `walk-up` | near-full, square scales 0.92 |
| `office-hall` | near-full, scales 1 |
| `corner-shop` | inset 0.72, scales 0.85 — smaller kiosk mass |
| `utility` | inset `0.7 + 0.02*story`, scales 0.7 — slender vertical |

### Roof kind (by program)

| Program | Roof |
| --- | --- |
| `house` | `pyramid` (4-sided cone, rotated 45°) + chimney stub |
| `live-work` | `setback` (smaller top mass + flat cap) |
| `rowhouse`, `corner-shop` | `parapet` (deck + four lip walls) |
| `walk-up`, `office-hall`, `utility` | `flat` (deck, no lip) |

### Open-face panels vs punches

Panels are thin boxes on **open** faces (height `0.7 * STORY`), skipped when:

| Program | Skip rule |
| --- | --- |
| `office-hall` | always (blank walls) |
| `walk-up` | always (replaced by punches) |
| `utility` | all stories above ground (`story > 0`); ground uses punches |
| `rowhouse` | east and west faces (party-wall sides stay quiet) |
| `house`, `live-work`, `corner-shop` | never (all open faces get panels) |

**Window punches** (dark `#1a1c20` boxes recessed on open faces):

- `walk-up`: 3 evenly spaced punches per open face per story
- `utility`: 1 punch per open face per story

Spacing uses story index / punch index only — not `cellHash`.

### Program-specific mass and ground detail

**Courtyard (`office-hall` and `height >= 3`)**  
Each story is a ring of four boxes around a central void (thickness `0.18 * min(coreW, coreD)`), not a solid block.

**Corner shop ground story**  
Main mass scaled down, plus a box rotated 45° placed toward the open-open corner (or primary open face if only one open side).

**House**  
After stories: porch slab + two posts on the primary open face (prefer south if open).

**Rowhouse**  
Three stoop steps stepping outward on the primary open face.

**Live-work**  
Darker horizontal shop band on each open face at ground level (`0.35 * STORY` tall).

**Primary open face**  
First open face, preferring `south`, else the first open in ORTHO order. Used for porch/stoop orientation.

---

## Vacating vs generation

Generation builds the shell. Vacating does not delete it.

Per frame, every cell’s `age` advances by `min(0.25, delta) * decaySpeed`. Thresholds (defaults): thinning 6s → vacated 14s → impacted 28s.

| Stage | Impact mode | Visual on the generated shell |
| --- | --- | --- |
| held | intact | stage color only |
| thinning | paint | lerp toward `#c4b49a` |
| vacated | rust | lerp toward `#8a3a1c`; slight lean `0.02` |
| impacted | partial | lerp toward `#6a6e74`; lean `0.06`; if ≥2 faces open, **top story** becomes an L-mass with NE corner missing plus bite debris boxes |

Partial bite is the only vacate-driven *geometry* change. Program and neighbor rules still define the underlying shell.

---

## Process log (generation as events)

Append-only, last 96 events, formatted:

```
{time}s  [{kind}]  {cellKey}  {detail}
```

Kinds used for buildings: `claim`, `stack`, `rule`, `stage`, `note`.

Typical claim sequence for one lot:

1. `claim` — reason, story count, stage held  
2. `rule` — `program: … (… massing, height N)` for cell and any neighbor whose program signature changed  
3. `rule` — footprint % and density  
4. `rule` — each face open or shared  
5. `rule` — neighbors notified that a face is now shared  

Reviewers should be able to point at a building and find the matching program and face lines in the Process log panel.

---

## Demo cluster layout

`DEMO_CLUSTER` is ordered so adjacency does not cross-contaminate massing (e.g. a corner L is not attached to the plus arms). After all seeds are claimed:

| Cells (approx.) | Expected massing / program |
| --- | --- |
| `(5,0)` h2 | isolated → house |
| `(-5,0)` h3 | isolated → live-work |
| `(-1,3)(0,3)` h2–3 | row → rowhouse |
| `(1,3)` h5 | row → walk-up |
| `(3,-2)` h2 + stubs | corner → corner shop |
| `(-3,-2)` h4 + stubs | corner → utility/transit |
| `(0,0)` h4 + four arms | block-enclosed → office/market hall |
| plus arms h2 | row → rowhouse |

Reset grid re-runs this seed.

---

## What is seeded vs what is rule-driven

| Decision | Driver |
| --- | --- |
| Massing type | Occupied ortho pattern |
| Building program | Massing + height table |
| Open vs shared wall | Neighbor presence/height |
| Program proportions, roof family, stoop/porch/punches/courtyard | Program rules |
| Footprint band within 75–95% | Density + `cellHash(ix,iz,11)` jitter |
| Default story taper (if program did not override) | `cellHash` per story |
| Next auto/step growth cell and its initial height | `Math.random` (current) |
| Vacate stage / impact | Cell `age` vs thresholds |

Program assignment itself never reads `cellHash`.

---

## File map (generation only)

```
weatheringV2/
  Town.tsx          claim, stack, demo seed, log, Shell render
  grid.ts           V2Cell, ORTHO, neighborFaces, footprint density helper, pickGrowthTarget
  program.ts        massingType, programFor, DEMO_CLUSTER, log labels
  buildShell.ts     footprintHalf, buildShellGeometry, roofs, program detail
  stages.ts         vacateStage, impactMode, stage colors
  params.ts         cellSize, maxStories, grow / decay knobs
  processLog.ts     event types + formatting
  terrainGround.tsx heightfield sample used as baseY
```
