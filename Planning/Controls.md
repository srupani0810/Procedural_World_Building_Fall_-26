# Controls

Reference for every control in the `react-app` panel. Descriptions match the code that reads each value (`AppChrome.tsx`, `terrainParams.ts`, `voxelParams.ts`, `voxelGrid.ts`, `VoxelScene.tsx`, `Scene.tsx`, `heightGradient.ts`, `GradientEditor.tsx`, `NoiseMap.tsx`).

**Where sections appear**

| Section | Visible when |
|---|---|
| Noise, Field, Raw 2D | **3D** tab, or **2D → Field** |
| Voxel World, Meshing, Height Gradient | **Voxels** tab |
| Hydraulic, Droplet, Sediment, Map | **2D → Sim** (documented at the end) |

Noise / Field also drive the voxel heightfield (same `TerrainParams`).

---

## View tabs

| Control | What it does | Visual effect |
|---|---|---|
| **3D / 2D / Voxels** | Sets `ViewMode` in `App.tsx` — which main canvas is mounted. | Switches between the heightfield mesh, the 2D noise/sim view, and the infinite voxel world. |
| **Field / Sim** (2D only) | Sets `TwoDTab`. | **Field** shows the raw noise map + Noise/Field/Raw 2D panel. **Sim** shows the erosion heightmap + Hydraulic/Droplet/Sediment/Map. |

---

## Voxel World

Voxels tab only. Values live on `VoxelParams` and rebuild chunks via `buildVoxelChunk` / `VoxelScene`.

| Control | Range (UI) | What it does | Visual effect |
|---|---|---|---|
| **Resolution** | 4–64 (step 1) | Cells per axis of each chunk’s N³ density grid (`Math.round(resolution)`, min 4). Cell size = `VOXEL_CHUNK_SIZE (4) / N`. | Higher → smaller blocks / finer MC surface inside each chunk (more detail, heavier). Lower → chunkier Minecraft-like cubes. High values (esp. with large load radius) can hitch. |
| **Load radius** | 0–4 (step 1) | Chebyshev radius in **chunks** around the camera chunk (`chunksAround`). Radius `r` loads a `(2r+1)³` cube of chunks. | `0` = only the chunk you’re in. `1` = that chunk plus neighbors (default). Higher = wider streamed world; more memory / mesh work. Orbit/pan to see new chunks appear at the edge. |
| **Isolevel** | −2–2 | Solid when `density >= isolevel` (`isSolid`). Used by Interactive greedy mesh and Marching Cubes. | Raise → thinner terrain / more air (peaks may vanish). Lower → thicker fill, more solid ground under the surface. |
| **Volume** | 0–2 | Mixes 3D noise into density: `density += sample3(x,y,z) * volume * height * 0.3` (`createDensityFunction`). | `0` = pure heightfield columns (flat vertical sides). Higher → caves, overhangs, and bumpy volume carved into / bulging from the surface. |
| **Bleed** | 0–1 | 3D blur of the density field before meshing (`applyBleed3D`). Blur radius ≈ `round(bleed * 2)`; mixes each cell with neighbors by `bleed` amount. Uses a world-sampled halo so chunk borders stay seamless. | `0` = hard voxel edges. Higher → softer, melted transitions between solid and air (blocks feel less binary; MC surface gets smoother). |
| **Jump In** / **Exit** | buttons | Toggles first-person walk (`FirstPersonControls`). Jump In places the camera at eye height on the terrain at the orbit focus; Exit / **Esc** restores orbit. | Stand in the field: WASD/arrows move, click canvas for mouse-look (pointer lock). Camera Y follows the heightfield. Orbit/pan unchanged when not in first-person. |

---

## Meshing

Voxels tab only.

| Control | Range (UI) | What it does | Visual effect |
|---|---|---|---|
| **Mode** | Marching Cubes / Interactive | `renderMode`: `'marching'` → `extractMarchingCubesFromGrid`; `'interactive'` → `buildGreedyInteractiveMesh` (face culling + greedy quads). Same density grid for both. | **Marching Cubes** = smooth triangulated isosurface. **Interactive** = blocky colored cubes; click removes a voxel, shift-click adds one next to the clicked face. |
| **Overlap** | 0.5–2 | Stored on `VoxelParams.overlap`. Intended as “how much interactive cubes expand into neighbors,” but the current greedy mesh **does not read this value** (kept for UI / future use). | **No visible change** with the current Interactive or Marching Cubes paths. |
| **Reset voxels** | button | Writes `defaultVoxelParams` (Interactive, res 16, isolevel 0, bleed 0.1, overlap 1, volume 0, load radius 1). | Restores the default voxel look and streaming distance. Does **not** reset Noise/Field or the height gradient. |

---

## Height Gradient

Voxels tab only. Used only by **Interactive** mode to color face vertices from world Y (`sampleHeightGradient` / `colorAtY` in `voxelGreedyMesh.ts`). Marching Cubes does not use these stops.

| Control | What it does | Visual effect |
|---|---|---|
| **Preview strip** | CSS gradient from sorted stops (`gradientCss`), low → high. | Live preview of the height→color ramp; not a separate param. |
| **Color** (per stop) | Hex color on that stop; RGB-lerped between neighbors at sample time. | Changes the tint of voxels at that relative height band. |
| **Position** (per stop) | Relative height in `[0, 1]` (`0` = lowest, `1` = highest). World Y maps roughly via `wy / (colorHeight * 2) + 0.5` where `colorHeight` is terrain **Height**. | Slides where that color sits on the mountains (e.g. snow only on peaks). |
| **↑ / ↓** | Swaps this stop’s position with the previous/next stop in sorted order. | Reorders the ramp without typing positions. |
| **Remove** | Deletes a stop (disabled if only 2 remain). | Fewer bands; wider blends between remaining colors. |
| **Add stop** | Inserts a new stop (default green) near the midpoint of the range. | Extra color band on the Interactive terrain. |

Default stops: blue `#1238c8` at `0`, red `#ff1a1a` at `1`.

---

## Noise

Shown in **3D** and **2D → Field** (and the same params still feed voxels when you switch tabs). Built by `createNoise` / `createNoise3D` (FastNoiseLite, seed `1337`).

| Control | What it does | Visual effect |
|---|---|---|
| **Type** | Selects `noiseId` and which FastNoiseLite noise / fractal mode runs. | Changes the “character” of hills: smooth simplex, sharp ridges, cellular cells, etc. Updates 3D mesh, Raw 2D preview, erosion base map, and voxel density. |

### Type-specific extra slider

The second Noise slider’s **label and meaning** follow the selected type (`NOISE_OPTIONS` + `createNoise` switch):

| Type | Extra label | Wired to | Visual effect |
|---|---|---|---|
| **Simplex** | Lacunarity | `SetFractalLacunarity` | Higher → each FBm octave jumps to a much higher frequency → busier, more crumpled detail when Layers &gt; 1. |
| **Simplex S** | Gain | `SetFractalGain` | Higher → later octaves stay louder → rougher, noisier surface. |
| **Perlin** | Lacunarity | `SetFractalLacunarity` | Same idea as Simplex lacunarity, with Perlin’s look. |
| **Ridged** | Gain | Ridged fractal + `SetFractalGain` | Stronger ridge emphasis → sharper mountain crests / canyon edges. |
| **Cellular** | Jitter | `SetCellularJitter` | `0` = rigid cell lattice; toward `1` = more irregular cell boundaries (Worley-like blotches). |
| **Value** | Gain | `SetFractalGain` | Louder fine octaves on value noise → blockier / grainier field. |
| **Ping Pong** | Strength | `SetFractalPingPongStrength` | Stronger ping-pong fractal → more rippled, banded undulation. |

---

## Field

Shared terrain shaping (`TerrainParams`). Affects 3D mesh, Raw 2D, erosion source map, and voxel heightfield.

| Control | Range (UI) | What it does | Visual effect |
|---|---|---|---|
| **Zoom** | 0.1–24 | Noise frequency = `zoom * 0.12` (`SetFrequency`). | Higher → features shrink (more hills packed into the same world). Lower → large, sweeping landforms. |
| **Height** | 0–4 | 3D: vertex Z = `noise * height`. Voxels: surface height scale and floor at `-height`; also scales volume perturbation and Interactive color mapping (`colorHeight`). | Higher → taller peaks / deeper valleys. Lower → flatter slab. |
| **Layers** | 1–12 | Fractal octaves (`SetFractalOctaves`). If `1`, fractal type is `None`; otherwise FBm (unless the noise type overrides, e.g. Ridged / Ping Pong). | More layers → finer wrinkles stacked on large shapes. `1` → single smooth wave, no octave detail. |
| **Grid detail** | 4–192 | 3D plane segment count: `PlaneGeometry(4, 4, detail, detail)`. **Not** used by the voxel chunk resolution. | Higher → smoother-looking 3D mesh (more triangles). Lower → faceted, low-poly hills. Raw 2D / voxels ignore this slider. |

---

## Raw 2D

| Control | What it does | Visual effect |
|---|---|---|
| **Preview canvas** | `NoiseMap` at 96×96 in the panel (full-page 2D Field view uses 256×96… actually 256). Samples `createNoise(params)` over a fixed extent (±2 in noise space), maps `(-1…1) → grayscale`. | Live black-and-white picture of the same field the 3D mesh and voxels use. No extra sliders — it only reacts to **Noise** and **Field** (Zoom / Layers / Type / extra; Height does not change the grayscale tones, only 3D displacement / voxel scale). |

---

## 2D Sim (extra panel sections)

Visible only under **2D → Sim**. Not in the Voxel/Noise accordion list above, but they are control-panel settings.

### Hydraulic

| Control | What it does | Visual effect |
|---|---|---|
| **Start** | Begins the erosion loop (`erodeMap` each frame while `running`). | Channels and sediment start carving the heightmap. |
| **Stop** | Clears `running`. | Simulation freezes mid-carve. |
| **Reset** | Rebuilds the heightmap from the current Noise/Field via `createHeightmap`. | Scrubs erosion; back to the fresh noise landscape. |

### Droplet

| Control | Range | What it does | Visual effect |
|---|---|---|---|
| **Droplets** | 1–500 | How many water agents spawn per erosion step. | Higher → faster, denser carving each tick. |
| **Lifetime** | 4–200 | Max steps each droplet walks downhill. | Longer paths → longer channels before the drop dies. |
| **Inertia** | 0–0.95 | Blends previous direction with the height gradient (`dx = dx * inertia - grad * (1 - inertia)`). | Higher → straighter, momentum-heavy streams. Lower → snappier turns into local slopes. |
| **Gravity** | 0.1–24 | Speeds the droplet from downhill height change. | Higher → faster, more aggressive erosion when descending. |

### Sediment

| Control | Range | What it does | Visual effect |
|---|---|---|---|
| **Capacity** | 0.1–24 | Scales how much sediment water can carry from slope × speed × water. | Higher → deeper cuts before the drop is “full.” |
| **Erosion** | 0–1 | Fraction of (capacity − sediment) carved from the map when below capacity. | Higher → digs gullies faster. |
| **Deposition** | 0–1 | Fraction of surplus sediment dropped when over capacity or moving uphill. | Higher → more silt banks / fills. |
| **Evaporation** | 0.001–0.3 | `water *= 1 - evaporation` each step. | Higher → drops die sooner; shorter, weaker streams. |
| **Min slope** | 0–0.2 | Floor on sediment capacity so flat areas still erode a little. | Higher → more wear even on gentle ground. |
| **Radius** | 1–16 | Brush radius (cells) for deposit/erode stamps. | Higher → wider, softer channels; lower → thin trenches. |

### Map

| Control | What it does | Visual effect |
|---|---|---|
| **Heightmap preview** | `HeightMapView` of the live `Float32Array` heightmap the sim edits. | Grayscale (or themed) picture of carved terrain; updates while running. |

---

## Defaults (quick reference)

**Terrain:** Zoom `3`, Height `0.55`, Layers `4`, Grid detail `48`, Type Simplex, Lacunarity `2`.

**Voxels:** Interactive, Resolution `16`, Load radius `1`, Isolevel `0`, Volume `0`, Bleed `0.1`, Overlap `1`.

**Erosion:** Droplets `48`, Lifetime `32`, Inertia `0.08`, Gravity `4`, Capacity `4`, Erosion `0.35`, Deposition `0.25`, Evaporation `0.02`, Min slope `0.01`, Radius `3`.
