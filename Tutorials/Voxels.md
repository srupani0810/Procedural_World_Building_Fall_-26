# Voxels

A short intro to **volumetric data** for procedural world building. You do not need to memorize every meshing algorithm. Skim once, then look a word up when a paper, engine, or critique says “voxel,” “SDF,” or “density field.”

A **heightmap** stores one number per *ground* cell (2D). A **volume** stores a number (or a material) per *cell in space* (3D). That extra axis is how you get caves, overhangs, arches, clouds, and interiors — things a single height cannot describe.

```
2D heightmap:  height(x, z)        →  a surface
3D volume:     density(x, y, z)    →  solid / empty / fog everywhere
```

This class app already touched a toy version: the **pixel cube** was an 8×8×8 block of cells. A world is the same idea at a larger resolution, often generated from **3D noise** (see `Noise.md`).

---

## Shared words

- **Voxel:** “volume pixel.” One cell in a 3D grid. It has a position and a value (empty, stone, density, color, signed distance, …).
- **Volumetric data / volume:** the whole 3D array (or sparse structure) of those values.
- **Grid / lattice:** the regular 3D layout. Resolution `N` on a side means about `N³` cells.
- **Cell vs vertex:** some methods store values at cell centers (Minecraft blocks); others at grid corners (marching cubes). Know which you have.
- **Occupancy:** on/off. The cell is solid or air.
- **Density:** a continuous number. Threshold it (`density > 0`) to decide solid vs empty.
- **Material / ID:** which stuff fills the cell (dirt, water, ore), not only filled vs empty.
- **Chunk:** a cube of voxels you load, generate, and mesh on its own (e.g. 16³ or 32³). How infinite worlds stay manageable.
- **LOD (level of detail):** coarser grids farther away. Volumes get expensive fast; LOD is not optional at planet scale.
- **Isosurface:** the surface where density equals a threshold. “The skin of the solid.”
- **Voxelize:** turn a mesh or an SDF into a grid of cells.
- **Mesh / extract:** turn a grid back into triangles so a GPU (Three.js) can draw it.

```
noise / SDF / rules  →  volume (voxels)  →  mesh or raymarch  →  what you see
```

---

## Why volumes (not only heightmaps)

| Heightmap (2D) | Volume (3D) |
|---|---|
| One height per `(x, z)` | A value at every `(x, y, z)` |
| Hills, islands, simple terrain | Overhangs, caves, floating rocks, buildings with rooms |
| Cheap: `N²` samples | Costly: `N³` samples |
| Easy to erode as a 2D map (your Sim tab) | Erosion, water, and destruction can move **through** space |

Use a heightmap until you need **holes** or **stacked solids**. Then you need a volume (or an implicit field you sample in 3D).

---

## What one voxel can store

The grid is the same; the **payload** changes the look and the algorithms.

| Encoding | Typical value | Use |
|---|---|---|
| **Binary occupancy** | 0 or 1 | Minecraft-like blocks, collision |
| **Density** | `[-1, 1]` or `[0, 1]` | Smooth terrain from 3D noise; threshold to solid |
| **SDF (signed distance)** | Distance to surface; negative inside | Smooth blobs, CSG (union/subtract), sphere tracing |
| **Material ID** | Integer | Palette of blocks |
| **Color / emission** | RGB | MagicaVoxel sculptures, glow |
| **Multi-channel** | density + wetness + temperature | Biomes, simulation |

**Signed distance field (SDF):** at point `p`, `sdf(p)` is how far you are from the surface, with a sign for inside/outside. A sphere is `length(p) - radius`. You can **union / subtract / intersect** shapes with `min` / `max` on the distances. Procedural worlds often mix SDF primitives with noise.

---

## Where the numbers come from (procedural)

You rarely paint every voxel by hand. You **evaluate a function** at the cell center (or corner):

```
density(p) = noise3D(p * frequency) + p.y * slopeBias
solid if density(p) > isolevel
```

Common recipes:

- **3D fBm / simplex / Perlin** as density → rolling caves when you also add a height term.
- **Worley / cellular** in 3D → organic pockets, stone, bone.
- **Domain warp** the position before sampling → twisted tunnels.
- **SDF planet:** `sdf = length(p) - R + noise(p) * amplitude` → a blob world with hills.
- **CSG:** subtract an SDF tunnel from a solid box.

Same seed + same `p` → same voxel. That is the point of procedural volumes.

---

## Seeing a volume (how it becomes graphics)

Three.js draws **triangles** (or raymarches in a shader). A raw 3D array is not a mesh yet.

### 1. Cubes (blocky)

One box per occupied voxel. Your pixel cube did this with instancing.

- Honest and readable.
- Triangle count explodes unless you **greedy mesh** (merge coplanar faces) or only emit **visible faces**.

### 2. Marching cubes (smooth)

Look at each 2×2×2 corner of the grid. The pattern of “above / below isolevel” picks a small triangle recipe. The result is a continuous surface through the density field.

Relatives: **marching tetrahedra**, **surface nets**, **dual contouring** (sharper edges, better for buildings).

### 3. Ray marching / volume rendering

Do not extract a mesh. For each pixel, step through the volume in a shader (clouds, smoke, medical scans). **Sphere tracing** walks an SDF with large steps.

### 4. Point / splats

One point or sprite per voxel. Fast preview; not a solid world.

For this class, **instanced cubes** or a **displaced surface** is enough. Marching cubes is the next step when the 8³ cube wants to become terrain.

---

## Scale and memory (the `N³` problem)

| Resolution | Cells (approx.) | Notes |
|---|---|---|
| 8³ | 512 | Toy (pixel cube). |
| 32³ | 33k | Small chunk; fine in JS. |
| 128³ | 2.1M | Still OK as density floats; meshing must be careful. |
| 512³ | 134M | Too big to store densely in a browser tab. |

**Sparse** structures store only filled (or interesting) cells:

- **Chunks** in a hashmap (Minecraft).
- **Octree / sparse voxel octree (SVO):** empty space is one big node.
- **Brickmaps / nanite-style voxel LODs:** research and high-end engines.

Never allocate a continent as one dense array.

---

## Simulation on volumes

Your **2D hydraulic erosion** runs on a heightmap. The 3D analogue uses the voxel grid as the world:

- **Cellular automata:** each cell looks at neighbors (caves, crystal growth, Game of Life in 3D).
- **Hydraulic / thermal erosion in 3D:** water occupies voxels, carves density, deposits sediment.
- **Flood fill:** connected air vs connected stone (playable caves).
- **Light / sky exposure:** raymarch occupancy for AO or sunlight.

Same idea as 2D Sim: **Start / Stop / Reset**, sliders for rates — but each step is `N³` work unless you only update dirty chunks.

---

## Tools and references (names you will hear)

| Name | What it is |
|---|---|
| **MagicaVoxel** | Desktop voxel editor. Good for thinking in cells. |
| **Minecraft / voxel engines** | Occupancy + chunks + greedy meshing. |
| **Marching cubes** (Lorensen & Cline, 1987) | Classic density → mesh. |
| **Dual contouring** | Better sharp features than marching cubes. |
| **OpenVDB** | Industry sparse volumes (film, Houdini). Heavy for a class prototype. |
| **Three.js** | Draw the mesh or instanced boxes; the volume itself is *your* arrays + noise. |

`Tutorials/Three.js + React resources.md` is for canvas/R3F demos. This note is for the **data**: what lives in 3D before it is a mesh.

---

## Mini cheat sheet

```
voxel     = one 3D cell
volume    = the 3D array (dense or sparse)
occupancy = solid or air
density   = continuous field; threshold → solid
SDF       = signed distance; good for smooth CSG
chunk     = tile of the volume you generate/mesh alone
extract   = marching cubes / greedy mesh / raymarch
```

**When to reach for voxels**

1. You need caves, overhangs, or interiors.
2. You want blocky, cell-legible form (pixel cube, ruins, machinery).
3. A simulation should eat or grow **space**, not only a 2D surface.

**When to stay on a heightmap**

Hills, coasts, your current 3D noise grid and 2D Sim. `N²` is kinder than `N³`.

---

## A 10-minute practice (think, then maybe code)

1. Write `density(x, y, z)` with 3D simplex (same library as the app). Solid if `density > 0`.
2. On paper or in a tiny loop, fill 16³ occupancy from that function.
3. Count how many cells are solid. Change frequency; watch the count jump.
4. Imagine meshing: cubes vs marching cubes. Which matches the look you want?

If those four steps make sense, you know enough volumetric data to plan a voxel pass on top of the existing noise prototype.

---

## When something looks scary

- **Out of memory / tab dies:** `N` is too large, or you instanced every empty cell. Cap resolution; skip air.
- **Caves don’t connect:** isolevel or frequency too high; visualize a 2D slice of the volume (your 2D Field is the cousin of a slice).
- **Mesh is holey:** occupancy on *cells* vs density on *corners* mixed up; marching cubes wants corner samples.
- **Seams between chunks:** generate a 1-cell overlap (halo) so neighbors share faces.
- **Smooth noise, blocky look:** you are drawing cubes. Extract an isosurface if you want smooth.

Volumes reward **small grids first**. Get 16³ right, then chunk, then LOD.
