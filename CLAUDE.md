# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RefBib** — A lightweight web app that extracts all references from an academic PDF and outputs standard BibTeX entries. Core workflow: drag PDF → auto-extract references → select entries → export `.bib` file.

Target users: researchers writing LaTeX/Overleaf papers who need to batch-collect BibTeX from reference lists.

**GitHub:** https://github.com/DearBobby9/RefBib

## Architecture

```
Frontend (Next.js + shadcn/ui + TailwindCSS)     Backend (Python FastAPI)
┌──────────────────────────┐                     ┌─────────────────────────────┐
│  PDF drag-drop upload    │                     │  1. GROBID: PDF → structured│
│  Reference list + select │  ── /api/extract ─▶ │     citation list            │
│  Filter / search / sort  │                     │  2. BibTeX lookup waterfall: │
│  .bib export / clipboard │                     │     DOI→CrossRef (primary)  │
└──────────────────────────┘                     │     Title→Semantic Scholar  │
                                                 │     Title→DBLP (CS papers)  │
                                                 │     Fallback: GROBID raw    │
                                                 │  3. Post-processing:        │
                                                 │     dedup, citation keys    │
                                                 └─────────────────────────────┘
```

- **Frontend**: Next.js 16 (App Router) + shadcn/ui + TailwindCSS v4
- **Backend**: Python FastAPI + httpx + lxml
- **PDF parsing**: GROBID (Docker self-hosted or public instances), REST API
- **BibTeX sources**: CrossRef API, Semantic Scholar API, DBLP API (all free, rate-limited)

## Development Commands

```bash
# One-click start (both frontend + backend)
./start.sh          # macOS/Linux
start.bat           # Windows

# Backend (manual)
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (manual)
cd frontend
npm install
npm run dev

# Tests
cd backend && .venv/bin/pytest       # backend tests (42 tests)
cd frontend && npm run build         # frontend type-check + build

# GROBID (local Docker, optional)
docker run --rm -p 8070:8070 grobid/grobid:0.8.2-crf
```

## Key File Locations

### Backend (`backend/`)
- `app/main.py` — FastAPI app entry, CORS, lifespan (httpx clients + rate limiters)
- `app/config.py` — Settings + GROBID_INSTANCES list (4 instances)
- `app/routers/health.py` — `/api/health`, `/api/grobid-instances`, `/api/grobid-instances/{id}/health`
- `app/routers/references.py` — `POST /api/extract` (PDF upload + validation + GROBID fallback chain)
- `app/services/bibtex_assembler.py` — Waterfall orchestrator (CrossRef → S2 → DBLP → fallback)
- `app/services/grobid_service.py` — GROBID API client with fallback chain
- `app/services/grobid_xml_parser.py` — TEI XML → ParsedReference
- `app/services/crossref_service.py` — CrossRef DOI/title lookup
- `app/services/semanticscholar_service.py` — Semantic Scholar title lookup
- `app/services/dblp_service.py` — DBLP title lookup
- `app/utils/bibtex_formatter.py` — Citation key generation + LaTeX-aware BibTeX escaping
- `app/utils/rate_limiter.py` — Token bucket rate limiter
- `app/utils/text_similarity.py` — Title fuzzy matching

### Frontend (`frontend/`)
- `src/app/page.tsx` — Main page (upload → progress → results)
- `src/components/pdf-upload-zone.tsx` — Drag-and-drop PDF upload
- `src/components/reference-list.tsx` — Results display with select/filter
- `src/components/reference-item.tsx` — Individual reference card
- `src/components/settings-dialog.tsx` — GROBID instance selection + health check
- `src/components/export-toolbar.tsx` — Export .bib / copy to clipboard
- `src/components/filter-bar.tsx` — Filter by match status
- `src/components/bibtex-preview.tsx` — BibTeX syntax-highlighted preview
- `src/hooks/use-extract-references.ts` — Upload + extraction state machine
- `src/hooks/use-export-bibtex.ts` — Export logic
- `src/lib/api-client.ts` — Backend API functions
- `src/lib/types.ts` — TypeScript types (Reference, ExtractResponse, etc.)

## Key Technical Decisions

- GROBID is the academic standard for PDF structure extraction (F1 ~0.87-0.90). Runs as external service, not embedded.
- 4 GROBID instances configured with automatic fallback chain. Selected instance tried first, then others in order.
- BibTeX matching uses waterfall strategy: DOI→CrossRef, title→Semantic Scholar, title→DBLP, then GROBID fallback `@misc`.
- All three external APIs are free but rate-limited. Token bucket rate limiters enforce per-service RPS.
- Concurrent resolution with semaphore (`max_concurrent_lookups=10`).
- BibTeX escaping is LaTeX-aware: detects `\commands`, `{braces}`, `$math$` and only escapes BibTeX-special chars (`& % # _`), preserving LaTeX structure.
- Frontend health checks proxy through backend (`/api/grobid-instances/{id}/health`) to avoid CORS.
- The tool deliberately does NOT do literature management or AI writing — it solves only the mechanical BibTeX collection problem.

## Development Phases

- **Phase 1 (MVP)** ✅: Single PDF → full reference BibTeX list → copy/download. Filter by match status. GROBID instance selection + fallback.
- **Phase 2**: Multi-PDF upload, merge & dedup across PDFs
- **Phase 3**: Semantic topic clustering, cross-PDF citation frequency
- **Phase 4**: Overleaf integration, Chrome extension, citation graph visualization

## Constraints & Risks

- API rate limits on CrossRef / Semantic Scholar — cache BibTeX results by DOI at scale
- GROBID parsing degrades on non-standard layouts (workshop papers, preprints) — fallback chain mitigates
- No PDF content is stored server-side; only BibTeX metadata is cached
- Target: >95% parse success rate, >85% BibTeX match rate, <30s per PDF
