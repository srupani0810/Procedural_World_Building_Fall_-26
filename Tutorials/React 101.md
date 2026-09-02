# React 101

A short, practical intro if you have never used React **or** the command line. Follow the steps in order. You do not need to memorize anything. Copy the commands, press Return, and look things up when you get stuck.

This walkthrough puts a **basic React + TypeScript** app **inside this class project**, in a folder called `react-app`. It uses **Node.js 24** (not 18). Vite’s current React starter will error on Node 18.

---

## Command line in 60 seconds

The **command line** (on a Mac, the **Terminal** app) is a text box where you type instructions instead of clicking folders.

Open it: press `Command + Space`, type **Terminal**, press Return.

A few words you will use constantly:

| Word | Meaning |
|---|---|
| **command** | A short instruction, like `ls` or `cd` |
| **folder / directory** | Same idea as a Finder folder |
| **path** | The address of a folder, like `Documents/MyProject` |
| **prompt** | The line where you type; after a command finishes, you get a new prompt |

Type a command, then press **Return**. If something fails, Terminal prints an error. Copy the **whole** error if you ask for help.

### Commands you need for this tutorial

```bash
pwd          # print where I am (print working directory)
ls           # list files in this folder
cd           # change directory (move into a folder)
```

**Spaces in folder names** need quotes. This class folder has spaces and an apostrophe, so always quote the path:

```bash
cd "/Users/carz786/Documents/Cornell Semester 3 (Fall '26)/DESIGN 6197 (Procedural World Building)/Procedural_World_Building_Fall_'26"
```

Easier trick: type `cd ` (with a space after `cd`), then drag the project folder from Finder onto the Terminal window. Terminal fills in the path for you. Press Return.

Check you are in the right place:

```bash
pwd
ls
```

You should see folders like `Tutorials`, `Planning`, and `Analysis`.

To go **up** one folder: `cd ..`

---

## What is React?

**React** is a JavaScript library for building user interfaces. Instead of one giant HTML file you update by hand, you build the page from small reusable pieces called **components**. When data changes, React updates the screen for you.

**TypeScript** is JavaScript plus optional type labels (for example, “this prop is a string”). Vite’s React TypeScript template is still the basic starter — it is not a different, heavier React. Files use `.tsx` instead of `.jsx`.

React is not an app you download like Photoshop. You need **Node.js** (which includes `npm`), then you create a React project. The browser still shows HTML, CSS, and JavaScript — React is the tool that helps you write that UI.

```
Your components (TSX)  →  React  →  what the browser shows
```

---

## Words you will see constantly

- **Node.js:** runs JavaScript on your computer (not only in the browser). This class setup uses **version 24**.
- **nvm:** Node Version Manager. It is already on this Mac. It lets you install several Node versions and pick which one is active. Your default has been **18**, which is too old for current Vite.
- **npm:** the package manager that comes with Node. It downloads React and other libraries.
- **Component:** a function that returns UI. Think of it as a custom HTML tag, like `<Button />`.
- **JSX / TSX:** HTML-looking syntax inside JavaScript/TypeScript files. `.tsx` is the TypeScript version.
- **Props:** inputs you pass into a component, like arguments to a function.
- **State:** data a component remembers. When state changes, the screen re-renders.
- **Vite:** the beginner-friendly tool that creates a React project and runs a local preview server.
- **localhost:** your own computer. `http://localhost:5173` is a website that only you can see while the preview server is running.

---

## Step 1 — Switch Node.js to version 24 (do this once)

This Mac already has **nvm**. Do **not** install Node from nodejs.org on top of that — nvm would still default to 18.

If `nvm` is “not found,” load it first (then keep using the same Terminal window):

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

### 1. Install Node 24 and make it the default

```bash
nvm install 24
nvm alias default 24
nvm use 24
```

- `nvm install 24` downloads the latest Node 24 (currently the 24 LTS line).
- `nvm alias default 24` makes **new** Terminal windows start on 24 instead of 18.
- `nvm use 24` switches **this** window to 24 right now.

### 2. Check that it worked

```bash
node -v
npm -v
```

`node -v` must start with **`v24.`** (for example `v24.20.0`). If you still see `v18.`, run `nvm use 24` again, then `node -v`.

**Every time you open a new Terminal** (until default 24 is set), if `node -v` shows 18:

```bash
nvm use 24
```

---

## Step 2 — Create the React + TypeScript app in this project

You should already be in the class project folder (see `pwd` above). If not, `cd` there first. Confirm Node 24 is active (`node -v`).

This is the **most basic** official starter: Vite + React + TypeScript. No React Compiler, no extra UI kit.

```bash
npm create vite@latest react-app -- --template react-ts
```

`--template react-ts` means: React, TypeScript, default Vite template. That skips the “which framework?” and “which language?” menus.

### If Terminal still asks questions

Vite sometimes asks a couple of extra yes/no questions even with the template. Use the **arrow keys** to highlight an option, then press **Return**.

| Question (wording may vary slightly) | Answer | Why |
|---|---|---|
| Project name | `react-app` (or just press Return if that is already filled in) | Folder name inside this repo |
| Select a framework | **React** | Not Vue, Svelte, Vanilla, etc. |
| Select a variant | **TypeScript** | Not JavaScript. Skip “React Compiler” / “TypeScript + SWC” if those appear — Compiler is extra. |
| Use rolldown-vite (Experimental)? | **No** | Keep the basic, stable Vite. |
| Install with npm and start now? | **No** | You will `npm install` yourself in the next commands so you can see each step. |

If a question is not in this table, pick the default (the one already highlighted) unless it says Experimental, Compiler, or a linter you did not ask for — then choose **No**.

If npm asks `Ok to proceed? (y)` while downloading `create-vite`, type `y` and press Return.

### Then install and run

```bash
cd react-app
echo 24 > .nvmrc
nvm use
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm create vite@latest ... -- --template react-ts` | Makes the `react-app` folder with the basic React + TypeScript starter |
| `echo 24 > .nvmrc` | Remembers “this folder wants Node 24.” Later, `nvm use` inside `react-app` switches automatically |
| `npm install` | Downloads React into `node_modules/` (do not edit that folder) |
| `npm run dev` | Starts a local website so you can preview while you work |

Leave this Terminal window **open** while you work. The server keeps running until you stop it.

---

## Step 3 — Open it in the browser

Terminal will print a local address, usually:

```
http://localhost:5173
```

Hold `Command` and click the link, or paste it into Chrome / Safari / Arc. You should see the Vite + React starter page.

**To stop the server later:** click the Terminal window and press `Control + C`. You get your prompt back. That does not delete the project.

---

## Everyday workflow after the first setup

You do **not** create the app again. Next time you sit down:

1. Open Terminal.
2. Go into the app folder:

```bash
cd "/Users/carz786/Documents/Cornell Semester 3 (Fall '26)/DESIGN 6197 (Procedural World Building)/Procedural_World_Building_Fall_'26/react-app"
```

(Or `cd ` + drag the `react-app` folder from Finder.)

3. Switch to Node 24 (needed if this window still shows 18):

```bash
nvm use
node -v
```

You want `v24.x.x`. (`nvm use` reads the `.nvmrc` file.)

4. Start the preview:

```bash
npm run dev
```

5. Edit files in `react-app/src/`, save, watch the browser update.
6. When you are done: `Control + C` in Terminal.

`npm install` is only needed again if you clone the project on a new computer, or if someone adds a new library.

---

## What you just created

Inside this class repo you now have `react-app/`. Typical files:

| File / folder | What it is |
|---|---|
| `package.json` | Project name, scripts (`dev`, `build`), and library list |
| `index.html` | The single HTML page the browser loads |
| `src/` | **Your** code lives here |
| `src/main.tsx` | Starts React and attaches it to the page |
| `src/App.tsx` | The main component you will edit first |
| `src/index.css` | Global styles |
| `tsconfig.json` | TypeScript settings (you can ignore this at first) |
| `.nvmrc` | Tells nvm to use Node 24 in this folder |
| `node_modules/` | Downloaded libraries (huge; do not commit this to Git) |
| `public/` | Static files (images, favicon) |

You almost always edit files inside `src/`. Use **`.tsx`** for components that contain HTML-like markup.

---

## Your first edit

Open `react-app/src/App.tsx`. Replace everything with:

```tsx
function App() {
  return (
    <div>
      <h1>Hello, world</h1>
      <p>This is my first React app.</p>
    </div>
  );
}

export default App;
```

Save the file. If `npm run dev` is still running, the browser should update **without** a full refresh.

A few TSX rules that bite beginners:

- Return **one** parent element (or a fragment `<>...</>`).
- Use `className` instead of `class`.
- Close every tag: `<img />`, `<br />`.
- JavaScript inside TSX uses curly braces: `<h1>{title}</h1>`.

---

## Components

A component is a function whose name starts with a capital letter and that returns TSX.

Create `react-app/src/Greeting.tsx`:

```tsx
function Greeting() {
  return <p>Welcome to the studio.</p>;
}

export default Greeting;
```

Use it in `App.tsx`:

```tsx
import Greeting from "./Greeting.tsx";

function App() {
  return (
    <div>
      <h1>Hello, world</h1>
      <Greeting />
    </div>
  );
}

export default App;
```

If the import without `.tsx` already works in your starter, you can write `from "./Greeting"` instead. Both are fine.

`<Greeting />` is you calling that function. Split the UI into components when a piece has a clear job (header, card, button, map panel).

---

## Props (passing data in)

Props are how a parent sends information to a child. In TypeScript you label the prop types in `{ name }: { name: string }`.

```tsx
function Greeting({ name }: { name: string }) {
  return <p>Welcome, {name}.</p>;
}

export default Greeting;
```

```tsx
<Greeting name="Ada" />
<Greeting name="Lin" />
```

Same component, different data. That is the point of reusable pieces. If you write `<Greeting name={3} />`, TypeScript will complain because `3` is not a string.

---

## State (remembering data)

When something should change **after** the page loads (a click, a slider, a form), use state.

```tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times.</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </div>
  );
}

export default Counter;
```

- `useState(0)` means “start at 0.”
- `count` is the current value.
- `setCount(...)` updates it. React then re-runs the component and shows the new number.

Do not do `count = count + 1`. Always use the setter (`setCount`).

---

## Lists (a preview you will need)

To show many items, `.map()` an array and give each child a unique `key`:

```tsx
const biomes = ["forest", "desert", "tundra"];

{biomes.map((biome) => (
  <li key={biome}>{biome}</li>
))}
```

`key` helps React tell items apart when the list changes. Use a stable id when you have one; the name is fine for this tiny example.

---

## Mini cheat sheet

```bash
pwd
ls
cd "path/with spaces"

nvm install 24
nvm alias default 24
nvm use 24
node -v                 # must be v24.x.x

cd "/Users/carz786/Documents/Cornell Semester 3 (Fall '26)/DESIGN 6197 (Procedural World Building)/Procedural_World_Building_Fall_'26"
npm create vite@latest react-app -- --template react-ts
cd react-app
echo 24 > .nvmrc
nvm use
npm install
npm run dev
```

Installer answers if asked: **React** → **TypeScript** → **No** to experimental / React Compiler → **No** to “install and start now.”

Later sessions: `cd` into `react-app`, then `nvm use`, then `npm run dev`. Stop with `Control + C`.

In code:

| Idea | Example |
|---|---|
| Component | `function Card() { return <div>...</div>; }` |
| Use a component | `<Card />` |
| Props | `<Card title="Hill" />` |
| Typed prop | `{ title }: { title: string }` |
| State | `const [n, setN] = useState(0)` |
| Click | `<button onClick={() => setN(n + 1)}>` |
| Show a variable | `{n}` |

Optional production build (you do not need this to learn):

```bash
npm run build
```

That outputs static files in `dist/`.

---

## A 10-minute practice (do this)

1. Run `nvm install 24`, `nvm alias default 24`, `nvm use 24`. Confirm `node -v` is `v24.x.x`.
2. From this class project folder, create `react-app` with `--template react-ts` and open `http://localhost:5173`.
3. Change `src/App.tsx` so it shows your name in an `<h1>`.
4. Add a `Greeting` component with a typed `name` prop and use it twice.
5. Add a `Counter` with a button that increments a number.

If those five steps work, you know enough React, TypeScript, and Terminal to start a small class prototype.

---

## When something looks scary

Paste the error into a search (or ask a classmate / instructor) **with the exact command you ran or the file you saved**. The usual causes are:

- `node -v` still shows **v18** → `nvm use 24` (or `nvm use` inside `react-app`). Vite will fail on 18.
- `nvm: command not found` → run the two `NVM_DIR` lines in Step 1, or open a new Terminal after `nvm` was installed.
- You are in the wrong folder. Run `pwd`. You must be in the class project to *create* the app, and inside `react-app` to run `npm install` / `npm run dev`.
- Folder names with spaces: wrap the path in quotes, or drag the folder onto Terminal after typing `cd `.
- You forgot `npm install` after creating the project.
- Port already in use → another `npm run dev` is still running, or Vite will offer the next port (5174).
- White screen → open the browser console (`Command + Option + J` in Chrome) and read the red error. Missing imports, unclosed tags, and TypeScript type errors are the usual culprits.

React rewards small files and frequent saves. Keep components tiny, run `npm run dev` while you work, and change one thing at a time.
