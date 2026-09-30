# Controls

Reference for every control in the `react-app` panel. Descriptions match the code that reads each value (`AppChrome.tsx`, `terrainParams.ts`, `voxelParams.ts`, `voxelGrid.ts`, `VoxelScene.tsx`, `ShaderScene.tsx`, `ExperientialScene.tsx`, `epParams.ts`, `shaderStudies.ts`, `Scene.tsx`, `heightGradient.ts`, `GradientEditor.tsx`, `NoiseMap.tsx`, `FirstPersonControls.tsx`).

**Where sections appear**

| Section | Visible when |
|---|---|
| Noise, Field, Raw 2D | **3D**, **2D → Field**, **Voxels**, or **Shaders** (shared `TerrainParams`; not on EP) |
| Voxel World, Meshing, Height Gradient | **Voxels** |
| Shader study, Meshing (shader), Study mesh, Height Gradient | **Shaders** (gradient shared with Voxels) |
| Atmosphere, World (EP), Walk | **Experiential Playground \| EP** (fully detached state) |
| Hydraulic, Droplet, Sediment, Map | **2D → Sim** |

Noise params also drive voxel / shader / EP heightfields (same `createNoise` / `createDensityFunction` pipeline).

---

## View tabs

| Control | What it does | Visual effect |
|---|---|---|
| **3D / 2D / Voxels / Shaders** | Sets `ViewMode` — which main canvas is mounted. | Switches between heightfield, 2D noise/sim, infinite voxels, and shader studies. |
| **Experiential Playground \| EP** | Full-width tab under the four above (`mode === 'ep'`). | Fully detached playground (own terrain, voxels, FP camera, material). |
| **Field / Sim** (2D only) | Sets `TwoDTab`. | **Field** = raw noise + Noise/Field/Raw 2D. **Sim** = erosion heightmap + Hydraulic/Droplet/Sediment/Map. |

---

## Noise

Shown whenever the shared terrain panel is up (not on EP or 2D Sim). Built by `configureNoise` → `createNoise` / `createNoise3D` (FastNoiseLite, seed `1337`).

| Control | Range (UI) | What it does | Visual effect |
|---|---|---|---|
| **Type** | dropdown | Selects `noiseId` and which FastNoiseLite noise / fractal mode runs. | Changes hill “character”: simplex, ridges, cellular, etc. Updates 3D, Raw 2D, erosion base, voxels, shaders, EP. |
| **(type extra)** | per-type | See table below. | Type-specific tweak (lacunarity / gain / jitter / strength). |
| **Frequency** | 0.02–1.5 | `SetFrequency(frequency)` — how zoomed-in the noise pattern is. | Higher → finer, tighter features. Lower → large sweeping landforms. |
| **Amplitude** | 0–4 | Scales noise into terrain height (`terrainAmplitude`). 3D: `noise * amplitude`. Voxels: surface / floor / volume / color height. | Higher → taller peaks / deeper valleys. Lower → flatter ground. Does **not** change Raw 2D grayscale (only displacement / density scale). |
| **Octaves** | 1–12 | `SetFractalOctaves`. If `1`, fractal type is `None`; else FBm (unless type forces Ridged / Ping Pong). | More octaves → finer wrinkles on large shapes. `1` → single smooth wave. |
| **Persistence** | 0.05–1 | Base `SetFractalGain` — how much each successive octave contributes. Overridden when the type’s extra **is** Gain (Simplex S, Ridged, Value). | Higher → rougher, noisier detail. Lower → smoother, large-scale shapes dominate. |

Legacy mirrors: `zoom` ≈ `frequency / 0.12`, `height` = `amplitude`, `layers` = `octaves` (kept in sync via `normalizeTerrainPatch`).

### Type-specific extra slider

| Type | Extra label | Wired to | Visual effect |
|---|---|---|---|
| **Simplex** | Lacunarity | `SetFractalLacunarity` | Higher → each FBm octave jumps frequency harder → busier detail when Octaves &gt; 1. |
| **Simplex S** | Gain | `SetFractalGain` (overrides Persistence) | Later octaves louder → rougher surface. |
| **Perlin** | Lacunarity | `SetFractalLacunarity` | Same idea as Simplex lacunarity, Perlin look. |
| **Ridged** | Gain | Ridged fractal + `SetFractalGain` | Stronger ridges / canyon edges. |
| **Cellular** | Jitter | `SetCellularJitter` | `0` = rigid cells; higher → irregular Worley-like blotches. |
| **Value** | Gain | `SetFractalGain` | Louder fine octaves → grainier field. |
| **Ping Pong** | Strength | `SetFractalPingPongStrength` | Stronger banded / rippled undulation. |

---

## Field

| Control | Range (UI) | What it does | Visual effect |
|---|---|---|---|
| **Grid detail** | 4–192 | 3D plane segment count: `PlaneGeometry(4, 4, detail, detail)`. | Higher → smoother 3D mesh. Lower → faceted hills. **Not** voxel chunk resolution (use Study mesh / Voxel World **Resolution**). |

---

## Raw 2D

| Control | What it does | Visual effect |
|---|---|---|
| **Preview canvas** | `NoiseMap` at 96×96 in the panel (full 2D Field view uses 256). Samples `createNoise(params)`, maps to grayscale. | Live B&W picture of the noise field. Reacts to Type / Frequency / Octaves / Persistence / extras — not Amplitude. |

---

## Voxel World

**Voxels** tab only. `VoxelParams` → `buildVoxelChunk` / `VoxelScene` streaming.

| Control | Range (UI) | What it does | Visual effect |
|---|---|---|---|
| **Jump In** / **Exit** | buttons | First-person (`FirstPersonControls`). Also on EP **Walk**. | Stand on terrain at orbit focus; WASD/arrows; click for pointer-lock look; Esc / Exit → orbit. Height follows `createNoise` × amplitude. |
| **Resolution** | 4–64 | Cells per axis per chunk (`N³`). Cell size = `VOXEL_CHUNK_SIZE (4) / N`. | Higher → finer blocks / heavier. |
| **Load radius** | 0–4 | Chebyshev chunk radius around camera (`chunksAround`). | Wider streamed world; cost grows as `(2r+1)³` chunks. |
| **Isolevel** | −2–2 | Solid when `density >= isolevel`. | Higher → thinner terrain; lower → thicker fill. |
| **Volume** | 0–2 | `density += sample3 * volume * amplitude * 0.3`. | Caves / overhangs; `0` = pure heightfield columns. |
| **Bleed** | 0–1 | 3D density blur (`applyBleed3D`) with world-space halo. | Softer solid/air transitions. |

---

## Meshing (Voxels)

**Voxels** tab only. Uses `voxelParams.renderMode`.

| Control | Range (UI) | What it does | Visual effect |
|---|---|---|---|
| **Mode** | Marching Cubes / Interactive | `'marching'` → `extractMarchingCubesFromGrid`; `'interactive'` → `buildGreedyInteractiveMesh`. | Smooth isosurface vs blocky greedy mesh; Interactive: click remove / shift-click add. |
| **Overlap** | 0.5–2 | Stored on `VoxelParams.overlap`; **not read** by current greedy mesh. | No visible change today. |
| **Reset voxels** | button | Restores `defaultVoxelParams`. | Default voxel look; does **not** reset Noise or gradient. |

---

## Height Gradient

**Voxels** tab only. Colors **Interactive** faces by world Y (`sampleHeightGradient`). Marching Cubes uses its own height→RGB path.

| Control | What it does | Visual effect |
|---|---|---|
| **Preview strip** | CSS ramp from stops. | Live low→high preview. |
| **Color / Position** | Per-stop hex + `[0,1]` height. | Tints bands along elevation (`colorHeight` = amplitude). |
| **↑ / ↓ / Remove / Add stop** | Reorder, delete (min 2), or add stops. | Rebuilds the Interactive color ramp. |

Default: blue `#1238c8` @ 0 → red `#ff1a1a` @ 1.

---

## Shaders tab

Isolated study viewport (`ShaderScene`): same density builders + chosen mesher, then `ShaderMaterial` studies. Does **not** use Voxels streaming/edit.

### Shader study

| Control | What it does | Visual effect |
|---|---|---|
| **Study** (dropdown) | `ShaderStudyId`: displace / toon / contact / glitch. | Swaps custom vertex/fragment shaders on the study mesh. Description text updates under the dropdown. |

| Study | What it does |
|---|---|
| **Vertex Displacement** | Animates vertices along normals with sine/noise waves. |
| **Toon** | Stepped lighting + fresnel outline (Monument Valley–like). |
| **Contact Shadows** | Warm crevice darkening (Sable-like). |
| **Glitch** | RGB split, scanlines, digital noise (`uGlitch`). |

### Meshing (Shaders)

| Control | What it does | Visual effect |
|---|---|---|
| **Mode** | Separate `shaderMeshMode` — **not** `voxelParams.renderMode`. | Marching Cubes or Interactive geometry for the study; active shader applies on top. Voxels tab mode unchanged. |

### Study mesh

| Control | Range | What it does | Visual effect |
|---|---|---|---|
| **Resolution / Isolevel / Volume / Bleed** | Same ranges as Voxel World | Rebuilds the study chunk(s) via `buildVoxelChunk` + selected mesher. | Same meanings as Voxel World, but only the Shaders study mesh (chunks `cy = -1` and `0`). |

### Height gradient (Shaders)

Same shared `heightGradient` / `GradientEditor` as Voxels. Paints Interactive study-mesh faces by height; Marching Cubes study meshes ignore vertex colors (shader uniforms drive look instead).

---

## Experiential Playground (EP)

Fully detached from **Voxels** and **Shaders**: own `epTerrain`, `epVoxel`, `epFirstPerson`, `EpParams`, and `createEpMaterial` (`epMaterial.ts`). **Noise shapes a continuous ground mesh** (not pre-filled voxel terrain). **Player-placed voxels** start empty and grow via click/hold (`ExperientialScene`). Uses `EP_TOWN_GRADIENT`.

### Atmosphere

| Control | Range (UI) | What it does | Visual effect |
|---|---|---|---|
| **Fog density** | 0–0.15 | `FogExp2` density; color `EP_FOG_COLOR` (`#14161a`). | Higher → thicker dark mist. |
| **Filigree** | 0–2 | Uniform `uGrain` on player-voxel material (`glitchIntensity` in code). | Stronger porous/fibrous dither on placed blocks. |

### World (EP only)

| Control | What it does | Visual effect |
|---|---|---|
| **Noise / Frequency / Amplitude** | Edit `epTerrain` only. | Resculpts the flat ground heightfield. |
| **Resolution / Load radius / Isolevel** | Edit `epVoxel` only. | Player-voxel chunk detail / streaming / solid threshold. |
| **Reset EP world** | Restores EP terrain + voxel defaults (clears streamed player chunks on voxel param change). | Default ground; empty build field. |

Scaffold links appear only on player-built peaks (`EP_SCAFFOLD_DENSITY`).

### Build (mouse)

| Gesture | What it does | Visual effect |
|---|---|---|
| **Click ground** | Places a voxel on the noise ground at the hit. | First blocks appear where you tap. |
| **Click voxel face** | Adds a neighbor cell (Townscaper-style). | Grow structures. |
| **Hold** (~400ms) on a voxel | Removes that solid; pale ghost while holding. | Carve; drag cancels so orbit still works. |

Editing is off while Jump In (pointer lock) is active.

### Walk

| Control | What it does | Visual effect |
|---|---|---|
| **Jump In** / **Exit** | EP-only `epFirstPerson` (not shared with Voxels). | Walk the playground; Esc / Exit returns to orbit. |

---

## 2D Sim

Visible only under **2D → Sim**.

### Hydraulic

| Control | What it does | Visual effect |
|---|---|---|
| **Start / Stop** | Toggles erosion loop. | Carves or freezes the heightmap. |
| **Reset** | `createHeightmap` from current Noise params. | Fresh uneroded noise landscape. |

### Droplet

| Control | Range | What it does | Visual effect |
|---|---|---|---|
| **Droplets** | 1–500 | Agents per erosion step. | Denser / faster carving. |
| **Lifetime** | 4–200 | Steps per droplet. | Longer channels. |
| **Inertia** | 0–0.95 | Blend prior direction vs slope. | Straighter vs snappier turns. |
| **Gravity** | 0.1–24 | Speeds downhill motion. | More aggressive descent carving. |

### Sediment

| Control | Range | What it does | Visual effect |
|---|---|---|---|
| **Capacity** | 0.1–24 | How much sediment water can carry. | Deeper cuts when high. |
| **Erosion** | 0–1 | Carve rate below capacity. | Digs gullies faster. |
| **Deposition** | 0–1 | Drop rate when over capacity / uphill. | More banks / fills. |
| **Evaporation** | 0.001–0.3 | Water loss per step. | Shorter, weaker streams. |
| **Min slope** | 0–0.2 | Capacity floor on flats. | More wear on gentle ground. |
| **Radius** | 1–16 | Brush radius (cells). | Wider vs thin channels. |

### Map

| Control | What it does | Visual effect |
|---|---|---|
| **Heightmap preview** | Live `HeightMapView` of the sim buffer. | Shows carved terrain while running. |

---

## Defaults (quick reference)

**Terrain / Noise:** Frequency `0.36`, Amplitude `0.55`, Octaves `4`, Persistence `0.5`, Grid detail `48`, Type Simplex, Lacunarity `2`.

**Voxels:** Interactive, Resolution `16`, Load radius `1`, Isolevel `0`, Volume `0`, Bleed `0.1`, Overlap `1`.

**Shaders:** Study Vertex Displacement, mesh mode Marching Cubes (independent of Voxels mode).

**EP:** Fog density `0.045`, Glitch intensity `1`, Neon density `0.35`.

**Erosion:** Droplets `48`, Lifetime `32`, Inertia `0.08`, Gravity `4`, Capacity `4`, Erosion `0.35`, Deposition `0.25`, Evaporation `0.02`, Min slope `0.01`, Radius `3`.
