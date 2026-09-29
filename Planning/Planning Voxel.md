# Planning Voxel

Brainstorm + decision log for the **Voxels** tab in the Three.js app (`react-app`). Use this to pick a direction before writing more code. Pair with `Tutorials/Voxels.md` for vocabulary and `Prompts.md` for what already shipped.

---

## Where we are now (baseline)

The Voxels tab is **not** a separate world. It **voxelizes the same noise field** as 3D / 2D:

| Piece | Current behavior |
|---|---|
| Source | Shared `TerrainParams` (noise type, zoom, height, layers, …) |
| Representation | Height columns → stacked cubes (Minecraft / pixel-first) |
| Controls | Resolution, **Bleed** (neighbor height blend), **Overlap** (cube scale into neighbors) |
| Render modes | Cubes (default), Marching Cubes, Points, Ray March |
| Extent | Same ground size as 3D (`VOXEL_WORLD_SIZE = 4`) |

**What this is good at:** readable “pixel terrain,” direct comparison with the continuous 3D mesh, cheap mental model.

**What this is not yet:** true 3D volumes (caves, overhangs), materials, chunks, greedy meshing, or a sim that runs *inside* the volume.

Write new ideas *against* this baseline: keep, replace, or layer on top.

---

## Best way to plan (process, not features)

Do these in order. Skip coding until the first three have a short answer written down.

### 1. Pick the *look* you care about this week

One primary aesthetic. Secondary modes can exist as research toggles.

- **A. Pixel / Minecraft columns** (current) — heightmap → blocks  
- **B. Smooth isosurface** — density → marching cubes / dual contouring  
- **C. Soft volume** — raymarch density / clouds / fog  
- **D. Hybrid** — columns for playable ground + density only where you need caves  

If you cannot name the look in one sentence, the UI and data model will fight each other.

### 2. Pick the *data* that look needs

| Look | Natural data | Notes |
|---|---|---|
| A Columns | 2D height grid (+ optional block ID) | Already matches 3D/2D field |
| B Smooth shell | 3D density or SDF on corners | Needs real `N³` (or SDF on the fly) |
| C Soft volume | 3D density in a texture | Shader-friendly; weak “walkable” silhouette |
| D Hybrid | Height + local 3D carve | Best long-term worlds; more systems |

**Rule of thumb:** stay on height→columns until you *need* a hole through the ground. Then introduce density only where the hole lives (or a small fixed chunk).

### 3. Write three constraints (non-negotiables)

Examples for this class app:

- Must stay linked to the **same seed / noise params** as 3D and 2D.  
- Must stay interactive in the browser (cap resolution; prefer instancing / one mesh).  
- Bleed / overlap (or clear replacements) stay as **authoring** knobs, not hidden magic.  
- Style guide: height coloring continuous with 3D where it still makes sense.

Rewrite these when the critique brief changes.

### 4. Slice work into *vertical* spikes

Each spike ends with something visible in the Voxels tab — not a perfect engine.

```
Spike 1  →  one look, one data path, one slider story
Spike 2  →  one performance fix OR one new spatial idea (caves / materials)
Spike 3  →  one “world feeling” pass (palette, scale, camera, UI copy)
```

Avoid horizontal refactors (“rewrite all extractors”) until a spike proves the new data model.

### 5. Keep a tiny decision log

When you choose, note **date → choice → why → rejected alternative**. Future-you (and critiques) need the why.

---

## Design questions to answer on paper

Copy into notes; fill blanks before the next coding session.

**Intent**

- Is Voxels a *visualization* of the field, or a *playable / designable* medium of its own?  
- Should changing Bleed feel like “softening pixels” or “eroding cliffs”?  
- Do Marching / Raymarch stay as learning modes, or become first-class looks?

**Field relationship**

- Always live-sync with 3D params, or “snapshot field → voxelize” (bake)?  
- Same world size forever, or a zoomed “voxel microscope” of a region?  
- Should 2D Field / Sim output ever feed voxels (eroded height → columns)?

**Pixel vs shape**

- Hard grid only, or allow overlap to fake anti-aliasing between cells?  
- Surface-only cubes (Minecraft top + sides) vs solid fill to a floor?  
- One material color-by-height, or layered strata (stone / dirt / grass IDs)?

**True volume (only if needed)**

- Full dense `N³`, sparse chunks, or SDF evaluated in the shader with no grid?  
- Where do caves come from: 3D noise, subtract SDF tunnels, or hand masks?  
- What is the max `N` you will allow in the UI before the tab freezes?

**Authoring UX**

- Which three sliders would you keep if you had to delete the rest?  
- Does “Resolution” mean XZ columns, full 3D grid, or both with two knobs?  
- Reset: reset voxel knobs only, or also terrain?

**Critique / narrative**

- What should a visitor *understand* in 10 seconds on the Voxels tab?  
- What sentence will you say about Bleed in a review?

---

## Brainstorm board (park ideas here)

Move ideas into **Next spike** or **Later / maybe never**. Do not implement from this list blindly.

### Look & language

- [ ] Stronger Minecraft silhouette: only emit exposed faces / greedy mesh  
- [ ] “Pixel scale” slider that changes world cell size without changing noise seed  
- [ ] Orthographic voxel camera preset (toy diorama)  
- [ ] Slice mode: show one Y-layer of the volume as a 2D field  

### Field coupling

- [ ] Bake button: freeze current 3D field into a voxel buffer  
- [ ] Region crop: voxelize only a selected rectangle of the heightmap  
- [ ] Feed Sim-eroded map into columns when Sim has run  
- [ ] Shared “world seed” readout so 3D / 2D / Voxels feel like one instrument  

### Bleed / neighbor language

- [ ] Rename Bleed → “Softness” or “Neighborhood” if critiques confuse it  
- [ ] Separate **height bleed** (columns) from **density blur** (true volumes)  
- [ ] Diagonal vs 4-neighbor bleed modes  
- [ ] Threshold after bleed so soft hills still snap to block steps  

### Overlap / contact

- [ ] Keep Overlap as visual only (scale), never change occupancy  
- [ ] Alternate “mortar gap” mode (overlap &lt; 1) for diagram clarity  
- [ ] Per-axis overlap (XZ flush, Y stepped)  

### True 3D / caves (later)

- [ ] Density = `noise3D - yBias` inside one chunk under the height surface  
- [ ] Carve caves only below a height band (hybrid)  
- [ ] SDF CSG demo as a *second* sub-tab (shapes) without breaking terrain voxels  
- [ ] Flood-fill connected air for “room” debug colors  

### Materials & color

- [ ] Strata by absolute Y (bedrock / dirt / grass)  
- [ ] Slope-based material (steep = rock)  
- [ ] Keep blue→red height ramp for continuity with 3D; add material as overlay  

### Performance

- [ ] Cap instances; show warning in UI when resolution × height layers is huge  
- [ ] Rebuild async / debounce slider updates  
- [ ] Greedy mesh for cubes mode  
- [ ] Lower default resolution; treat 48 as “high”  

### Pedagogy (class)

- [ ] One-sentence captions under Render mode explaining cubes vs MC vs ray  
- [ ] Link or short callout to `Tutorials/Voxels.md` concepts  
- [ ] Side-by-side: 3D mesh wire ghost + voxel solid  

---

## Recommended planning stance for *this* project

Given DESIGN 6197 + your current app:

1. **Treat Voxels as a reading of the field**, not a second universe.  
2. **Double down on pixel-first columns** until the critique asks for caves.  
3. Keep Marching / Ray / Points as **compare modes** (same field, different eyes).  
4. Invest authoring energy in **Bleed, Overlap, Resolution, and shared terrain knobs**.  
5. Only open a true `N³` density path when you have a specific form goal (cave, arch, overhang) that columns cannot fake.

That path keeps the app coherent, teachable, and fast — and still leaves room for a later “volume” spike.

---

## Suggested spike roadmap

Adjust order after you fill the design questions.

| Spike | Goal | Done when… |
|---|---|---|
| **0 — Document** | This file + clear UI hint copy | A stranger knows Voxels = voxelized 3D field |
| **1 — Pixel craft** | Best-looking columns at mid res | Bleed/Overlap feel intentional; no mystery lag |
| **2 — Compare modes** | MC / points / ray clearly same terrain | Switching mode does not feel like a different planet |
| **3 — Performance** | Safe high-res or greedy faces | Resolution max is usable on class laptops |
| **4 — Optional volume** | One cave/overhang recipe | A screenshot proves heightmaps were not enough |
| **5 — Narrative polish** | Camera, captions, palette | Critique story is one sentence |

Mark a spike **active**. Do not start the next until the active one is visible.

---

## Decision log

| Date | Decision | Why | Not doing (for now) |
|---|---|---|---|
| 2026-09-23 | Voxels derive from shared terrain field; Minecraft-style columns; Bleed + Overlap | Link 3D/2D ↔ voxels; pixel-first, not SDF toys | Standalone SDF shapes as the main voxel world |
| | | | |

Add a row every time you lock a direction.

---

## One-page checklist before the next coding session

- [ ] Primary look this week: A / B / C / D ______  
- [ ] Data model: height columns / density / hybrid ______  
- [ ] Three constraints written above (edited if needed)  
- [ ] Active spike number ______  
- [ ] One sentence for critique: _______________________________  
- [ ] Explicitly *out of scope* this week: _______________________  

When those six lines are filled, open the editor. Until then, stay on this page.
