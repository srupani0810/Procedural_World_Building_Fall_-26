# Git + GitHub 101

A short, practical intro for people who have never used Git. You do not need to memorize every command. Follow the workflow, and look commands up when you need them.

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
- **README.md** — the page people see first (Markdown)

**README** is just a Markdown file in the repo root. GitHub renders it automatically.

**.gitignore** is a text file that lists things Git should *not* track (exports, caches, huge binaries, secrets). Example:

```
.DS_Store
__pycache__/
*.blend1
.env
```

Never commit passwords, API keys, or `.env` files.

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

If those five steps work, you know enough Git to version a class project.

---

## When something looks scary

Paste the error into a search (or ask a classmate / instructor) **with the exact command you ran**. The usual causes are:

- You are in the wrong folder (`pwd` / `cd` first).
- You never `git add` before `git commit` (Git says “nothing to commit”).
- You are not logged in (`gh auth login` or refresh your token).
- The remote URL is wrong (`git remote -v` to check).

Git is undo-friendly if you commit often. Commit early, commit small, push when the work is worth backing up.
