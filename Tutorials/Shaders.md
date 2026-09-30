# Shaders

A short map of **shader studies** for procedural world building and Three.js. You do not need to memorize GLSL. Skim the vocabulary, then pick one study at a time and look words up when a demo, paper, or critique names them.

A **shader** is a small program that runs on the GPU. Instead of CPU code placing every triangle color by hand, you describe rules: “for this pixel / vertex, compute this.” Same idea as noise functions — evaluate at a point, get a look — but wired into how the frame is drawn.

```
mesh / UVs / time / uniforms  →  vertex shader  →  fragment shader  →  pixels on screen
```

In this class stack you usually meet shaders as:

- **Three.js materials** that already hide a shader (`MeshStandardMaterial`, `MeshLambertMaterial`)
- **Custom `ShaderMaterial` / `RawShaderMaterial`** when you write the GLSL yourself
- **React Three Fiber** wrappers around those materials
- **Post-processing** passes (blur, bloom, color grade) that run fullscreen shaders after the scene

---

## Shared words

- **GPU:** graphics card. Runs many tiny shader invocations in parallel.
- **GLSL:** OpenGL Shading Language — the usual language in WebGL / Three.js examples. (WebGPU uses WGSL; same *ideas*.)
- **Vertex shader:** runs once per vertex. Moves points (`gl_Position`), can pass data to the fragment stage.
- **Fragment shader (pixel shader):** runs once per fragment (roughly: candidate pixel on a triangle). Chooses the final color (`gl_FragColor` / `out vec4`).
- **Uniform:** a value you set from JS that is **constant** for a whole draw (time, resolution, light direction, isolevel).
- **Attribute:** per-vertex input (position, normal, uv, color).
- **Varying / `in`–`out`:** values the vertex shader writes and the fragment shader reads (interpolated across the triangle).
- **UV:** 2D coordinates on a surface, usually `[0, 1]²`. The “canvas” for texture-like studies.
- **Normal:** surface direction; drives lighting.
- **Texture / sampler:** an image (or 3D volume) the shader can look up.
- **SDF (signed distance field):** a function that returns distance to a surface (negative inside). Great for raymarch studies.
- **Ray marching:** step along a ray in the fragment shader until you hit something (volumes, SDFs, clouds).
- **Pass / post-process:** draw the scene (or a quad) with a shader *after* the main 3D render.
- **Compile error:** GLSL failed to build. Three.js logs it in the browser console — read the line number.

```
JS (uniforms, geometry)  →  GPU program  →  framebuffer (what you see)
```

---

## Mental model: two stages

| Stage | Question it answers | Typical outputs |
|---|---|---|
| **Vertex** | Where do the points go? | Clip-space position, pass UVs / normals / world pos |
| **Fragment** | What color is this pixel? | RGB(A), sometimes depth tricks |

Beginner trap: trying to “sculpt terrain” only in the fragment shader on a flat quad is a **2D image study**. Sculpting a mesh in the vertex shader (displace by noise) is a **geometry study**. Both are valid; know which one you mean.

---

## Study tracks (pick one look per week)

Each block is a **study**: a small, named experiment with a clear visual goal. Do not combine five at once.

### 1. Gradient & palette

**Goal:** color from a coordinate or a height value.

- Mix two colors with `mix(a, b, t)`
- Smooth bands with `smoothstep`
- Height → palette (same idea as your Interactive voxel gradient stops)

**Uniforms:** none required; or `uTime` for a slow shift.

**Success:** a quad or terrain whose color clearly maps to `vUv.y` or world height.

---

### 2. Procedural noise in the shader

**Goal:** pattern without a texture file.

- Value / gradient noise in GLSL (or sample a noise texture you baked)
- fBm: sum octaves (same vocabulary as [Noise.md](./Noise.md))
- Domain warp: `n(p + n(p))` for swirls

**Success:** continuous, tileable-looking field; change seed / frequency with uniforms.

**Link to class:** your CPU FastNoiseLite heightfield is the cousin of this — shaders evaluate noise **per pixel** instead of per grid cell.

---

### 3. Lambert / Phong / toon lighting

**Goal:** form reading from light direction, not flat unlit color.

- **Lambert:** `max(dot(N, L), 0)` diffuse
- **Half-Lambert / wrap:** softer day side
- **Phong / Blinn:** specular highlight
- **Toon / cel:** quantize the lighting into bands

**Success:** a sphere or terrain chunk that turns as the light vector uniform moves.

Your Interactive voxels already use **Lambert + flat shading** on the CPU-built mesh; this study recreates that *inside* a custom material.

---

### 4. Vertex displacement (shader terrain)

**Goal:** move vertices with noise or a heightmap texture.

- In the vertex shader: `position.z += noise(uv) * uHeight` (or along the normal)
- Pass world height to the fragment shader for coloring

**Success:** a plane that looks like the 3D tab’s heightfield, but displacement happens on the GPU.

**Compare:** 3D tab displaces in JS each update; this study displaces every frame in GLSL (good for animation / LOD experiments).

---

### 5. Texture sampling & triplanar mapping

**Goal:** put detail on surfaces without ugly UV seams on terrain.

- Sample `texture2D` / `texture` with UVs
- **Triplanar:** blend projections from X, Y, Z axes using world normals — common on procedural cliffs

**Success:** rocky noise that sticks to slopes without obvious stretching on steep faces.

---

### 6. Fresnel, rim, and fake atmosphere

**Goal:** edge glow when the view grazes the surface.

- Fresnel-ish term: `pow(1.0 - max(dot(N, V), 0.0), exp)`
- Rim light for planets, characters, magic rocks

**Success:** silhouette reads clearly even on dark materials.

---

### 7. Transparency, cutout, and dither

**Goal:** holes and soft edges without perfect sorting.

- **Alpha cutout:** `discard` if alpha &lt; threshold (leaves, fences)
- **Dithered fade:** screen-door transparency (good for grass LOD)
- True alpha blend: order matters; harder in dense scenes

**Success:** a card of leaves that does not paint a solid rectangle.

---

### 8. Ray marching SDFs (object in a box)

**Goal:** draw a shape with math, not a triangle mesh.

- Fragment shader casts a ray from the camera through each pixel
- Sphere trace / step until `sdf(p) < epsilon`
- Shade with estimated normals from SDF gradients

**Classic starter SDFs:** sphere, box, torus, plane; combine with `min` / `max` (union / intersection / subtraction).

**Success:** a soft blob or CSG shape inside a cube, orbitable (your older voxel raymarch experiments sit in this family).

---

### 9. Volumetric / density raymarch

**Goal:** fog, clouds, or a 3D density field.

- Step through a volume; accumulate density / emission
- Sample a 3D texture (like packing a voxel density grid) or evaluate noise in 3D

**Success:** a misty cube or cloud bank; performance stays interactive at low step counts first.

**Link to class:** voxel **density grid** → upload as `Data3DTexture` → sample in the fragment shader (raymarch mode idea).

---

### 10. Screen-space post effects

**Goal:** treat the whole frame as an image.

- Render scene to a texture, draw a fullscreen triangle/quad
- Studies: vignette, color grade, film grain, blur, bloom, edge detect (Sobel), pixelate

**Success:** one clear look change with a single uniform (e.g. grain amount).

In R3F, people often use `@react-three/postprocessing` so you study the *look* without wiring every render target by hand.

---

### 11. Water / refraction sketches

**Goal:** a plane that feels wet.

- Scroll UVs with time + noise
- Fake refraction: offset screen UVs by normal XY
- Fresnel for reflections at grazing angles

**Success:** readable waves; do not chase ocean sims on day one.

---

### 12. Interactive uniforms (UI → GPU)

**Goal:** same habit as your React sliders, but driving a material.

- `uTime` from a clock
- `uColorA`, `uColorB` from a gradient editor
- `uAmp`, `uFreq` for noise

**Success:** moving a slider visibly changes the shader without rebuilding geometry.

---

## Mini recipe cards (starting points)

Use these as sketch prompts, not finished engines.

| Study | Fragment idea (sketch) | Vertex idea |
|---|---|---|
| Height color | `col = mix(blue, red, vWorldY)` | pass world Y |
| Pulsing glow | `intensity = 0.5 + 0.5*sin(uTime)` | — |
| Stripe UVs | `mod(vUv.x * n, 1.0) > 0.5` | — |
| Displace plane | sample height in fragment for color only | `pos += normal * n(uv)` |
| Soft circle | `smoothstep` on length(uv-0.5) | — |
| Lambert | `dot(normalize(vNormal), uLightDir)` | pass normal |
| SDF sphere | raymarch `length(p)-r` | fullscreen/box only |

---

## Three.js / R3F notes (this class)

| Approach | When to use |
|---|---|
| Built-in materials | Fast lighting/shadows; good default for meshes you already have |
| `onBeforeCompile` | Tweak Three’s shader without rewriting everything |
| `ShaderMaterial` | Full control; you supply vertex + fragment strings |
| `shaderMaterial` (drei) | Convenient R3F wrapper for custom materials |
| Node / TSL (newer Three) | Graph-like shaders; optional later learning path |

**Debugging habits:**

1. Open the browser console — GLSL errors show there.  
2. Output a debug color (`gl_FragColor = vec4(vUv, 0.0, 1.0)`) to prove data arrives.  
3. One uniform at a time.  
4. Cap raymarch steps (e.g. 32–64) before chasing quality.

---

## How shaders relate to your existing tabs

| App idea | Shader study cousin |
|---|---|
| 3D noise terrain (JS displacement) | Vertex displacement + height palette |
| 2D Field grayscale | Fullscreen noise fragment shader |
| Interactive voxels + gradient editor | Fragment coloring by height / custom ramp uniform array |
| Marching Cubes mesh | Usually CPU/GPU mesh extract first; shade with Lambert/standard |
| Density volume | 3D texture + volumetric raymarch |

Shaders do **not** replace a density grid — they **display** fields, light surfaces, or march through volumes you define.

---

## Study plan (order that usually works)

1. Gradient on a quad (UV → color)  
2. Add `uTime` pulse  
3. Lambert on a sphere  
4. Noise pattern on a quad  
5. Vertex-displace a plane with that noise  
6. Fresnel rim  
7. One post effect (vignette or grain)  
8. Only then: SDF raymarch or volume steps  

If a study is ugly, simplify uniforms until one idea reads clearly — same rule as critique boards.

---

## 20-minute practice

1. Create a fullscreen or large plane material with a custom fragment shader.  
2. Color by `vUv` (prove UVs work).  
3. Replace with `mix(colorA, colorB, vUv.y)` driven by two color uniforms.  
4. Add `uTime` and scroll or pulse something subtle.  
5. Write three sentences: what ran per vertex, what ran per pixel, what the uniform did.

If you can explain those three, you are ready for noise or lighting studies.

---

## Common failure modes

| Symptom | Likely cause |
|---|---|
| Black mesh | Shader compile error; or lights missing with a lit custom shader |
| Flat pink / error color | Material failed; check console |
| Seams on terrain textures | UVs; try triplanar |
| Raymarch too slow | Step count / resolution too high |
| “It works in the example but not in R3F” | Lights, `toneMapped`, color space, or missing `extensions` / precision |

---

## Resources (studies to watch / fork)

| Resource | Why |
|---|---|
| [The Book of Shaders](https://thebookofshaders.com/) | Best beginner fragment intuition (2D). |
| [three.js shader examples](https://threejs.org/examples/?q=shader) | Official WebGL patterns you can port. |
| [Shadertoy](https://www.shadertoy.com/) | Fragment-only playground (raymarch &amp; image culture). |
| [Inigo Quilez articles](https://iquilezles.org/articles/) | SDFs, filtering, distance functions. |
| [R3F / drei materials](https://drei.docs.pmnd.rs/) | `shaderMaterial`, `MeshDistortMaterial`, etc. |
| [Noise.md](./Noise.md) | Shared language for fBm, domain warp, octaves. |
| [Voxels.md](./Voxels.md) | Density, isosurfaces, when volumes need raymarch. |

---

## Mini cheat sheet

```
vertex shader     → where points go
fragment shader   → what pixels look like
uniform           → JS → GPU knobs (time, colors, amp)
UV                → 2D surface coordinates
SDF + raymarch    → shapes/volumes without a mesh
post process      → shader on the whole frame
```

**Study rule:** one visual idea, one shader, a few uniforms. Name the study (“rim only”, “fBm warp”, “height palette”) the same way you name a critique board.
