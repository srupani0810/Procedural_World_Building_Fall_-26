# Procedural World Building — Fall ’26

Interactive **React + Three.js** terrain playground for Cornell **DESIGN 6197**. Explore shared noise fields in 3D and 2D, run a hydraulic erosion sim, and walk an infinite voxel world with Marching Cubes or blocky Interactive meshing.

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Project structure](#project-structure)
- [Built with](#built-with)
- [Author](#author)

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
