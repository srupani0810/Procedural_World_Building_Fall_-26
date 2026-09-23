# Firebase 101 (sign-in → hosting)

A short, practical walkthrough for publishing this class’s **Vite + React** app (`react-app`) on the internet with **Firebase Hosting**. You do not need to memorize every flag. Follow the steps in order.

By the end you will have a public HTTPS URL like:

```
https://your-project-id.web.app
```

---

## What is Firebase?

**Firebase** is a Google platform with many products (database, auth, analytics, and more). For this tutorial we only care about one:

**Firebase Hosting** — uploads the built website files from your computer and serves them on a fast global CDN with HTTPS. Visitors open a normal URL; they do not need Node or Vite.

Hosting is **not** the same as:

| | Firebase Hosting | `npm run dev` (localhost) |
|---|---|---|
| Who can see it | Anyone with the link | Only you on your machine |
| What it serves | Built files in `dist/` | Live source with hot reload |
| Needs your laptop on? | No | Yes |

Other Firebase products (Auth, Firestore, Functions) are optional and **not** required to host a static Three.js / React site.

---

## Words you will see constantly

- **Firebase project:** a named container in Google’s console. Hosting (and other products) live inside it.
- **Project ID:** a unique string (often looks like `my-app-12345`). It appears in your live URL.
- **Firebase Console:** the website UI at [console.firebase.google.com](https://console.firebase.google.com).
- **Firebase CLI:** the `firebase` command in Terminal. Installs as the npm package `firebase-tools`.
- **Build:** turning your React source into static HTML/JS/CSS. For Vite that folder is **`dist/`**.
- **Deploy:** uploading those built files so the public URL updates.
- **`firebase.json`:** config that tells Hosting which folder to upload (`public`: `"dist"` for Vite).
- **`.firebaserc`:** which Firebase project this folder is linked to (stores the project ID).
- **SPA (single-page app):** React often uses one `index.html` and client routing. Hosting can rewrite all paths to that file.

A useful picture:

```
Edit React code  →  npm run build  →  dist/ folder  →  firebase deploy  →  live .web.app URL
```

---

## What you need before starting

1. A **Google account** (Cornell Gmail or personal Gmail both work).
2. **Node.js** and **npm** already working (same setup as [React 101](./React%20101.md)). Check:

```bash
node -v
npm -v
```

3. This class app builds cleanly. From the repo root:

```bash
cd "/Users/carz786/Documents/Cornell Semester 3 (Fall '26)/DESIGN 6197 (Procedural World Building)/Procedural_World_Building_Fall_'26/react-app"
npm run build
```

If that fails, fix build errors first. Hosting only uploads whatever is in `dist/`.

---

## Step 1 — Sign in and create a Firebase project (browser)

1. Open [https://console.firebase.google.com](https://console.firebase.google.com).
2. Sign in with your Google account.
3. Click **Add project** (or **Create a project**).
4. Enter a project name (example: `procedural-world-building`). Click **Continue**.
5. Google Analytics is **optional** for this class. You can turn it off and continue.
6. Click **Create project**, wait until it finishes, then **Continue**.

You are now inside the Firebase Console for that project. Note the **Project ID** (Project settings → General, or the gear icon). You will pick this ID later in Terminal.

### Turn on Hosting in the console (optional but clear)

1. In the left sidebar, open **Build** → **Hosting**.
2. Click **Get started** if you see it.
3. You can skip the console’s “install CLI” wizard — we do that in Terminal next. The console page is useful later to see your live URL and deploy history.

---

## Step 2 — Install the Firebase CLI (once per machine)

In Terminal:

```bash
npm install -g firebase-tools
```

Check it worked:

```bash
firebase --version
```

You should see a version number. If `firebase: command not found`, close Terminal, open a new window, and try again. On some Macs you may need to fix your npm global path; ask for help with the full error text.

---

## Step 3 — Log the CLI into your Google account

```bash
firebase login
```

- A browser window opens. Choose the **same Google account** you used in the Console.
- Allow Firebase CLI access when asked.
- Back in Terminal you should see something like: **Success! Logged in as you@email.com**

Useful later:

```bash
firebase logout          # sign out
firebase login --reauth  # refresh login if deploy fails with auth errors
```

---

## Step 4 — Go to the app folder (important)

Firebase config files should live **next to** `package.json` — inside `react-app`, not the class repo root.

```bash
cd "/Users/carz786/Documents/Cornell Semester 3 (Fall '26)/DESIGN 6197 (Procedural World Building)/Procedural_World_Building_Fall_'26/react-app"
pwd
ls
```

You should see `package.json`, `src`, `vite.config.ts`, etc.

---

## Step 5 — Initialize Hosting in this folder

```bash
firebase init hosting
```

The CLI asks questions interactively. Use the arrow keys and space/enter as prompted. For **this Vite app**, answer like this:

| Question | Answer for this project |
|---|---|
| Create a new project / use existing / etc. | **Use an existing project** → pick the project you created in Step 1 |
| What do you want to use as your **public directory**? | **`dist`** (Vite’s build output — not `public` or `build`) |
| Configure as a single-page app (rewrite all urls to `/index.html`)? | **Yes** |
| Set up automatic builds and deploys with GitHub? | **No** (manual deploy is enough for class) |
| File `dist/index.html` already exists. Overwrite? | **No** (only asked if `dist` already exists from a prior build) |

When it finishes you should have (at least):

- `firebase.json` — hosting settings  
- `.firebaserc` — linked project ID  

Example `firebase.json` for Vite:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

If `"public"` is anything other than `"dist"`, edit `firebase.json` and fix it.

---

## Step 6 — Build the site

Still inside `react-app`:

```bash
npm run build
```

Confirm the output folder exists:

```bash
ls dist
```

You should see `index.html` and an `assets` folder. **Only these files** get uploaded.

---

## Step 7 — Deploy (go live)

```bash
firebase deploy --only hosting
```

Wait for the upload. At the end Terminal prints links, for example:

```
Hosting URL: https://your-project-id.web.app
```

Open that URL in a browser. You should see your procedural world app.

You can also open **Hosting** in the Firebase Console to copy the URL and see past deploys.

---

## Step 8 — Update the live site after you change code

Every time you change the React / Three.js app and want the public site to match:

```bash
cd "/Users/carz786/Documents/Cornell Semester 3 (Fall '26)/DESIGN 6197 (Procedural World Building)/Procedural_World_Building_Fall_'26/react-app"
npm run build
firebase deploy --only hosting
```

Optional shortcut in `package.json` (add under `"scripts"` if you want):

```json
"deploy": "npm run build && firebase deploy --only hosting"
```

Then:

```bash
npm run deploy
```

---

## Preview locally before deploying (optional)

Vite’s preview serves the **built** `dist/` folder (closer to Hosting than `npm run dev`):

```bash
npm run build
npm run preview
```

Open the URL it prints (often `http://localhost:4173`).

Firebase also has preview channels for temporary share URLs; you do not need them for this class.

---

## What belongs in Git?

Safe and useful to commit:

- `firebase.json`
- `.firebaserc` (project ID is not a secret; it appears in your public URL)

Do **not** commit:

- Your machine login tokens (the CLI stores those outside the project)
- Anything that looks like a private service-account JSON key (you should not need one for basic Hosting)

`dist/` is usually gitignored — that is fine. You rebuild before each deploy.

---

## Free tier and billing notes (beginner-safe)

- Firebase has a free **Spark** plan. Static Hosting for a class project usually stays within free limits.
- You do **not** need to enter a credit card just to host a small Vite site on Spark.
- If Google asks you to upgrade to **Blaze** for some other product, that is separate from basic Hosting — you can ignore Blaze unless a feature explicitly requires it.

Always double-check the current limits on Google’s pricing page if you expect heavy traffic.

---

## Common problems

### `firebase: command not found`

CLI did not install, or your Terminal path does not see global npm binaries. Re-run `npm install -g firebase-tools`, open a new Terminal tab, try `firebase --version` again.

### Deploy uploads the wrong thing / blank page

- Confirm you ran `firebase init` **inside** `react-app`.
- Confirm `firebase.json` has `"public": "dist"`.
- Confirm you ran `npm run build` **before** `firebase deploy`.
- Open DevTools → Network and check whether JS/CSS files 404.

### `Permission denied` / auth errors

```bash
firebase login --reauth
```

Make sure the logged-in Google account owns (or was invited to) the Firebase project.

### Wrong project

```bash
firebase projects:list
firebase use your-project-id
```

### Site looks old after deploy

Hard-refresh the browser (`Cmd+Shift+R`), or wait a minute for CDN cache. You can also check the Console’s Hosting release timestamp.

### Build works locally but Live site breaks on refresh of a deep URL

Answer **Yes** to the SPA rewrite question, or add the `rewrites` block shown in Step 5.

---

## Quick checklist

1. Create project at [console.firebase.google.com](https://console.firebase.google.com)  
2. `npm install -g firebase-tools`  
3. `firebase login`  
4. `cd` into `react-app`  
5. `firebase init hosting` → public folder **`dist`**, SPA **Yes**  
6. `npm run build`  
7. `firebase deploy --only hosting`  
8. Open the printed `.web.app` URL  

---

## Official docs (when you want more)

- [Firebase Hosting docs](https://firebase.google.com/docs/hosting)  
- [Firebase CLI reference](https://firebase.google.com/docs/cli)  
- [Get started with Hosting](https://firebase.google.com/docs/hosting/quickstart)  

This class tutorial stops at **Hosting**. Auth, Firestore, and Cloud Functions are separate products you can add later if a project needs them.
