# Procedural World Building — Fall ’26

Interactive **React + Three.js** terrain playground for Cornell **DESIGN 6197**. Explore shared noise fields in 3D and 2D, run a hydraulic erosion sim, and walk an infinite voxel world with Marching Cubes or blocky Interactive meshing.

## Contents

- [Progress by class](#progress-by-class)
  - [Class 01 — Intro, Microscope & Git](#class-01--intro-microscope--git)
  - [Class 02 — Web tools: React + Three.js](#class-02--web-tools-react--threejs)
  - [Class 03 — Assignment 1: noise field](#class-03--assignment-1-noise-field)
  - [Class 04 — Voxels & terraforming](#class-04--voxels--terraforming)
  - [Class 05 — Assignment 2: shaders](#class-05--assignment-2-shaders)
- [Features](#features)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Project structure](#project-structure)
- [Built with](#built-with)
- [Author](#author)

## Progress by class

Organized to match Jose Sanchez’s **PWB** class decks. Screenshots go in [`docs/progress/class-0X/`](./docs/progress/). After you add an image, remove the `<!--` / `-->` around that class’s `![…](…)` line.

### Class 01 — Intro, Microscope & Git

**Deck:** [PWB — Class 01](https://www.figma.com/deck/POK6565upmCTz79sU6Q2ns/PWB---Class-01)

**Class topics:** Course intro & PCG framing; Microscope-style worldbuilding; tools / version control (**Git + GitHub**).

**App progress:** Repo setup, `.gitignore`, first commits; planning / prompt log started.

<!-- ![Class 01](docs/progress/class-01/screenshot.png) -->

### Class 02 — Web tools: React + Three.js

**Deck:** [PWB — Class 02](https://www.figma.com/deck/PFjBPB5uuqJIZd3em9Kk7P)

**Class topics:** Traditional web stack (HTML / CSS / JS); tools — **React + Three.js** app shell.

**App progress:** Vite + React canvas with orbit camera; center object (cube → blob → Halloween); live sliders; style-guide UI pass.

<!-- ![Class 02](docs/progress/class-02/screenshot.png) -->

### Class 03 — Assignment 1: noise field

**Deck:** [PWB — Class 03](https://www.figma.com/deck/Hc8vcT9xVjjd1p3sT5xKgQ/PWB---Class-03)

**Class topics / Assignment 1:** 3D grid in the viewport; 2D view of a noise equation; apply noise to the 3D grid; slider controls for noise + grid resolution; shaping ops via dropdown (+ own sliders). Extensions: layered noise, noise-type menu, blending.

**App progress:** **3D / 2D** tabs with FastNoiseLite heightfield; hydraulic erosion sim on the 2D map; blue→red height coloring on the solid 3D mesh; grayscale heightmap preview.

<!-- ![Class 03](docs/progress/class-03/screenshot.png) -->

### Class 04 — Voxels & terraforming

**Deck:** [PWB — Class 04](https://www.figma.com/deck/nGInnCOpuzyqmq9z8mFUod/PWB---Class-04)

**Class topics:** Geographic data, **voxels**, and terraforming (incl. Sebastian Lague–style references).

**App progress:** **Voxels** tab from the shared 3D field; real `density(x,y,z)` grid → **Marching Cubes** / **Interactive** (greedy mesh, gradient editor, click edit); infinite chunk streaming; dark/red accordion UI + tooltips.

<!-- ![Class 04](docs/progress/class-04/screenshot.png) -->

### Class 05 — Assignment 2: shaders

**Deck:** [PWB — Class 05](https://www.figma.com/deck/XP1cVSq9wjUzFZuUn0ury1/PWB---Class-05)

**Class topics / Assignment 2:** Shader studies; show what shaders can do for simulations; choose strategies and why; dedicated in-app section to swap shader approaches.

**App progress:** Shader notes in [`Tutorials/Shaders.md`](./Tutorials/Shaders.md); in-app shader swapper still to land — drop study screenshots here as you build them.

<!-- ![Class 05](docs/progress/class-05/screenshot.png) -->

<details>
<summary>How to add a class’s screenshots</summary>

1. Save a PNG/JPG into the matching folder, e.g. `docs/progress/class-03/erosion.png`.
2. Under that class in this README, turn on the image line (delete `<!--` and `-->`), or add another:

   ```markdown
   ![Erosion sim](docs/progress/class-03/erosion.png)
   ```

3. Commit the image(s) and the README, then push — they appear on the GitHub repo page.
4. For the next class deck: add `docs/progress/class-06/`, a TOC link, and a matching `### Class 06 — …` section (with the Figma deck URL).

</details>

## Features

- **3D view** — rotatable heightfield mesh driven by FastNoiseLite (simplex and related types)
- **2D view** — raw noise preview plus a hydraulic erosion simulation with start / stop / reset and parameter sliders
- **Voxels view** — world-space density grid streamed in chunks around the camera
  - **Interactive** — face-culled greedy mesh, custom height gradient colors, click to remove / shift-click to add
  - **Marching Cubes** — smooth isosurface from the same density field
- Shared **Noise** and **Field** controls (zoom, height, layers, grid detail) across views
- Dark / red control panel with collapsible sections and chevron tooltips

## Requirements

- **Node.js 24+** (see `react-app/.nvmrc`)
- **npm**

On macOS with nvm:

```bash
cd react-app
nvm use
```

## Getting started

```bash
git clone https://github.com/srupani0810/Procedural_World_Building_Fall_-26.git
cd Procedural_World_Building_Fall_-26/react-app
npm install
npm run dev
```

Open the URL Vite prints (usually [http://localhost:5173](http://localhost:5173)).

Other scripts:

```bash
npm run build    # production build → react-app/dist
npm run preview  # preview the production build
```

## Usage

1. Use the **3D / 2D / Voxels** tabs at the top of the panel to switch views.
2. Orbit the 3D / voxel scene with the mouse (drag to rotate, scroll to zoom).
3. Open accordion sections (**Noise**, **Field**, **Voxel world**, **Meshing**, etc.) to tweak parameters.
4. Hover a section’s expand/collapse arrow for a short tip on what that group controls.
5. In **Voxels → Interactive**, click a face to remove a voxel; **shift-click** to add one next to the clicked face.
6. In **2D**, open the erosion controls to start / stop / reset the simulation and adjust droplet & sediment parameters.

## Project structure

```text
├── README.md                 # Repo front page (you are here)
├── .gitignore                # Keeps node_modules, dist, .env out of GitHub
├── Style Guide.md            # UI / visual direction notes
├── docs/
│   └── progress/             # Class screenshots for the README
│       ├── class-01/         # … class-05 (match PWB decks)
├── Analysis/                 # Class analysis notes
├── Planning/                 # Planning notes and prompt log
├── Tutorials/                # Beginner how-tos (React, Git, Firebase, voxels, …)
└── react-app/                # Runnable Vite + React + Three.js app
    ├── package.json
    ├── index.html
    ├── public/
    └── src/
        ├── App.tsx           # App shell / view mode
        ├── AppChrome.tsx     # Control panel UI
        ├── Scene.tsx         # 3D heightfield scene
        ├── VoxelScene.tsx    # Infinite voxel chunk world
        ├── HeightMapView.tsx # 2D heightmap + erosion UI
        ├── erosion.ts        # Hydraulic erosion sim
        ├── voxelGrid.ts      # Chunk density builder
        ├── voxelGreedyMesh.ts
        └── …
```

Class notes: [Tutorials](./Tutorials/) · planning: [Planning](./Planning/) · app source: [react-app/src](./react-app/src/)

## Built with

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Three.js](https://threejs.org/) via [React Three Fiber](https://r3f.docs.pmnd.rs/) + [drei](https://github.com/pmndrs/drei)
- [FastNoiseLite](https://github.com/Auburn/FastNoiseLite)

## Author

Course project for **DESIGN 6197 — Procedural World Building**, Cornell University, Fall 2026.
