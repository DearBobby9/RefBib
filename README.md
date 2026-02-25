# RefBib

Extract all references from an academic PDF and get standard BibTeX entries — in one click.

Drop a PDF, get `.bib`. That's it.

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

```
PDF  →  GROBID (parse references)  →  BibTeX Lookup  →  Export .bib
                                        ├─ CrossRef (DOI → BibTeX)
                                        ├─ Semantic Scholar (title search)
                                        ├─ DBLP (title search)
                                        └─ GROBID fallback (@misc)
```

1. Upload a PDF with a reference section
2. GROBID extracts structured citations (title, authors, year, DOI, venue)
3. Each reference is looked up via a waterfall strategy: CrossRef → Semantic Scholar → DBLP
4. If no match is found, a fallback `@misc` entry is constructed from GROBID's parse
5. Select the entries you want and download a `.bib` file or copy to clipboard

### Match Status

- **Matched** — High-confidence BibTeX found (title similarity > 0.9)
- **Fuzzy** — BibTeX found but title similarity is 0.7–0.9, may need manual check
- **Unmatched** — No API match; fallback `@misc` entry from GROBID data

### GROBID Instance Selection

Click the gear icon in the top-right corner to choose a GROBID instance. You can also check which instances are currently online. If the selected instance fails, the backend will automatically try the remaining instances as fallback.

## GROBID Setup

RefBib needs a GROBID server for PDF parsing. You have two options:

### Option A: Public Instances (No Setup Required)

RefBib comes preconfigured with free community instances. You can switch between them in the settings:

| Instance | URL | Notes |
|----------|-----|-------|
| HuggingFace DL (default) | `https://kermitt2-grobid.hf.space` | Best accuracy, DL+CRF models |
| HuggingFace CRF | `https://kermitt2-grobid-crf.hf.space` | Faster, slightly lower accuracy |
| Science-Miner (Legacy) | `https://cloud.science-miner.com/grobid` | Often unstable |

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

| Variable | Default | Description |
|----------|---------|-------------|
| `GROBID_URL` | `https://kermitt2-grobid.hf.space` | Default GROBID API endpoint |
| `GROBID_VERIFY_SSL` | `true` | Set `false` for self-signed certs |
| `CROSSREF_MAILTO` | *(empty)* | Your email for CrossRef polite pool (recommended) |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend origin for CORS |

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

## License

MIT
