# Git + GitHub 101

A short, practical intro for people who have never used Git. You do not need to memorize every command. Follow the workflow, and look commands up when you need them.

This guide also covers writing a proper **`README.md`** so your GitHub repo page explains the project and how to run it.

---

## What are Git and GitHub?

**Git** is a tool on your computer that tracks versions of your files. Think of it as “save history” for a whole project: you can see what changed, when, and you can go back if something breaks.

**GitHub** is a website that stores copies of Git projects online. It is how you back up work, share it, and collaborate.

They are not the same thing:

| | Git | GitHub |
|---|---|---|
| What it is | Software on your machine | A website (like a cloud drive for Git projects) |
| What it does | Records versions of files | Hosts those versions so others can see and copy them |
| Works offline? | Yes | No (you need the internet to sync) |

Other sites (GitLab, Bitbucket) work similarly. This tutorial uses GitHub because it is the most common.

---

## Words you will see constantly

- **Repository (repo):** the project folder Git is tracking. Local = on your computer. Remote = on GitHub.
- **Commit:** a snapshot of the project at one moment, plus a short message explaining what you changed.
- **Staging area:** a holding zone. You pick which changes go into the next commit (`git add`).
- **Branch:** a parallel line of work. `main` (or `master`) is usually the “official” version.
- **Clone:** download a GitHub repo onto your computer.
- **Push:** send your new commits from your computer to GitHub.
- **Pull:** download new commits from GitHub onto your computer.
- **Merge / pull request (PR):** a request to combine one branch into another, usually reviewed on GitHub.
- **README.md:** Markdown file at the repo root. GitHub shows it on the repo home page — the project’s front door.
- **Markdown (`.md`):** plain text with simple symbols for headings, lists, links, and code. GitHub turns it into a formatted page.

A useful picture:

```
Your files  →  git add (stage)  →  git commit (save snapshot)  →  git push (upload to GitHub)
```

---

## Install and set up (do this once)

### 1. Install Git

- **Mac:** open Terminal and type `git --version`. If Git is missing, macOS will offer to install developer tools, or install from [git-scm.com](https://git-scm.com).
- **Windows:** install [Git for Windows](https://git-scm.com). Use **Git Bash** as your terminal.
- **Check it worked:**

```bash
git --version
```

### 2. Tell Git who you are

Git stamps every commit with a name and email. Use the email tied to your GitHub account.

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

`--global` means “for all projects on this computer.”

### 3. Create a GitHub account

Go to [github.com](https://github.com) and sign up. Pick a username you are willing to put on a résumé.

### 4. Sign in from the terminal (recommended)

The easiest modern option is **GitHub CLI**:

1. Install from [cli.github.com](https://cli.github.com).
2. Run:

```bash
gh auth login
```

Follow the prompts (GitHub.com → HTTPS → login with a browser). After that, `git push` and `git pull` should just work.

Alternatively, GitHub’s docs cover [HTTPS with a personal access token](https://docs.github.com/en/authentication) or SSH keys. Use whichever you set up; you only need one method.

---

## Your first repo (two common paths)

### Path A: You already have a folder of files

```bash
cd path/to/your-project
git init
git add .
git commit -m "Initial commit"
```

Then on GitHub: **New repository** → do **not** add a README if the folder already has files → create it → GitHub will show commands like:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

- `origin` is just a nickname for “the GitHub copy.”
- `-u origin main` remembers that your `main` branch tracks GitHub’s `main`, so later you can type `git push` and `git pull`.

### Path B: The project already exists on GitHub

```bash
git clone https://github.com/SOMEONE/REPO.git
cd REPO
```

Now you have a full copy, including history.

---

## Everyday workflow (memorize this)

Work in small steps. After a chunk of progress that you would hate to lose:

```bash
git status                 # what changed?
git add .                  # stage everything (or add specific files)
git commit -m "Short description of what you did"
git push                   # upload to GitHub
```

**Commit messages** should say *why* or *what changed*, not “asdf” or “final final 2”:

- Good: `Add noise-based heightmap for terrain`
- Good: `Fix camera clipping through the ground`
- Bad: `updates`

**`git add .` vs one file:** `.` stages all changes in the current folder. To be precise:

```bash
git add path/to/file.py
```

---

## Seeing what happened

```bash
git status                 # untracked / staged / modified files
git log --oneline          # recent commits, one line each
git diff                   # unstaged changes (your working files vs last commit)
git diff --staged          # what is already staged for the next commit
```

If Git says “your branch is ahead of origin/main,” you have commits that are not on GitHub yet → `git push`.

If it says “behind,” GitHub has commits you do not have yet → `git pull`.

---

## Branches (when you want a safe sandbox)

Branches let you try something without touching `main` until you are ready.

```bash
git switch -c experiment     # create and switch to a new branch
# ... edit files, add, commit ...
git switch main              # go back to main
git merge experiment         # bring experiment into main (on your computer)
git push
```

On GitHub you will more often:

1. Push the branch: `git push -u origin experiment`
2. Open a **Pull Request** on the repo page
3. Review the diff, then merge on the website

For a solo class project, staying on `main` is fine. Branches matter more as soon as two people share a repo.

---

## GitHub in the browser

A typical repo page has:

- **Code** — the files
- **Commits** — the history
- **Pull requests** — proposed merges
- **Issues** — a to-do / bug list (optional)
- **README.md** — rendered under the file list (see the next section)

**.gitignore** is a text file that lists things Git should *not* track (exports, caches, huge binaries, secrets). Example:

```
.DS_Store
__pycache__/
*.blend1
.env
```

Never commit passwords, API keys, or `.env` files.

---

## Writing a good README.md

**`README.md`** belongs at the **repo root** (same level as folders like `Tutorials` or `react-app`, not inside `src`). GitHub shows it automatically on the repo home page — the first thing people read after the file list.

| | README | Other docs |
|---|---|---|
| Job | “What is this, and how do I run it?” | Deep tutorials, planning notes |
| Location | Repo root: `README.md` | e.g. `Tutorials/`, `docs/` |
| Audience | Anyone opening the repo cold | People already inside the project |

Think of it as the **front door**, not the whole house.

```
Someone opens your GitHub repo
        ↓
    reads README.md
        ↓
    knows what it is + how to run it
```

### What a proper README answers

1. **What is this?** One or two sentences.  
2. **Why should I care?** Class project, demo, tool — say the context.  
3. **What does it look like?** Screenshot if you can.  
4. **How do I run it?** Exact commands, in order.  
5. **Who made it?** Name / course / term (optional license).

Skip long essays, secret keys, and “TODO: write this later.”

### Markdown cheat sheet (only what you need)

~~~~markdown
# Heading 1 (project title — use once at the top)

## Heading 2 (main sections)

### Heading 3 (subsections)

**bold text**

*italic text*

- bullet list item
- another item

1. numbered step
2. next step

[Link text](https://example.com)

![Alt text for an image](docs/screenshot.png)

`inline code` (file names, short commands)

```bash
npm install
npm run dev
```
~~~~

Tips: blank line before/after headings and code blocks; image paths are relative to the README’s folder (usually the repo root).

### Recommended sections

Use these in order. Delete any that truly do not apply.

- Title + short description  
- Table of contents (optional; useful once the README is long)  
- Screenshot / demo  
- Features  
- Requirements  
- Getting started (clone → install → run)  
- Usage  
- Project structure  
- Built with  
- Author  
- License (optional)

### Table of contents with links

A **table of contents (TOC)** is a short list of jump links to sections in the same README. On GitHub, each `## Heading` gets an automatic anchor. You link to it with `#` plus a slug of the heading.

**How GitHub builds the link target from a heading:**

1. Take the heading text (e.g. `Getting started`).  
2. Lowercase it: `getting started`.  
3. Turn spaces into hyphens: `getting-started`.  
4. Drop most punctuation.  

So `## Getting started` becomes the link `#getting-started`.

**Example TOC** (put it near the top, after the description):

```markdown
## Contents

- [Screenshot](#screenshot)
- [Features](#features)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Project structure](#project-structure)
- [Built with](#built-with)
- [Author](#author)
```

Those only work if you also have matching headings later, like:

```markdown
## Getting started
```

**Nested TOC** (optional) when you have `###` subsections:

```markdown
## Contents

- [Getting started](#getting-started)
  - [Requirements](#requirements)
  - [Install and run](#install-and-run)
- [Usage](#usage)
```

**Tips:**

- Click a heading on the rendered GitHub page, then copy the URL after `#` if you are unsure of the slug.  
- Keep the TOC short — only main `##` sections, not every tiny note.  
- Update the TOC if you rename a heading (the link must match the new slug).  
- GitHub also adds a small outline menu on some views; a written TOC still helps on long READMEs.

### Folder structure (in the repo and in the README)

Two related skills: **making** a clear folder layout on disk, and **showing** it in the README so people know where things live.

#### 1. Create folders for a class / app repo

In Terminal, from your **repo root**:

```bash
mkdir -p docs Tutorials Planning
mkdir -p react-app   # only if you do not already have the app folder
```

| Folder | Typical use |
|---|---|
| `README.md` | Front page (file at root, not inside a folder) |
| `docs/` | Screenshots, diagrams, extra docs |
| `Tutorials/` | How-tos and class notes |
| `Planning/` | Prompts, briefs, planning notes |
| `react-app/` | The actual Vite / React / Three.js project |

On a Mac you can also create folders in Finder; just keep names simple (no need for spaces if you can avoid them).

Commit empty folders only if they contain a file (Git does not track empty directories). A common trick:

```bash
touch docs/.gitkeep
git add docs/.gitkeep
```

#### 2. Show the structure in the README

Use a fenced `text` code block with a tree. Readers can scan it in seconds:

~~~~markdown
## Project structure

```text
├── README.md             # Repo front page (you are here)
├── docs/                 # Screenshots and diagrams
│   └── screenshot.png
├── Tutorials/            # Class how-tos
├── Planning/             # Prompts and planning
└── react-app/            # Runnable app (Vite + React + Three.js)
    ├── package.json
    └── src/
```
~~~~

**How to draft the tree without guessing:**

```bash
# From the repo root — list top-level names
ls

# Optional: see a bit deeper (macOS / Linux)
find . -maxdepth 2 -not -path '*/.*' -not -path './node_modules/*'
```

Or build the tree by hand: one line per folder/file, `├──` for items, `│` for nesting, `└──` for the last item in a group. Keep it to **important** folders — do not paste all of `node_modules`.

#### 3. Link from the README into folders (optional)

You can link to a folder or file on GitHub with a relative path (works in the rendered README):

```markdown
See class notes in [Tutorials](./Tutorials/) and app code in [react-app/src](./react-app/src/).
```

On github.com those open that path in the repo. Prefer this over absolute `https://github.com/...` links so forks still work.

### Step by step

1. **Create** `README.md` at the repo root (e.g. `Procedural_World_Building_Fall_'26/README.md`). One repo → one main README at the root.
2. **Title + description** — if you cannot explain the project in two sentences, clarify the idea before decorating.
3. **Getting started** — real commands a stranger can paste:

~~~~markdown
## Getting started

### Requirements

- Node.js 24+
- npm

### Install and run

```bash
cd react-app
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).
~~~~

4. **Usage** — tabs, sliders, what to click.  
5. **Screenshot** — save e.g. `docs/screenshot.png`, then `![App preview](docs/screenshot.png)`. Commit the image too.  
6. **Built with / Author** — stack + your name and course.  
7. **Commit and push:**

```bash
git add README.md
git add docs/screenshot.png   # if you added one
git commit -m "Add project README"
git push
```

8. **Check on GitHub** — open the repo, scroll under the file list, confirm it renders. You can edit small typos with the pencil icon on the website (then `git pull` locally later).

### Starter template (copy and fill in)

~~~~markdown
# [Project title]

[One or two sentences: what it is and who it is for.]

## Contents

- [Screenshot](#screenshot)
- [Features](#features)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Project structure](#project-structure)
- [Built with](#built-with)
- [Author](#author)

## Screenshot

![App preview](docs/screenshot.png)

## Features

- [Feature 1]
- [Feature 2]
- [Feature 3]

## Requirements

- Node.js 24+
- npm

## Getting started

```bash
git clone [YOUR_REPO_URL]
cd [REPO_FOLDER]/react-app
npm install
npm run dev
```

Then open the local URL shown in the terminal.

## Usage

- [Main view or tab]: [what to do]
- [Controls]: [what the sliders / buttons do]

## Project structure

```text
├── README.md             # Repo front page (you are here)
├── docs/                 # Screenshots and diagrams
│   └── screenshot.png
├── Tutorials/            # Class how-tos
├── Planning/             # Prompts and planning
└── react-app/            # Runnable app (Vite + React + Three.js)
    ├── package.json
    └── src/
```

More notes: [Tutorials](./Tutorials/) · app source: [react-app/src](./react-app/src/)

## Built with

- React, TypeScript, Vite
- Three.js, React Three Fiber
- [Other libraries]

## Author

[Your name] — DESIGN 6197 (Procedural World Building), Fall 2026

## License

[Optional: MIT, or “Course work — all rights reserved”]
~~~~

### README do / don’t

| Do | Avoid |
|---|---|
| Put `README.md` at the **repo root** | Leaving the GitHub page empty while notes live only in `Tutorials/` |
| Give **copy-pasteable** install/run commands | “Just run it” with no `cd` or `npm` steps |
| Keep the top **short** | A wall of text before the title’s meaning is clear |
| Update the README when run steps change | Describing last month’s folder layout |
| Commit images you link | Hotlinking private Drive URLs that break for others |
| Write for a **stranger** | Assuming they know your ports and `nvm` aliases |

Optional later: live demo link (see [firebase.md](./firebase.md)), a short troubleshooting section, or a few badges. None of those replace clear run steps.

More detail and the same template also live in [GitHub README.md](./GitHub%20README.md).

---

## Collaborating without stepping on each other

1. `git pull` before you start (get everyone else’s latest work).
2. Make your changes, commit, `git push`.
3. If `git push` is rejected, someone else pushed first. Run `git pull`, fix any conflict, then `git push` again.

**A merge conflict** means Git found two edits to the same lines and will not guess. The file will look like:

```
<<<<<<< HEAD
your version
=======
their version
>>>>>>> some-branch
```

Edit the file to the version you want (delete the `<<<`, `===`, `>>>` markers), then:

```bash
git add the-file
git commit
git push
```

Talk to your teammate if you are unsure which version is correct.

---

## Undo (the safe versions)

These are the ones beginners should actually use.

| Situation | Command |
|---|---|
| Unstage a file (keep the edits) | `git restore --staged filename` |
| Throw away uncommitted edits in a file | `git restore filename` |
| Rewrite the *last* commit message (only if you have **not** pushed) | `git commit --amend -m "Better message"` |

Do **not** use `git reset --hard` or `git push --force` until you know exactly what they delete. `--force` on a shared branch can erase other people’s work.

---

## Mini cheat sheet

```bash
git status
git add .
git commit -m "Message"
git push
git pull
git clone URL
git log --oneline
git switch -c new-branch
git switch main
```

---

## A 10-minute practice (do this)

1. Create a folder, `git init`, add a `hello.txt`, commit.
2. Create an empty repo on GitHub and `git push` your folder to it.
3. Edit `hello.txt` on github.com (pencil icon → commit).
4. On your computer, `git pull` and confirm the edit arrived.
5. Edit locally, commit, `git push`, and refresh GitHub.
6. Add a root `README.md` (title, one-sentence description, how to open the project), commit, push, and confirm it renders on the repo page.

If those steps work, you know enough Git — and enough README — to present a class project on GitHub.

---

## When something looks scary

Paste the error into a search (or ask a classmate / instructor) **with the exact command you ran**. The usual causes are:

- You are in the wrong folder (`pwd` / `cd` first).
- You never `git add` before `git commit` (Git says “nothing to commit”).
- You are not logged in (`gh auth login` or refresh your token).
- The remote URL is wrong (`git remote -v` to check).

Git is undo-friendly if you commit often. Commit early, commit small, push when the work is worth backing up.
