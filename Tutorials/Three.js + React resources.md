# Three.js + React resources

A starter map for imagining what this stack can do. You already have the pattern: a **full-window Three.js canvas** (React Three Fiber) plus a **React overlay** (sliders, labels). Almost every project below is that idea taken further.

Open things in a browser first. Steal *feel* and interaction, not whole codebases.

---

## Start here (catalogs)

These are the two “walk the museum” pages. Click until something clicks.

| Resource | Why look |
|---|---|
| [three.js examples](https://threejs.org/examples/) | Official lab: geometry, shaders, particles, post-processing, loaders. Vanilla Three.js, but every idea ports to Fiber. |
| [React Three Fiber examples](https://r3f.docs.pmnd.rs/getting-started/examples) | Same energy, written as React. Live demos + source. The main “what is possible with R3F” page. |
| [pmndrs examples site](https://pmndrs.github.io/examples/) | Thumbnail grid of Fiber experiments (glass, portals, physics, configurators). |
| [drei docs](https://drei.docs.pmnd.rs/) | Helpers you already use (`OrbitControls`). Browse for `Float`, `Environment`, `Html`, `MeshDistortMaterial`, `ContactShadows`, `ScrollControls`. |

---

## Fiber demos worth opening

Hand-picked from the pmndrs set. Each one is a different *kind* of project.

| Demo | What it shows |
|---|---|
| [T-shirt configurator](https://pmndrs.github.io/examples/t-shirt-configurator) | Product + UI: React controls change a 3D object. Closest cousin to your blob panel. |
| [Shopping](https://pmndrs.github.io/examples/shopping) | Pick objects in the scene; UI and 3D stay in sync. |
| [Image gallery](https://pmndrs.github.io/examples/image-gallery) | Scroll + 3D frames. HTML/React sitting on meshes. |
| [Horizontal tiles](https://pmndrs.github.io/examples/horizontal-tiles) | Camera/scroll as the interface. |
| [Caustics](https://pmndrs.github.io/examples/caustics) | Light through volume — “pretty material” research. |
| [Glass flower](https://pmndrs.github.io/examples/glass-flower) | Transmission, bloom, studio lighting. |
| [Frosted glass](https://pmndrs.github.io/examples/frosted-glass) | Layered materials. |
| [Enter portals](https://pmndrs.github.io/examples/enter-portals) | Nested worlds / scenes inside scenes. |
| [Flying bananas](https://pmndrs.github.io/examples/flying-bananas) | Instancing + depth of field (lots of objects, cheaply). |
| [Thunder clouds](https://pmndrs.github.io/examples/thunder-clouds) | Volumetric look without a full sim. |
| [Christmas baubles](https://pmndrs.github.io/examples/bestservedbold-christmas-baubles) | Physics (Rapier) hanging in a React tree. |
| [Bruno’s 20k challenge](https://pmndrs.github.io/examples/bruno-simons-20k-challenge) | Small playable space, physics, shadows. |
| [GLTF drone](https://pmndrs.github.io/examples/gltfjsx-400kb-drone) | Loaded model + effects (`gltfjsx` workflow). |
| [Lusion connectors](https://pmndrs.github.io/examples/lusion-connectors) | Graph / node-like 3D (useful if you think in TD/Max). |

Full list lives on the [R3F examples doc](https://r3f.docs.pmnd.rs/getting-started/examples).

---

## Sites that stretch “a canvas + a website”

Finished work, not tutorials. Good for ambition, not for copying line-by-line.

| Site | Notes |
|---|---|
| [bruno-simon.com](https://bruno-simon.com) | The classic “portfolio as a tiny 3D world.” Orbit, collide, discover. |
| [Three.js Journey](https://threejs-journey.com) | Bruno’s course. Paid. Best structured path if you want fundamentals *and* React later. |
| [Lusion](https://lusion.co) | High-end WebGL studio. Watch how 3D and UI share one page. |
| [Active Theory](https://activetheory.net) | Campaign / immersive sites. Scale of production. |
| [Codrops (Three.js tag)](https://tympanus.net/codrops/?s=three.js) | Write-ups with demos: scroll, waves, transitions. Mix of vanilla and React. |
| [Awwwards WebGL](https://www.awwwards.com/websites/webgl/) | Browse awarded 3D sites; quality varies, ideas do not. |

---

## Procedural / world-shaped

Closer to this class (forms, fields, systems) than to a product shot.

| Resource | Notes |
|---|---|
| [three.js examples → search “terrain”, “marching cubes”, “gpgpu”, “points”](https://threejs.org/examples/) | Heightfields, metaballs, GPU particles. Your blob is a tiny cousin of marching cubes / displacement. |
| [The Book of Shaders](https://thebookofshaders.com) | GLSL, 2D first. The language of “fields” that become 3D surfaces. |
| [Inigo Quilez articles](https://iquilezles.org/articles/) | Distance fields, noise, coloring. Dense; sample, don’t binge. |
| [Three.js Displacement / noise patterns](https://threejs.org/examples/#webgl_geometry_terrain) | Classic terrain example (vanilla). |
| [react-three-rapier](https://github.com/pmndrs/react-three-rapier) | Physics in Fiber if the world should fall, stack, or bounce. |
| [Theatre.js](https://www.theatrejs.com) | Timeline / animation studio that can drive Three/R3F — Max-like sequencing in the browser. |

---

## Docs and libraries (when you want to *build*)

| Resource | Role |
|---|---|
| [Three.js manual](https://threejs.org/manual/) | How the engine thinks (scene, camera, mesh, material). |
| [Three.js docs](https://threejs.org/docs/) | Look up `IcosahedronGeometry`, `OrbitControls`, materials. |
| [R3F docs](https://r3f.docs.pmnd.rs/) | `Canvas`, `useFrame`, events, TypeScript. |
| [pmndrs/racing-game](https://github.com/pmndrs/racing-game) | Full Fiber game as a readable repo. |
| [gltfjsx](https://github.com/pmndrs/gltfjsx) | Turn a `.glb` into a React component. |
| [react-postprocessing](https://github.com/pmndrs/react-postprocessing) | Bloom, DOF, noise overlays as React children. |
| [Maxime Heckel’s writing](https://blog.maximeheckel.com) | Clear R3F + shader essays. |
| [Discover three.js](https://discoverthreejs.com) | Free book-style intro (vanilla). |

---

## Ways this stack shows up (so you can name a direction)

React is the **panel**; Three.js is the **world**. Combinations that keep coming up:

1. **Instrument** — sliders, readouts, a live mesh (what you have). Expand: more params, scopes, presets.
2. **Configurator** — pick color / part / seed; export or screenshot.
3. **Tiny world** — one navigable space (Bruno-style), UI as HUD.
4. **Scroll story** — the page is the timeline; 3D reacts to scroll.
5. **Field / sim** — noise, particles, fluids-looking shaders, not a single blob.
6. **Loaded set** — a GLB from Blender, lit and annotated in React.
7. **Graph** — nodes in 3D (Lusion connectors) if you think in TouchDesigner.

You do not need all seven. One of them, done small, is a studio.

---

## How to use this list

1. Spend 20 minutes on [three.js examples](https://threejs.org/examples/) and [pmndrs examples](https://pmndrs.github.io/examples/). Note three that feel like *your* project.
2. Open their source (R3F page links it). Ignore post-processing at first; look at **scene + UI**.
3. Bring back **one** idea into `react-app` (a material, a control, a camera move) — not a whole demo.

If a link 404s, search the title on [r3f.docs.pmnd.rs](https://r3f.docs.pmnd.rs/getting-started/examples) or [threejs.org/examples](https://threejs.org/examples/). Names move; the catalogs stay.
