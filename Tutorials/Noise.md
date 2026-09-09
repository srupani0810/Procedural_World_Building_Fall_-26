# Noise

A short glossary of **procedural noise**: random-looking fields you can evaluate at any point, the same way every time. Skim once, then look a word up when a paper, shader, or critique names a type or an equation.

Noise is not “a messy PNG.” It is a **function** `n(p)` from a position `p` to a number (usually about `[-1, 1]` or `[0, 1]`). Same seed and same `p` → same value. That repeatability is why you can build terrain, clouds, and caves from it.

```
position p  →  noise function  →  height / density / color / warp
```

---

## Shared words

- **Sample / evaluate:** compute `n` at one point `p`.
- **Seed:** the starting number that picks the random lattice. Change seed → a different but similar world.
- **Dimension:** 1D (a wiggle along a line), 2D (heightmaps), 3D (volumes, caves), 4D (3D + time).
- **Lattice:** the grid of integer cells the algorithm interpolates between.
- **Frequency:** how fast the pattern wiggles. Higher frequency → smaller features. Often written `f` or controlled by **scale**.
- **Amplitude:** how tall the wiggles are. Often written `A`.
- **Octave:** one layer of noise at a given frequency. Stacking octaves is how you get mountains *and* pebbles.
- **Lacunarity:** how much frequency grows each octave. Common default `2` (each layer twice as detailed).
- **Persistence / gain:** how much amplitude shrinks each octave. Common default `0.5` (each layer half as tall).
- **Fractal / fBm:** many octaves summed. Looks natural because nature is rough at many scales.
- **Coherent noise:** nearby points have nearby values (smooth-ish). Opposite of white noise.
- **Gradient:** a direction stored at a lattice point (Perlin). Not the same as “Photoshop gradient.”
- **Hash:** a tiny function that turns a grid index into a pseudo-random number or vector. Repeatable, not true random.
- **Period / tiling:** noise that repeats so a texture can wrap.
- **Domain:** the space you plug in (`p`, or a warped `p`).
- **Range:** the numbers that come out (`[-1, 1]` vs `[0, 1]`). Always know which you have before you add or abs().

---

## Spectral colors (what the randomness *sounds* like)

These names come from signal processing. They describe **energy vs frequency**, not a specific algorithm.

| Name | Spectrum (idea) | Looks like |
|---|---|---|
| **White noise** | Equal energy at every frequency | TV static. Adjacent pixels unrelated. |
| **Pink noise (1/f)** | Energy falls as `1/f` | Softer than white; some structure. |
| **Brown / Brownian / red (1/f²)** | Energy falls as `1/f²` | Very smooth wander (like a drunk walk). |
| **Blue noise** | More energy at high frequencies, little at low | Evenly spaced dots; good for dithering and sample points. Not great as terrain height by itself. |
| **Green / violet** | Other slopes of `1/f^β` | Rare in world-building talk. |

**Equation (power spectrum):** energy `E(f) ∝ 1 / f^β`

- `β = 0` white  
- `β = 1` pink  
- `β = 2` brown  

fBm terrain is often *close* to pink/brown depending on persistence. White noise is the raw random table **before** you interpolate.

---

## Lattice noises (the usual world-building kit)

These start from random numbers on a grid, then **interpolate** so the field is continuous.

### White noise

Independent random value at each sample. No interpolation.

```
n(p) = hash(floor(p))     // or a random table lookup
```

Use: dithering, hashing, jittering feature points. Do **not** use raw as hills (it is crunchy).

### Value noise

Each lattice point stores a **scalar**. You interpolate those numbers in between.

```
n(p) = interp( random values at the corners of the cell containing p )
```

Cheaper and lumpier than Perlin. Fine for cheap height, fog, or as a building block.

### Cubic / hermite value noise

Value noise with a smoother interpolant (cubic or quintic curves instead of a straight mix). Fewer grid artifacts.

### Perlin noise (gradient noise)

Ken Perlin, 1985; **improved Perlin** 2002. Each lattice point stores a **gradient vector**. The value is the interpolation of **dot products** (gradient · offset to `p`).

Looks smoother and more “natural” than value noise. The classic terrain starting point.

**Improved Perlin** uses a better fade curve and a fixed set of gradients so it bands less.

### Simplex noise / OpenSimplex

Perlin’s later design. Uses a simplex (triangles in 2D, tetrahedra in 3D) instead of a square/cube grid. Fewer corners to visit, fewer directional artifacts, cheaper in higher dimensions.

**OpenSimplex / OpenSimplex2** are patent-unencumbered relatives with similar goals. In new work, people often pick OpenSimplex2 or a library’s “simplex” and move on.

### Wavelet noise

Built so that each octave has a cleaner frequency band (less overlap than naive Perlin fBm). You will see it in film references; less common in class prototypes.

### Smooth noise (generic)

Not one algorithm. Usually means “value or Perlin, interpolated.” Ask which.

---

## Feature / cellular noises

### Worley noise (cellular / Voronoi noise)

Steven Worley, 1996. Scatter feature points (often one or more per cell). At `p`, measure **distance to the nearest points**.

```
F1(p) = min distance to a feature point
F2(p) = second-nearest distance
```

Looks like cells, cracks, cobble, leather, stone, biological tissue. Combinations (`F2 - F1`, `F1 * F2`) change the look a lot.

**Voronoi diagram** is the related partition of space into “closest point” cells. Worley is the *distance field* version used as noise.

### Manhattan / Chebyshev Worley

Same idea, different distance:

| Metric | Formula (2D) | Cell shape vibe |
|---|---|---|
| **Euclidean** | `√(x² + y²)` | Round-ish |
| **Manhattan** | `|x| + |y|` | Diamond |
| **Chebyshev** | `max(|x|, |y|)` | Square |

### Poisson-disk / blue-noise points

Points that keep a minimum spacing. Used as *seeds* for Worley or as scatter (trees, rocks), not as a height function by itself.

---

## Other named generators

- **Gabor noise:** sprinkle little Gabor kernels (windowed cosine waves). You can aim at a frequency and anisotropy (stretched ripples). More “designed spectrum” than Perlin.
- **Sparse convolution noise:** random pulses filtered into a smooth field. Ancestor of several film noises.
- **Flow noise (Perlin):** rotate gradients over time so the field looks like it is flowing, not merely sliding.
- **Curl noise:** take the **curl** of a potential noise field so the vector field is divergence-free (good for incompressible-looking fluid motion, particles, fog advection). Bridson’s trick: `v = ∇ × Ψ` with `Ψ` from Perlin.
- **Phasor / periodic noise:** built to tile or to hold a chosen period.
- **Value-Perlin hybrids:** mix value and gradient contributions; some libraries expose this as a quality/speed knob.
- **Texture / baked noise:** a noise image you sample. Fast, but resolution-limited and awkward to zoom forever. Procedural `n(p)` scales instead.

---

## Fractal recipes (equations you actually type)

One octave of “base noise” `N(p)` (Perlin, simplex, value, …) is usually too smooth. These **combine** octaves.

Let:

- `p` = position  
- `N(p)` = one octave, roughly `[-1, 1]`  
- `H` = persistence (often `0.5`)  
- `L` = lacunarity (often `2`)  
- `i` = octave index `0 … octaves-1`

### fBm (fractional Brownian motion)

The default “terrain-looking” sum.

```
fBm(p) = Σ  H^i  *  N( p * L^i )
         i
```

- Octave 0: big hills  
- Octave 1: medium ridges  
- Octave 2: small bumps  

**Persistence `H < 1`** keeps the sum from exploding. **Lacunarity `L > 1`** adds finer detail.

Musgrave and others treat fBm as a statistical process; in code it is almost always this weighted sum.

### Turbulence

fBm but you take **absolute value** each octave (folds negatives up). More billowy, like clouds or warped marble.

```
turb(p) = Σ  H^i  *  | N( p * L^i ) |
```

### Billow

Shift abs into a rounder 0–1 bump:

```
billow(p) = Σ  H^i  *  ( |N(p L^i)| * 2 - 1 )     // variants differ
```

Sometimes people just say “turbulence” for this family.

### Ridged (ridged multifractal)

Invert the abs so you get **sharp ridges** instead of valleys. Classic mountains.

```
n0 = 1 - |N(p)|
n  = n0²                    // sharpen
```

Then sum octaves, often **weighting** later octaves by the previous one (Musgrave) so ridges stay coherent:

```
signal = (1 - |N(p)|)²
sum    = signal
weight = 1
for i = 1 … :
    p     *= L
    weight = clamp(signal * k, 0, 1)
    signal = (1 - |N(p)|)²
    sum   += signal * weight * H^i
```

Constants `k` vary by implementation. The idea: **high ridges get detail; flats stay quieter**.

### Hybrid multifractal / hetero terrain

Musgrave variants where amplitude depends on the running height so peaks grow more roughness than lowlands (or the reverse). You will see them in old Terragen / libnoise docs. Same ingredients: `N`, `H`, `L`, plus a weight that tracks the sum so far.

### IQ / “Swiss” / erosion-ish fBm

Not one official spec. Common shader tricks (after Inigo Quilez and others):

- sum noise  
- **warp** `p` with previous octaves  
- subtract a slope term so steep areas erode  

Read as “fBm plus extra terms,” not as a separate noise *type*.

---

## Interpolation equations (what makes noise *coherent*)

Inside a cell, `t` is the 0–1 position between two lattice points.

**Linear mix (lerp):**

```
lerp(a, b, t) = a + t * (b - a)
```

Value noise with only lerp looks faceted.

**Smoothstep (Hermite, Perlin 1985 fade):**

```
fade(t) = 3t² - 2t³
```

**Quintic fade (improved Perlin 2002):**

```
fade(t) = 6t⁵ - 15t⁴ + 10t³
```

Second derivative is zero at the ends → fewer grid-aligned artifacts.

**Bilinear / trilinear:** lerp along x, then y, then z, using `fade(t)` on each axis.

---

## Perlin (one cell, idea)

In 2D, four corners of the unit cell have gradients `g00, g10, g01, g11`. Offsets from each corner to `p` are `d00, …`.

```
v00 = dot(g00, d00)
v10 = dot(g10, d10)
v01 = dot(g01, d01)
v11 = dot(g11, d11)

u = fade(x - floor(x))
v = fade(y - floor(y))

n = lerp( lerp(v00, v10, u), lerp(v01, v11, u), v )
```

That `n` is one octave of Perlin. fBm calls this at `p`, `2p`, `4p`, …

---

## Worley (idea)

```
cell = floor(p)
F1 = +∞
for each neighbor cell (including self):
    feature = cell + hash_to_point(cell)
    F1 = min(F1, distance(p, feature))
```

Then optionally track `F2` the same way. Output `F1`, `F2 - F1`, `F1 * F2`, etc.

---

## Domain tricks (same noise, different world)

These are **not** new noise types. They change the **input** or **output**.

### Scale and offset

```
N(p / scale + offset)
```

Larger `scale` → bigger features (if `scale` is world size per wiggle). Be consistent with your own naming: some UIs call this **frequency**.

### Octaves (see fBm)

### Domain warping (noise of noise)

```
p' = p + k * N(p)
n  = N(p')
```

Or two steps (IQ):

```
q  = N(p)
p' = p + k * N(p + q)
n  = N(p')
```

Makes swirled, organic, eroded-looking forms. Easy to overdo (`k` too large → spaghetti).

### Ridged / abs / square

```
|N|          // valleys and peaks both become peaks (turbulence)
1 - |N|      // ridges
N²           // flatten lows, keep peaks (and makes everything ≥ 0)
```

### Terracing / quantization

```
round(N * steps) / steps
```

Gives plateaus (mesa, contour farms).

### Clamp and remap

```
n01 = 0.5 + 0.5 * N          // [-1,1] → [0,1]
n   = smoothstep(a, b, n01)  // flatten a range
```

### Masking / layering

```
height = fBm_continent(p) + seaLevel
if height > beach:
    height += ridged_mountains(p) * mask
```

Real worlds are **several noises with different jobs**, not one magic `N`.

### Curl (vector)

```
v = ( ∂Ψz/∂y - ∂Ψy/∂z ,  ∂Ψx/∂z - ∂Ψz/∂x ,  ∂Ψy/∂x - ∂Ψx/∂y )
```

In 2D a cheap version uses one potential `Ψ`:

```
v = ( ∂Ψ/∂y , -∂Ψ/∂x )
```

Use for wind, flow lines, advection. Derivatives can be analytic or a tiny finite difference.

---

## What to pick (cheat sheet)

| You want | Start with |
|---|---|
| Rolling hills / continents | Perlin or simplex **fBm** |
| Sharp mountains | **Ridged** fBm |
| Clouds, marble, fire | **Turbulence** or warped fBm |
| Cracks, cobble, scales, islands of rock | **Worley** (`F1`, `F2 - F1`) |
| Swirled canyons / marble | **Domain warp** |
| Caves / 3D density | 3D fBm or Worley; threshold (`n > t` = solid) |
| Flow / particles | **Curl** of Perlin |
| Dither, grain, hash | **White** |
| Even scatter of objects | **Blue noise** / Poisson disk |
| Tiling texture | Periodic / tiled Perlin or a baked tileable map |

---

## Range and dimensions (easy bugs)

- Mixing `[-1, 1]` with `[0, 1]` without converting doubles height or clips wrongly.
- 2D noise on `xz` for a heightmap; 3D noise if you want overhangs or caves (`n(x,y,z)` as density).
- Animating: add time as another component `N(x, y, t)` or scroll `p + wind * t` (scroll looks cheaper; 3D/4D looks like it evolves in place).
- **Seed** vs **offset**: seed changes the hash table; offset slides the sample point. Both change the look; only offset is a smooth camera move.

---

## Mini equation sheet

```
lerp(a,b,t)           = a + t(b - a)
fade3(t)              = 3t² - 2t³
fade5(t)              = 6t⁵ - 15t⁴ + 10t³
fBm(p)                = Σ H^i N(p L^i)
turbulence(p)         = Σ H^i |N(p L^i)|
ridge_octave          = (1 - |N|)²
warp                  = N(p + k N(p))
Worley F1             = min_i ||p - feature_i||
n01                   = ½ + ½ N
```

---

## A 10-minute practice (do this)

1. Draw a 1D scribble: white (static) vs smooth (value/Perlin) vs fBm (big + small wiggles).
2. Write fBm with two octaves on paper with `H = 0.5`, `L = 2`.
3. Sketch `N`, `|N|`, and `1 - |N|` as 1D waves. Label which looks like clouds vs ridges.
4. For a heightmap, list two noises with different jobs (example: fBm continents + Worley rocks).
5. Name whether your library’s noise returns `[-1, 1]` or `[0, 1]` before you add it to a mesh.

If you can do that, you know enough to choose a noise and an equation in a procedural world.

---

## When two names collide

Ask three questions:

1. **Generator** — value, Perlin, simplex, Worley, white?  
2. **Spectrum / fractal** — one octave, fBm, ridged, turbulence?  
3. **Domain** — scaled, warped, 2D height, 3D density?

“Perlin mountains” usually means **ridged or fBm Perlin**, not a third algorithm. “Voronoi terrain” usually means **Worley distances as height or as a mask**.
