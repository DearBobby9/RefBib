# RefBib

Extract all references from an academic PDF and get standard BibTeX entries — in one click.

Drop a PDF, get `.bib`. That's it.

**No AI, no hallucinations.** RefBib does not use large language models. Every BibTeX entry comes from verified academic databases — [CrossRef](https://www.crossref.org/), [Semantic Scholar](https://www.semanticscholar.org/), and [DBLP](https://dblp.org/) — or directly from [GROBID](https://github.com/kermitt2/grobid)'s structured PDF parse. Nothing is generated or guessed. Each result includes a match confidence indicator (Matched / Fuzzy / Unmatched) so you can judge reliability at a glance. Dark mode supported.

## Try It

A public hosted instance is available at **[ref-bib.vercel.app](https://ref-bib.vercel.app)**. It is password-protected to prevent abuse. To get access, follow and DM me on [Twitter/X](https://x.com/KeithMaxwell99) — I'll send you the password when I see your message.

> **Note:** The public instance runs on shared free-tier infrastructure with limited capacity. For regular use, please [self-host your own instance](#quick-start) — it only takes a few minutes.

## Current Status (February 2026)

RefBib is currently at **Phase 1.5 (MVP+)**.

### Implemented

- Single PDF upload (drag-and-drop or file picker)
- Reference extraction via GROBID with automatic multi-instance fallback
- BibTeX resolution waterfall: CrossRef -> Semantic Scholar -> DBLP -> GROBID fallback `@misc`
- Match status labeling (`Matched` / `Fuzzy` / `Unmatched`)
- Unmatched availability check (`Check availability`) across CrossRef / Semantic Scholar / DBLP
- Search + status filter + select all / deselect all
- Export selected entries by copy-to-clipboard or `.bib` download
- Local Workspace view with dedup stats, conflict queue, and workspace-level export
- Top-level `Extract | Workspace` navigation
- Password gate for hosted instances (`SITE_PASSWORD`)
- Light/dark theme toggle

### Not Yet Implemented

- Multi-PDF batch upload in one request
- Multi-workspace management (create/rename/switch/delete)
- Topic clustering and citation-frequency analysis
- Overleaf integration
- Browser extension and citation graph visualization

### Validation Snapshot

- Backend test suite: **62 tests passing** (`cd backend && .venv/bin/pytest -q backend/tests`)
- Frontend test suite: **11 tests passing** (`cd frontend && npx vitest run`)

## Use Case

Writing a paper and reading through related work? When you find a relevant published paper, drop it into RefBib to instantly grab all its references as BibTeX — no more manually searching and copying entries one by one.

**Recommended workflow:**
1. Find a related paper in your field (conference/journal version works best)
2. Upload the PDF to RefBib
3. Get the full reference list as BibTeX in seconds
4. Cherry-pick the entries you need for your own bibliography

This is especially useful when surveying a new topic — start from a few key papers, extract their references, and quickly build up a comprehensive `.bib` file.

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
PDF -> GROBID (parse references) -> BibTeX Lookup -> Extract view export
                                      |- CrossRef (DOI -> BibTeX)
                                      |- Semantic Scholar (title search)
                                      |- DBLP (title search)
                                      `- GROBID fallback (@misc)

Extract view -> Add selected to Workspace -> local dedup store -> Workspace export
Unmatched item -> Check availability -> CrossRef / S2 / DBLP discovery status
```

1. Upload a PDF with a reference section
2. GROBID extracts structured citations (title, authors, year, DOI, venue)
3. Each reference is looked up via a waterfall strategy: CrossRef → Semantic Scholar → DBLP
4. If no match is found, a fallback `@misc` entry is constructed from GROBID's parse
5. Select the entries you want and download a `.bib` file or copy to clipboard

### Workspace

- Add selected references from the extract page to a local Workspace (stored in browser localStorage)
- Open the `Workspace` tab to review deduplicated entries, source-paper groups, and conflict queue
- Export either:
  - `Export Unique .bib` (deduplicated)
  - `Export All (with duplicates)` (occurrence-preserving)
- Clear Workspace at any time from the Workspace actions panel

### Unmatched Discovery

- `Unmatched` still means no BibTeX match in the main waterfall; RefBib builds a fallback `@misc`
- You can now click `Check availability` on unmatched entries to probe indexed sources:
  - CrossRef
  - Semantic Scholar
  - DBLP
- This returns a separate discoverability signal (`available` / `unavailable` / `error` / `skipped`) and does not overwrite `match_status`

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

- **Frontend:** Next.js (App Router) + shadcn/ui + TailwindCSS
- **Backend:** Python FastAPI + httpx + lxml
- **PDF Parsing:** GROBID (TEI XML)

## Tests

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pytest
```

## Contributing

If you find RefBib helpful, please consider giving it a star on GitHub — it helps others discover the project.

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/DearBobby9/RefBib/issues).

## License

MIT
