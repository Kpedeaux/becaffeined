# Becaffeined

A match-3 game for [CR Coffee Shop](https://crcoffeenola.com/) — eight progressive
levels, with a CR brand splash screen between each. Pure static site, no build
step, no backend. Deploys to Cloudflare Pages.

> **Status:** v1.0 — local play + localStorage high score. Global leaderboard
> deferred to v2 (Cloudflare Workers + D1).

## Quick start (local)

```bash
# Any static server works. Two easy options:
python3 -m http.server 8080
# or
npx serve .
```

Then open http://localhost:8080 — the game runs straight off the filesystem,
no install required.

## Deploy

### One-time: connect the repo to Cloudflare Pages

1. Push this repo to GitHub (instructions below).
2. Cloudflare dashboard → **Workers & Pages** → **Create application** →
   **Pages** → **Connect to Git**.
3. Select the `Kpedeaux/becaffeined` repo. Branch: `main`.
4. **Framework preset:** `None`. **Build command:** *(leave empty)*.
   **Build output directory:** `/`.
5. Save and deploy. First deploy takes ~30 seconds.
6. Custom domain: Cloudflare Pages → your project → **Custom domains** → Set up
   custom domain → `game.crcoffeenola.com`. Cloudflare will create the CNAME
   automatically if your DNS is on Cloudflare.

### Every deploy after that: just push

```bash
git add .
git commit -m "your message"
git push
```

Cloudflare Pages auto-deploys on every push to `main`. Preview deploys spin up
for branches and pull requests.

### Initial push (one-time, from this folder)

```bash
cd "C:\Users\pedea\CoreRail\becaffeined"
git init
git add .
git commit -m "Initial Becaffeined build"
git branch -M main
git remote add origin https://github.com/Kpedeaux/becaffeined.git
git push -u origin main
```

## Architecture

```
becaffeined/
├── index.html              Single page entry. Title screen, game, splash, end.
├── manifest.webmanifest    PWA install metadata.
├── sw.js                   Service worker — offline caching.
├── _headers                Cloudflare Pages cache headers.
├── /css
│   ├── tokens.css          CR brand tokens (colors, type, spacing).
│   └── game.css            Game-specific layout, animations, HUD.
├── /js
│   ├── main.js             App entry. Wires everything together.
│   ├── board.js            Match-3 logic. Pure functions, no DOM.
│   ├── render.js           SVG/DOM renderer for the board.
│   ├── input.js            Touch + mouse + keyboard input → swap commands.
│   ├── audio.js            Web Audio API SFX synthesis.
│   ├── splash.js           Between-level brand splash component.
│   ├── levels.js           Level definitions + progression.
│   └── storage.js          localStorage wrappers.
├── /assets
│   ├── /fonts              Cafe Brewery TTFs.
│   ├── /img                Logos, favicons.
│   ├── /splash             Brand photography for splash screens.
│   └── /svg                Drink illustrations (one file per piece).
└── /tests
    └── board.test.html     In-browser test runner for board.js.
```

### Why no build step

This game has no transpilation, no bundler, no framework — it ships as the
files you see. That's deliberate:

- Cloudflare Pages serves the repo directly. No `npm install`, no build cache,
  no failed deploys from a broken lockfile.
- Anyone can `git clone` and open `index.html`. Nothing to set up.
- Smaller surface area = fewer things that break.

ES modules give us the same code organization a bundler would, served natively.

### Why no backend

Cloudflare Pages is static-only. High scores live in `localStorage` for the
MVP. When a global leaderboard becomes worth doing, the right path is
**Cloudflare Workers + D1** (serverless SQLite, same file system as Pages, no
extra hosting). Not Flask — Flask can't run on Pages. See `/v2-leaderboard.md`
when that's spec'd.

## Brand notes

- **Cafe Brewery font** is licensed for personal use only by Brittney Murphy
  Design. Before scaling the game's reach, purchase a commercial license from
  https://brittneymurphydesign.com. The wordmark on the title screen uses the
  existing logo PNG to avoid setting paragraphs in the unlicensed face.
- **Million Dollar Red** (`#A52639`) is the locked accent — the literal paint
  on the Magazine Street front door.
- Drink illustrations are vector originals drawn for this project; safe to
  use anywhere CR uses its own brand assets.

## License

All code in this repo is © CR Coffee Shop / Kevin Pedeaux. Drink illustrations
are original vector artwork drawn for this project.
