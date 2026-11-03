# Texture vs geometry weathering

A short map of **how decay is drawn** — not a new stance on what decay means. Conceptual position stays in `Planning/DECAY.md`. Skim once, then look a method up when a critique, shader, or mesh change names it.

Weathering in graphics is almost always one of two jobs, or both at once:

```
texture / material  →  the surface looks used (color, gloss, dirt)
geometry / mesh     →  the form is altered (missing bay, sag, lean)
```

For this project the mix is settled: **surface and material lead**; **partial structure comes later and sparsely**; the shell **never fully disappears**. Texture methods carry most of the early story. Geometry methods are the late, localized bite — not the opening image.

---

## The split in one table

| | Texture weathering | Geometry weathering |
|---|---|---|
| What changes | Color, roughness, normals, transparency of the *same* mesh | Vertex positions, missing faces, extra debris meshes |
| Typical look | Paint chalk, stains, rust streaks, dirt in pores | Lean, hole, collapsed bay, sagging lintel, broken pane as a gap |
| Cost | Cheap (shader or maps). One mesh. | Dearer (rebuild mesh, extra draw, collision). |
| Risk here | Reading as a “ruin filter” if it is only mood | Reading as disaster / wipe if it is rubble-first or total dissolve |
| Fits the brief when | Finish fails while mass still stands | Enclosure has already failed; one bay / member gives, shell remains |

A useful test: **hide the albedo**. If the building still reads as the same industrial box, you were doing texture. If the silhouette changed, you were doing geometry.

---

## Texture weathering — how it works

The mesh stays a box (or mill, or plate landmark). Light still hits the same faces. You change **what those faces shade as**.

Think of a painted wall: the plaster is still there; the film on top fails first. That matches the research chain in the brief (enclosure fails → surface/material accelerate → structure later).

### Types (what you are simulating)

- **Paint wear / chalking.** Binder breaks down in sun and weather. Color lightens, goes matte, flakes in patches — the body color peeks through.
- **Staining / water run.** Roof, sill, and leak paths carry dirt and dissolved minerals **down**. Darker vertical or banded marks, not random speckles.
- **Rust / corrosion.** Iron oxides form on metal and **drip** onto adjacent surfaces. Orange–brown, often from edges, fasteners, flashings, stacks.
- **Soiling / biological film.** Dust, soot, algae in damp zones. Usually darker, low-frequency blotches, stronger on north/shaded faces (if you model aspect).
- **Rot / mold (look, not physics).** Local darkening and softness cues on timber or damp plaster. Easy to overdo into “horror basement.”
- **Glazing dirt / opacity.** Glass goes matte, filmed, or dark — still a pane until you punch a hole (that punch is geometry).

### Techniques (how you draw it)

**1. Albedo / color mix in a shader (this project’s main path)**  
A wear amount `uWear` (and stage: settled / abandoned / reclaimed) lerps the base mill or metal color toward chalk, stain, rust. Mottling uses a stored noise attribute, not `Math.random` per frame.

Typical knobs: stage thresholds, intensity, edge vs face (`aEdge`), roof/sill bands (`vRelY`).

**2. Detail / wear maps (classic PBR)**  
Painted or generated textures: albedo, roughness, maybe a mask. UV the facade; sample `wearMask`. Good for authored hero buildings; heavy if every procedural cell needs unique UVs and maps.

**3. Triplanar / world-space projection**  
Project dirt and streaks from world XZ/Y so you do not need unique UVs. Streaks follow gravity if you bias the blend toward **down** (accumulate along −Y).

**4. Flow / drip masks**  
Trace or fake water from roof edge and openings: a few downward streaks from known metal bits, not all-over noise. Reads as **process** (water entered) rather than noise.

**5. Curvature / occlusion / cavity**  
Dirt in concavities, wear on convex edges (chips). Often a baked AO/curvature map or a cheap screen/vertex approximation. Edges rust; pockets stain.

**6. Roughness / metalness only**  
Paint goes matte (roughness up); bare metal or rusted plate changes metalness. The color shift can stay small; the highlight dies. Cheap cue for “finish failed.”

**7. Normal / bump, not displacement**  
A normal map of flakes, corrugation, or plate ribs. Silhouette unchanged. Weathering v3 uses **horizontal plate ribs in the shader** on metal landmarks — still texture-space, not vertex move.

**8. Decals**  
Stain cards, rust cards, posters, patches stuck on the mesh. Localized; easy to aim at a fail bay. Risk: sticker look if they ignore gravity and openings.

**9. Vertex colors**  
Paint wear into vertices (or a float attribute like `aNoise`). No extra textures. Resolution follows the mesh. Fine for blocky mill shells.

**10. Transparency / cutout in the shader**  
Alpha-test a broken pane or a cladding “hole” **without** deleting triangles. From a distance it reads as a void; the mass is still there. Use sparingly — a whole-wall dissolve fights “never completely discarded.”

---

## Geometry weathering — how it works

You change **where the surface is**, or **whether a piece exists**. The silhouette and the shadow change. That is a stronger claim: something actually failed.

In this brief that belongs **late**, **partial**, and **localized** (one bay, one lintel, one pane) — not a rubble pile and not a lattice of leftover edges.

### Types (what you are simulating)

- **Failed enclosure (opening as void).** Missing pane, missing cladding panel, roof hole. Weather’s entry point made visible.
- **Sag / deflection.** A lintel, joist, or tarp drapes under gravity. Small vertex move; still the same member.
- **Lean / racking.** Whole bay or shell tilts a few degrees. Easy to overplay into cartoon collapse.
- **Missing span / bay.** A chunk of floor, roof, or wall is gone; neighbors still stand. Masonry shell outlasting interior is a real pattern.
- **Debris / scrap at the base.** Extra meshes on the ground — evidence of what fell, not deletion of the wall.
- **Plant / ground pressure.** Geometry of growth against the shell (later systems). The building is still there.

### Techniques (how you draw it)

**1. Vertex shader displacement (tiny, gated)**  
Move `transformed` in the vertex shader. Weathering v3: **lintel sag only** on one reclaim-gated panel; **noise never displaces mass**. Tarp vertices retract toward tie points. Keep amplitudes small so stories stay square/plumb.

**2. Morph targets / blend shapes**  
Authored sag or buckle as a second shape, blend with age. Good for hero props; awkward for every procedural cell.

**3. Boolean / CSG / clipped panels**  
Cut a hole in the cladding mesh for one bay × one story. True missing mass. Clear, readable, matches “localized failure.”

**4. Delete or hide instance pieces**  
If the facade is built from panels, windows, sills as separate meshes, **omit** one pane or one sheet at a late stage. The rest of the kit stays. This is how a lot of kit-of-parts ruins stay legible.

**5. Separate “fail bay” mesh**  
Swap one wall chunk for a damaged variant (hole, bent plate, exposed frame). Rest of the shell uses the intact builder. Avoids warping the whole box.

**6. Rigid lean (transform)**  
Rotate the group a few degrees around the base. Whole-building lean is a strong signal; this project prefers **not** to warp masonry. If used, keep it rare and small.

**7. Instanced debris**  
Scraps, bricks, sheets near the fail bay. Geometry that **adds** evidence rather than subtracting the shell.

**8. Cloth / tarp simulation or a drape vector**  
Precomputed `aDrape` toward tie-downs, scaled by wear (v3 tarp path). Reads as abandoned covering, not as the mill melting.

**9. Fracture / rigid-body rubble**  
Pre-fracture and explode. Almost always **catastrophe framing**. Conflicts with absence-of-upkeep unless you are showing a *late* localized fall of one member — and even then, leave the shell.

**10. Voxel deletion / marching cubes melt**  
Carve the volume until it looks organic. Reads as dissolve-to-ground. **Refused** for Weathering v3 wall mass (no wireframe lattice, no wash into terrain).

---

## Hybrid (the usual real pipeline)

Almost every convincing shot uses **both**, in order:

1. **Texture** — chalk, stain, rust on an intact shell (settled → abandoned).
2. **Small geometry** — one pane, one cladding void, a lintel sag, scrap at the base (reclaimed).
3. **Stop** — mass still reads as a mill / plant / house.

Shaders often carry both: fragment color for (1), a few vertex offsets or a panel mask for (2).

```
age / absence of upkeep
        ↓
uWear  →  fragment: paint, stain, rust
       →  vertex:   only gated, local failure
```

---

## Mapping onto this codebase (so the names match the tabs)

This is descriptive of **current** tabs, not a license to invent new doctrine.

| Tab | Texture | Geometry |
|---|---|---|
| **Weathering v3** | Fragment wear: mill/metal albedo, chalk, water stain bands, rust from metal edges, optional cladding void *as a shaded panel mask*. Wear intensity slider. | Vertex: **no noise displacement**. Reclaim-gated **lintel sag** on one bay; tarp drape vectors. Diagonal strut/lintel *line* geometry paused. Shell never erased. |
| **Weathering v2** | Vertex-color / tint sequence intact → paint → rust. | Late **partial** impact (lean / bite) while the shell still stands — see `stages.ts`. |
| **Weathering (v1)** | Similar shader wear family. | Stronger mesh tricks historically; do not copy v1 dissolve into v3. |
| **DECAY tab** | Shared instance wear shader: chalk, grime, rain streaks, rust, salt (brick), moss — world/local procedural, no bitmaps/UVs. Wear scrub or distance stand-in. | Late/capped only: one missing panel (shaded void), base debris, one tarp on the exposed side. No window holes until windows exist. Shell never dissolves. |

**Do not** (v3, settled): warp upper stories, turn walls into lattices, melt mass into the heightfield, open with rubble.

---

## Choosing a technique (cheat sheet)

| You want to show | Prefer | Avoid |
|---|---|---|
| Paint failed, building still used-looking | Shader chalk + roughness | Crumbling the box |
| Water got in after vacancy | Roof/sill stain, drips from metal | All-over brown noise |
| Metal still declaring itself | Edge rust, plate ribs in the shader | Recoloring the whole mill orange |
| Enclosure failed | One pane / one panel void | Every window punched |
| Time has structurally bitten | Local sag or one missing bay, debris | Full lean, pancake collapse |
| “Reclaimed” without erasure | Stain + rust + sparse local fail | Transparency of the whole volume |

---

## Mini glossary

- **Albedo:** base color. First place paint and stain live.
- **Roughness:** how sharp the highlight is. Dead paint → rough.
- **Normal vs displacement:** fake bumps vs moving vertices. Only displacement changes silhouette.
- **Mask:** 0–1 field (vertex, texture, or procedural) that *where* wear applies.
- **Decal:** extra quad/mesh with its own texture, stuck on the host.
- **Fail bay:** the one elevation/story chosen to take localized geometric failure.
- **Kit of parts:** windows, panels, sills as separate pieces you can omit.
- **Dissolve / lattice:** deleting or thinning mass until only a cage remains — refused here for wall mass.

---

## A 10-minute practice (do this)

1. Pick one real photo of neglected industrial fabric. Mark **texture-only** cues in one color (paint, streaks) and **geometry** cues in another (holes, sag, missing bay).
2. Check the brief’s chain: do texture cues dominate while the shell still stands?
3. In v3, drag rust/wear intensity with stage clocks: list what changed that was **only color**.
4. Name one geometry move that would still keep the mill readable (e.g. one pane), and one that would break the stance (e.g. melt to terrain).
5. Write one sentence: “This lot is abandoned because ___ , and we see it as ___ (texture) plus ___ (geometry, or none yet).”

If you can do that, you can choose a weathering method without turning decay into a filter or a disaster.

---

## When the two get confused

Ask:

1. **Did the silhouette change?** No → texture. Yes → geometry (or a cutout pretending to be).
2. **Is this early absence of care or late failed structure?** Early → texture. Late → small geometry.
3. **Does the leftover still read as infrastructure?** If not, the method is too strong for this brief.

Open items in `Planning/DECAY.md` (how far to refuse picturesque ruin, locked research canon, etc.) stay **open**. Do not treat this file as settling those.
