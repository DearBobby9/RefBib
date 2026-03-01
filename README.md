# RefBib

Extract all references from an academic PDF and get standard BibTeX entries — in one click.

Drop a PDF, get `.bib`. That's it.

**No AI, no hallucinations.** RefBib does not use large language models. Every BibTeX entry comes from verified academic databases — [CrossRef](https://www.crossref.org/), [Semantic Scholar](https://www.semanticscholar.org/), and [DBLP](https://dblp.org/) — or directly from [GROBID](https://github.com/kermitt2/grobid)'s structured PDF parse. Nothing is generated or guessed. Each result includes a match confidence indicator (Matched / Fuzzy / Unmatched) so you can judge reliability at a glance. Dark mode supported.

## Try It

A public hosted instance is available at **[ref-bib.vercel.app](https://ref-bib.vercel.app)**. It is password-protected to prevent abuse. To get access, follow and DM me on [Twitter/X](https://x.com/KeithMaxwell99) — I'll send you the password when I see your message.

> **Note:** The public instance runs on shared free-tier infrastructure with limited capacity. For regular use, please [self-host your own instance](#quick-start) — it only takes a few minutes.

## Current Status (March 2026)

RefBib is at **Phase 2.5** — a fully-featured reference extraction and management tool.

### Implemented

**Core Extraction**
- Unified extraction queue — single file and batch use the same flow (single file auto-expands)
- Multi-PDF batch upload (drag-and-drop, up to 20 files per batch, sequential processing)
- Append more PDFs at any stage — "Add more PDFs" button during processing or on results page
- Batch resume/retry — resume remaining pending files, retry individual failed files
- Reference extraction via GROBID with automatic multi-instance fallback
- BibTeX resolution waterfall: CrossRef → Semantic Scholar → DBLP → GROBID fallback `@misc`
- Match status labeling (`Matched` / `Fuzzy` / `Unmatched`)
- Manual DOI resolution for unmatched references (paste a DOI → get BibTeX)
- Notification chime on extraction completion

**Discovery & Search**
- Unmatched availability check (`Check availability`) across CrossRef / Semantic Scholar / DBLP
- Search + status filter + select all / deselect all
- Google Scholar search link on all references

**Workspace**
- Local Workspace with automatic deduplication (DOI, fingerprint, bigram similarity)
- Conflict resolution queue (interactive merge / keep-both)
- Manual BibTeX editor (override individual entries)
- Workspace search/filter (text search + dedup status toggle chips)
- Venue/Year grouping (collapsible grouped display)
- Analytics dashboard (year distribution, venue distribution, match quality pie, most-cited list)
- Export: deduplicated `.bib` or occurrence-preserving `.bib`, copy to clipboard

**Infrastructure**
- Top-level `Extract | Workspace` navigation
- Password gate for hosted instances (`SITE_PASSWORD`)
- Light/dark theme toggle
- Self-hosted instance notice banner with rate limit info
- Smooth accordion animation for per-file result expansion

### Not Yet Implemented

- Multi-workspace management (create/rename/switch/delete) — data structure ready
- Semantic topic clustering
- Overleaf integration / browser extension / citation graph visualization

### Validation Snapshot

- Backend test suite: **84 tests passing** (`cd backend && .venv/bin/pytest`)
- Frontend test suite: **16 tests passing** (`cd frontend && npx vitest run`)

## Use Case

Writing a paper and reading through related work? When you find a relevant published paper, drop it into RefBib to instantly grab all its references as BibTeX — no more manually searching and copying entries one by one.

**Single-paper workflow:**
1. Find a related paper in your field (conference/journal version works best)
2. Upload the PDF to RefBib
3. Results auto-expand — cherry-pick the entries you need
4. Export as `.bib` or add to Workspace

**Iterative workflow (literature survey):**
1. Start with one or a few key papers — drop them into RefBib
2. Review results, add what you need to Workspace
3. Found more papers? Click "Add more PDFs" to append — no need to start over
4. Review the deduplicated Workspace, resolve conflicts, and export a clean `.bib`

This is especially useful when surveying a new topic — start from a few key papers, extract their references, add more as you discover them, and incrementally build up a comprehensive `.bib` file.

## Quick Start

**Prerequisites:** Python 3.11+, Node.js 18+

### macOS / Linux

```bash
./start.sh
```

### Windows

```cmd
start.bat
```

Both scripts will:
1. Create a Python virtual environment and install backend dependencies
2. Install frontend Node.js dependencies
3. Start the backend (FastAPI) on http://localhost:8000
4. Start the frontend (Next.js) on http://localhost:3000

Open http://localhost:3000 in your browser, drag in a PDF, and export BibTeX.

### Manual Start

<details>
<summary>macOS / Linux</summary>

```bash
# Terminal 1 — Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
# Terminal 1 — Backend
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

</details>

## How It Works

```text
PDF(s) -> GROBID (parse references) -> BibTeX Lookup -> Results
                                         |- CrossRef (DOI -> BibTeX)
                                         |- Semantic Scholar (title search)
                                         |- DBLP (title search)
                                         `- GROBID fallback (@misc)

Upload      -> Processing progress -> Results (accordion per file)
               [+ Add more PDFs]      [+ Add more PDFs / Resume / Retry]
1 PDF       -> auto-expanded results -> select/filter -> export or Add to Workspace
N PDFs      -> per-file accordion -> review each -> auto-add matched to Workspace

Workspace   -> search/filter -> group by venue/year -> export deduplicated .bib
            -> conflict queue -> merge / keep both
            -> analytics dashboard (charts)

Unmatched   -> Check availability -> CrossRef / S2 / DBLP discovery
            -> Resolve by DOI -> paste DOI -> get verified BibTeX
```

1. Upload one or more PDFs with reference sections (append more at any time)
2. GROBID extracts structured citations (title, authors, year, DOI, venue)
3. Each reference is looked up via a waterfall strategy: CrossRef → Semantic Scholar → DBLP
4. If no match is found, a fallback `@misc` entry is constructed from GROBID's parse
5. **Single PDF:** Results auto-expand — select entries and download `.bib` or copy to clipboard
6. **Multiple PDFs:** Click each file to expand its results; matched/fuzzy refs are auto-added to Workspace
7. **Add more:** Append additional PDFs at any stage without losing existing results

### Workspace

- Add selected references from the extract page to a local Workspace (stored in browser localStorage)
- Open the `Workspace` tab to review deduplicated entries, source-paper groups, and conflict queue
- **Search & filter:** Text search across titles/authors/venues + toggle dedup status chips (unique/merged/conflict)
- **Conflict resolution:** When duplicates have conflicting metadata, review them side-by-side and choose Merge or Keep Both
- **BibTeX editor:** Click any entry to edit its BibTeX directly; overrides are saved and used in exports
- **Grouping:** Group entries by venue or year with collapsible sections
- **Analytics:** View citation year distribution, venue distribution, match quality breakdown, and most-cited references
- Export either:
  - `Export Unique .bib` (deduplicated)
  - `Export All (with duplicates)` (occurrence-preserving)
- Clear Workspace at any time from the Workspace actions panel

### Unmatched Discovery & DOI Resolution

- `Unmatched` means no BibTeX match in the main waterfall; RefBib builds a fallback `@misc`
- Click `Check availability` on unmatched entries to probe indexed sources (CrossRef / Semantic Scholar / DBLP)
- This returns a discoverability signal (`available` / `unavailable` / `error` / `skipped`) without overwriting `match_status`
- Click `Resolve by DOI` to manually paste a DOI — RefBib will fetch verified BibTeX from CrossRef and upgrade the entry to `Matched`

### Match Status

- **Matched** — High-confidence BibTeX found (title similarity > 0.9)
- **Fuzzy** — BibTeX found but title similarity is 0.7–0.9, may need manual check
- **Unmatched** — No API match; fallback `@misc` entry from GROBID data

### Extraction Accuracy

RefBib relies on [GROBID](https://github.com/kermitt2/grobid) for PDF parsing. Extraction accuracy depends heavily on the PDF format:

| PDF Type | Expected Accuracy | Notes |
|----------|-------------------|-------|
| Published papers (conference/journal) | ~100% | Standard layouts work best. Tested: 64/64 references extracted from a NeurIPS-style paper. |
| arXiv preprints | ~95%+ | Generally standard formatting |
| Anonymous submissions (e.g. ACL/ARR review copies) | ~30–60% | Line numbers, non-standard templates, and draft formatting interfere with parsing |
| Theses, technical reports | Varies | Depends on layout complexity |

**Tip:** If extraction misses references, try using the camera-ready or published version of the paper instead of a draft or review copy.

### GROBID Instance Selection

Click the gear icon in the top-right corner to choose a GROBID instance. You can also check which instances are currently online. If the selected instance fails, the backend will automatically try the remaining instances as fallback.

## GROBID Setup

RefBib needs a GROBID server for PDF parsing. You have two options:

### Option A: Public Instances (No Setup Required)

RefBib comes preconfigured with free/community instances plus a local Docker option. You can switch between them in the settings:

| Instance | URL | Notes |
|----------|-----|-------|
| HuggingFace DL (default) | `https://kermitt2-grobid.hf.space` | Best accuracy, DL+CRF models |
| HuggingFace CRF | `https://kermitt2-grobid-crf.hf.space` | Faster, slightly lower accuracy |
| Science-Miner (Legacy) | `https://cloud.science-miner.com/grobid` | Often unstable |
| HuggingFace (lfoppiano) | `https://lfoppiano-grobid.hf.space` | Community instance, availability may vary |
| HuggingFace (qingxu98) | `https://qingxu98-grobid.hf.space` | Community instance, availability may vary |
| Local Docker | `http://localhost:8070` | Self-hosted option, usually the most reliable |

> **These are free community resources** hosted by the [GROBID team](https://github.com/kermitt2/grobid) on [Hugging Face Spaces](https://huggingface.co/spaces/kermitt2/grobid). They have rate limits and may be temporarily unavailable. Please be respectful of their capacity. For reliable usage, deploy GROBID locally (see below).

### Option B: Local Docker (Most Reliable)

Self-hosting GROBID via Docker gives you the best reliability and speed.

#### Install Docker

| Platform | Install |
|----------|---------|
| **macOS** | [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/) (supports both Intel and Apple Silicon) |
| **Windows** | [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) (requires WSL2 — the installer will guide you) |

#### Choose a GROBID Image

| Image | Tag | Size | Best For |
|-------|-----|------|----------|
| **CRF-only** (recommended) | `grobid/grobid:0.8.2-crf` | ~1 GB | All platforms. Fast, low memory. **Required for Apple Silicon.** |
| **Full DL+CRF** | `grobid/grobid:0.8.2-full` | ~5 GB | Intel Mac / Windows / Linux. Best accuracy. |

#### Start GROBID

<details>
<summary>macOS (Apple Silicon M1/M2/M3/M4)</summary>

Use the **CRF-only** image. The Full image has known TensorFlow/AVX compatibility issues with ARM emulation.

```bash
docker run --rm --init --ulimit core=0 -p 8070:8070 grobid/grobid:0.8.2-crf
```

Note: Docker runs x86 images via Rosetta 2 emulation on Apple Silicon, so it will be ~2-3x slower than native. This is still faster than using a remote public instance.

</details>

<details>
<summary>macOS (Intel)</summary>

Either image works natively.

```bash
# Best accuracy
docker run --rm --init --ulimit core=0 -p 8070:8070 grobid/grobid:0.8.2-full

# Or faster with less accuracy
docker run --rm --init --ulimit core=0 -p 8070:8070 grobid/grobid:0.8.2-crf
```

</details>

<details>
<summary>Windows</summary>

Make sure Docker Desktop is running (with WSL2 backend). Either image works.

```powershell
# Best accuracy
docker run --rm --init --ulimit core=0 -p 8070:8070 grobid/grobid:0.8.2-full

# Or faster with less accuracy
docker run --rm --init --ulimit core=0 -p 8070:8070 grobid/grobid:0.8.2-crf
```

Note: GPU acceleration is not available on Windows Docker. GPU support is Linux-only.

</details>

#### Connect RefBib to Local GROBID

Once GROBID is running on port 8070, either:

- **In the UI**: Click the gear icon and select "Local Docker"
- **Via .env**: Set `GROBID_URL=http://localhost:8070` in `backend/.env`

## Third-Party Services & Acknowledgments

RefBib relies on several free, public academic services. We are grateful to their maintainers.

| Service | Usage | Note |
|---------|-------|------|
| [GROBID](https://github.com/kermitt2/grobid) | PDF reference extraction | Open-source ML tool by the GROBID team. Public instances on [HuggingFace Spaces](https://huggingface.co/spaces/kermitt2/grobid). |
| [CrossRef](https://www.crossref.org/) | DOI → BibTeX lookup | Free API, rate-limited. Set `CROSSREF_MAILTO` in `.env` for the polite pool. |
| [Semantic Scholar](https://www.semanticscholar.org/) | Title → BibTeX search | Free API by Allen Institute for AI. |
| [DBLP](https://dblp.org/) | Title → BibTeX search (CS papers) | Free service by Schloss Dagstuhl. |

## Configuration

```bash
cp backend/.env.example backend/.env
```

**Backend** (`backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `GROBID_URL` | `https://kermitt2-grobid.hf.space` | Default GROBID API endpoint |
| `GROBID_VERIFY_SSL` | `true` | Set `false` for self-signed certs |
| `CROSSREF_MAILTO` | *(empty)* | Your email for CrossRef polite pool (recommended) |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend origin for CORS |
| `APP_ENV` | `development` | Set to `production` for deployed instances |
| `SITE_PASSWORD` | *(empty)* | Require password to use the app. Leave empty to disable. |

**Frontend** (environment variable on hosting platform):

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL. Set this on Vercel to point to your deployed backend. |

## Deployment

RefBib is deployed as two services:

- **Frontend** (Next.js static site) — Vercel, Netlify, GitHub Pages, or any static host
- **Backend** (FastAPI) — Fly.io, Render, Railway, or any Docker host

### Deploying to Fly.io + Vercel

<details>
<summary>Step-by-step</summary>

**Backend (Fly.io):**

```bash
cd backend
fly launch          # Creates a new app under YOUR Fly.io account
fly secrets set SITE_PASSWORD=your-password   # Optional
fly secrets set FRONTEND_URL=https://your-app.vercel.app
fly deploy
```

**Frontend (Vercel):**

1. Push the repo to GitHub
2. Import the repo in [Vercel](https://vercel.com) with root directory set to `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL` = `https://your-fly-app.fly.dev`
4. Deploy

</details>

### Password Protection

To restrict access to your hosted instance, set the `SITE_PASSWORD` environment variable on your backend. Users will see a password wall before they can use the app. Leave it empty to allow open access.

```bash
# Fly.io example
fly secrets set SITE_PASSWORD=your-password

# Or in backend/.env for local testing
SITE_PASSWORD=your-password
```

### Cold Start Behavior

If you deploy the backend to Fly.io with `auto_stop_machines = 'stop'` (default in `fly.toml`), the server will sleep after a period of inactivity. When a user visits the frontend, it automatically pings the backend to trigger a cold start, showing a "Connecting to server..." spinner until the backend is ready. This typically takes 2–5 seconds.

### Security Note

**This repository contains no secrets, passwords, or server-specific credentials.** All sensitive configuration is managed through environment variables set on your hosting platform (e.g., `fly secrets set`, Vercel environment variables). Specifically:

- `fly.toml` contains only the app name and VM config — not access tokens or secrets
- `SITE_PASSWORD`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL` are never committed to the repo
- `.env` files are excluded by `.gitignore`
- Default values in `config.py` all point to `localhost` or are empty strings

If you fork or clone this repo, you will deploy to **your own** Fly.io/Vercel account with your own credentials. Nothing in the source code connects to the original author's infrastructure.

## Tech Stack

- **Frontend:** Next.js (App Router) + shadcn/ui + TailwindCSS + Recharts
- **Backend:** Python FastAPI + httpx + lxml
- **PDF Parsing:** GROBID (TEI XML)

## Tests

```bash
# Backend (84 tests)
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pytest

# Frontend (16 tests)
cd frontend
npx vitest run
```

## Contributing

If you find RefBib helpful, please consider giving it a star on GitHub — it helps others discover the project.

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/DearBobby9/RefBib/issues).

## License

MIT
