# Procedural World Building — Fall ’26

## Contents

- [Progress by class](#progress-by-class)
  - [Class 01 — Intro](#class-01--intro-microscope--git)
  - [Class 02 — Web tools: React + Three.js](#class-02--web-tools-react--threejs)
  - [Class 03 — Noise Field + Simulations](#class-03--assignment-1-noise-field)
  - [Class 04 — Voxels](#class-04--voxels--terraforming)
  - [Class 05 — Shaders](#class-05--assignment-2-shaders)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Built with](#built-with)
- [Author](#author)

## Progress by class

### Class 01 — Intro

**Deck:** [PWB — Class 01](https://www.figma.com/deck/POK6565upmCTz79sU6Q2ns/PWB---Class-01)

**Class topics:** Course intro & PCG framing; Microscope-style worldbuilding; tools / version control (**Git + GitHub**).

**App progress:** Repo setup, `.gitignore`, first commits; planning / prompt log started.

<!-- ![Class 01](docs/progress/class-01/screenshot.png) -->

### Class 02 — Web tools: React + Three.js

**Deck:** [PWB — Class 02](https://www.figma.com/deck/PFjBPB5uuqJIZd3em9Kk7P)

**Class topics:** Traditional web stack (HTML / CSS / JS); tools — **React + Three.js** app shell.

**App progress:** React canvas with orbit camera; center object; live sliders; style-guide UI pass.

<!-- ![Class 02](docs/progress/class-02/screenshot.png) -->

### Class 03 — Noise Field + Simulations

**Deck:** [PWB — Class 03](https://www.figma.com/deck/Hc8vcT9xVjjd1p3sT5xKgQ/PWB---Class-03)

**Class topics / Assignment 1:** 3D grid in the viewport; 2D view of a noise equation; apply noise to the 3D grid; slider controls for noise + grid resolution; shaping ops via dropdown (+ own sliders). Extensions: layered noise, noise-type menu, blending.

**App progress:** 3D / 2D tabs; heightfield; hydraulic erosion sim on the 2D map; blue→red height coloring on the solid 3D mesh; grayscale heightmap preview.

<!-- ![Class 03](docs/progress/class-03/screenshot.png) --> 

<img width="1497" height="850" alt="Screenshot 2026-09-09 at 12 25 22 PM" src="https://github.com/user-attachments/assets/a89b6f06-9762-4bfe-93f5-f4ff46b8d8a2" />

<img width="1497" height="850" alt="Screenshot 2026-09-09 at 2 02 49 PM" src="https://github.com/user-attachments/assets/85570165-ecfe-4642-adf2-deece3f1e7c0" />


### Class 04 — Voxels

**Deck:** [PWB — Class 04](https://www.figma.com/deck/nGInnCOpuzyqmq9z8mFUod/PWB---Class-04)

**Class topics:** Geographic data, voxels, and terraforming.

**App progress:** Voxels tab from the shared 3D field; grid → Marching Cubes / Interactive drop down; UI graphic changes; tooltips; gradient mapping.

<!-- ![Class 04](docs/progress/class-04/screenshot.png) -->

<img width="1503" height="852" alt="Screenshot 2026-09-29 at 8 06 59 PM" src="https://github.com/user-attachments/assets/7cb1f053-14a6-472b-9ab6-770eed933347" />

<img width="1503" height="852" alt="Screenshot 2026-09-29 at 8 52 39 PM" src="https://github.com/user-attachments/assets/a91584cc-ea52-427b-b2a9-fd6b3bf656db" />

<img width="1509" height="852" alt="Screenshot 2026-09-30 at 8 34 40 AM" src="https://github.com/user-attachments/assets/e5d25818-1c76-4c8a-8df4-dd312fc8f0a2" />



### Class 05 — Shaders

**Deck:** [PWB — Class 05](https://www.figma.com/deck/XP1cVSq9wjUzFZuUn0ury1/PWB---Class-05)

**Class topics / Assignment 2:** Shader studies; show what shaders can do for simulations; choose strategies and why; dedicated in-app section to swap shader approaches.

**App progress:** Shader Studies; GLSL; technical implementation.

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
- [Three.js](https://threejs.org/) via [React Three Fiber](https://r3f.docs.pmnd.rs/) + [drei](https://github.com/pmndrs/drei)


## Author

**Sarah Rupani**
Course project for **DESIGN 6197 — Procedural World Building**, Cornell University, Fall 2026.
