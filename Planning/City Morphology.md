# City Morphology — Modeling a City as a Network

A working method note for procedural settlement: how to think of a city as **graphs and flows on a shared spatial substrate**, not as a collection of authored buildings. Use this when growing, vacating, or explaining urban form from rules.

Related: `Planning/DECAY.md` (why shells persist under withdrawal of upkeep); `buildings.md` (Weathering v2 lot construction). This file is about **morphology as structure** — what is connected to what, and what that connection does.

---

## Stance

**A city is legible as overlapping networks on land.**

Morphology here means the *shape that connectivity produces*: street corridors, block depths, service reach, and the mass that grows (or fails) where access and adjacency allow. Buildings are consequences of those relations, not the primary object.

That keeps generation explainable: a height, a gap, a dead end, or a vacant bay should answer to a network fact a viewer can point at (too far from a corridor, no neighbor on this face, rim vs core of a service graph).

---

## Why a network model (not a building list)

| Approach | Risk | Network push |
| --- | --- | --- |
| Place buildings, then invent streets | Decoration and roads contradict each other | **Draw / grow the graph first**; parcels hang off edges |
| Pure noise → density blobs | No corridors, no blocks, no “why here” | Noise can bias **node weight** or **edge cost**, not replace topology |
| Authored ruin / skyline set-pieces | Spectacle without process | Form emerges from **local adjacency + global connectivity** |
| One synchronized city clock | Everywhere ages the same | Flows and care withdraw **unevenly along the same graph** |

For this project’s decay stance: when upkeep leaves, it leaves *along networks of use and maintenance*. The leftover shell is still readable because the **street and lot graph remain**, even when lamps go out and glazing fails.

---

## Reference: Gingold / *Building SimCity* (critical, not costume)

Chaim Gingold, *Building SimCity: How to Put the World in a Machine* (MIT Press, 2024), reads Will Wright’s city toy as a **complex-system simulation**: system dynamics (stocks, flows, feedback) meeting **cellular automata** (local rules on a lattice). The book’s close reading of how SimCity “works” is useful as process evidence for *how software cities are layered*, not as a period look to cosplay.

### What to take

1. **Multi-layer maps on one lattice.** Terrain, infrastructure, zones, and “soft” fields (traffic, pollution, land value, crime, coverage) occupy corresponding cells. Visible mass is only one layer; most of the city’s behavior lives in the stack above/beside it.
2. **Infrastructure as enabling graphs.** Roads / rail and power (later water) are not decoration — they are **conditions for growth**. Unserved land does not develop; congestion and outages feed back into decline. The player’s brush paints *edges and service* as much as buildings.
3. **Zones as intentions, not buildings.** R/C/I marks demand slots; actual buildings appear when local conditions (access, value, pollution, demand valves) allow. Morphology = **intent ∩ connectivity ∩ local fields**.
4. **Simulation as analogy.** Gingold stresses that SimCity is a *playable analogy* of cities — a model that scaffolds thinking — not a calibrated urban-science twin. Our procedural worlds should stay honest the same way: **legible rules**, not fake precision.

### What to transform

- SimCity’s player paints zones and pipes; this studio’s DECAY / Weathering work often **grows and vacates by rule** (neighbor density, rim bias, claim-only). Keep the *layered network idea*; do not require a SimCity UI.
- SimCity’s soft maps are often coarse block aggregates. We can keep **finer, explainable fields** (per-cell wear, open-face rules) as long as they still couple to connectivity.

### What to refuse

- Treating the city as only a traffic sim or only a power sim.
- Disaster-as-explanation for form (Gingold/Wright’s disasters are optional drama; our decay brief rejects catastrophe as the driver of abandonment).
- Copying SimCity’s “cute” civic iconography as the visual doctrine for future deindustrialization.

**Status:** Gingold is a **working reference for modeling method**. Not locked as a visual or narrative precedent until the author confirms engagement in `Planning/DECAY.md` Precedents.

---

## Core abstractions

### 1. Substrate (the land lattice)

A discrete or continuous **field of lots / parcels** — usually an integer grid `(ix, iz)` or a derived street-block mesh.

- **Nodes (parcels):** can hold program, height, age, inhabited tag, tone.
- **Optional continuous heightfield:** terrain under the lattice (noise ground) — morphology sits *on* land, it is not the land.

### 2. Circulation network (streets)

The primary **planar graph**:

- **Vertices:** intersections (or cell corners).
- **Edges:** street segments (corridor, alley, rail spur).
- **Faces / blocks:** cycles of edges → buildable interiors.

Generation strategies (pick explicitly; do not mix silently):

| Strategy | Idea | Morphological read |
| --- | --- | --- |
| **Vacancy corridors on a filled disk** | Claim most cells; leave lines empty as streets (rim/west bias + max-block floor) | Blocks emerge as claimed runs broken by gaps — current Weathering v3 / early DECAY seed logic |
| **Stroke the graph, then parcel** | Grow a road graph, then subdivide faces into lots | Stronger “network first”; better for organic / radial / industrial spur patterns |
| **Hierarchical arteries** | Primary roads, then secondary, then alleys | Reads as mill town vs highway city when weights differ |

**Rule of thumb:** if two buildings visually “bridge” a street, the graph failed (hang length, tarp span, or missing vacancy).

### 3. Service networks (power, water, logistics)

Secondary graphs, often **subgraph of or overlay on** circulation:

- Power / water: connected components from plants / pumps.
- Logistics: path existence between program types (homes ↔ work), not necessarily animated agents.

A lot’s **developability** or **held care** can depend on:

- Distance or hop-count to a served edge.
- Whether its component is powered / watered.
- Congestion or load on the path (optional feedback).

### 4. Soft fields (non-graph layers)

Scalar maps registered to the same lattice — Gingold’s multi-layer CA insight:

- Access / centrality (graph distance to core or to arterial).
- Wear / absence age (per-cell clock).
- Pollution, value, risk (optional).
- Presence / inhabited share (central lots first, etc.).

Soft fields **modulate** what the graph allows; they should not invent corridors that the street graph denies.

### 5. Massing as a function of adjacency

Once parcels exist:

```
mass(lot) = f( neighbors, graph distance, program, stage )
```

Examples already used in this repo’s settlement work:

- Height from center distance or neighbor mean.
- Open faces where no abutting neighbor (or shorter neighbor).
- Fail bay = most exposed street face.
- Roofs from open-face count.

That is morphology as **local network readout**, not mesh decoration.

---

## Suggested generation pipeline (network-first)

Use this order unless a brief explicitly reverses it:

1. **Terrain** — continuous ground (noise heightfield). Empty DECAY tab starts here.
2. **Circulation graph** — streets / vacancies / arteries. Log *why* each corridor exists.
3. **Parcels** — cells or subdivided blocks hanging off the graph.
4. **Service overlays** — which parcels are reachable / powered (even if visually quiet).
5. **Program & massing** — mill, shed, landmark accent; height and openings from adjacency.
6. **Soft clocks** — wear, inhabited flicker, concurrent claim/growth.
7. **Late structural bite** — sparse, research-led; shell remains.

Skipping to step 5 without 2–3 produces “buildings in a field,” not a city.

---

## Concurrent growth and decay on the same graph

Align with the decay brief:

- **Growth** = new claims on empty parcels (add-only), sometimes stacking while still held.
- **Decay** = absence clocks on existing shells; no clear/restore of leftover stock.
- **Unevenness** = vacate rates or service withdrawal biased by graph position (rim vs core, west bias), not one global ruin timer.

The network stays; attention relocates. Morphology then shows **mixed stages on one connected town**.

---

## Legibility standard

Every morphological difference should be sayable in one sentence from observable structure:

- “This lot is empty because it sits on a street corridor (max-block floor).”
- “This face is open because there is no neighbor to the south.”
- “This cell is taller because it is closer to the origin on the seed disk.”
- “This bay fails first because it faces the widest open corridor.”

Process logs should name the **graph rule**, not a hash.

---

## Industrial / mill morphology (working, soft)

From the project’s industrial reference board (not a locked costume):

- **Bulk:** wide, low (≈2–5 story) parcels along corridors.
- **Rare accents:** one or two moderately taller, slightly narrower nodes (stack / silo read) — not a skyline spike.
- **Alleys:** narrow residual edges between mills — high exposure, strong fail-bay candidates.
- **Paused for now unless reopened:** graffiti, fire-escape silhouette geometry, container programs.

Primary typology (mill vs mixed housing/civil) remains **open** in the decay brief — ask before locking.

---

## Anti-patterns

| Anti-pattern | Why it fails network morphology |
| --- | --- |
| Buildings first, streets painted in the gaps | Graph is residual, not generative |
| Every cell claimed (no corridors) | No blocks, no exposure, no “town” |
| Random heights without distance/neighbor rule | Illegible skyline |
| Soft-field “ruin noise” without street graph | Mood, not morphology |
| Deleting lots when “reclaimed” | Breaks the leftover-shell / never-discard claim |

---

## Open (ask; do not invent)

- Street strategy for DECAY: keep **vacancy-corridor** model, switch to **stroke-then-parcel**, or hybrid?
- Do service networks (power/water) need a visible layer, or only silent developability?
- Is the lattice ortho-only, or do diagonal / spur edges appear for industrial yards?
- How strongly should soft fields (value, pollution) appear vs stay internal?
- Confirm Gingold / *Building SimCity* as a locked method precedent in `Planning/DECAY.md` after author engagement.

---

## Working summary

Model the city as **networks on land**: circulation and service graphs define access; parcels and massing are functions of adjacency and distance; soft fields modulate intensity. Gingold’s account of SimCity supports a **multi-layer, complex-system** reading (CA + feedback + infrastructure as precondition) — take the layering and connectivity lesson, refuse spectacle disasters and period cosplay. Grow and vacate on the same graph so morphology stays explainable while attention relocates.
