# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RefBib** — A lightweight web app that extracts all references from an academic PDF and outputs standard BibTeX entries. Core workflow: drag PDF → auto-extract references → select entries → export `.bib` file.

Target users: researchers writing LaTeX/Overleaf papers who need to batch-collect BibTeX from reference lists.

## Architecture

```
Frontend (React + TailwindCSS)          Backend (Python FastAPI)
┌──────────────────────────┐           ┌─────────────────────────────┐
│  PDF drag-drop upload    │           │  1. GROBID: PDF → structured│
│  Reference list + select │  ──API──▶ │     citation list            │
│  .bib export / clipboard │           │  2. BibTeX lookup:          │
└──────────────────────────┘           │     DOI→CrossRef (primary)  │
                                       │     Title→Semantic Scholar  │
                                       │     Title→DBLP (CS papers)  │
                                       │     Fallback: GROBID raw    │
                                       │  3. Post-processing:        │
                                       │     dedup, clustering, keys │
                                       └─────────────────────────────┘
```

- **Frontend**: React + TailwindCSS, deployed on Vercel
- **Backend**: Python FastAPI, deployed on Railway/Fly.io
- **PDF parsing**: GROBID (Docker self-hosted or public instance), REST API
- **BibTeX sources**: CrossRef API, Semantic Scholar API, DBLP API (all free, rate-limited)
- **Semantic clustering** (P1+): Sentence-BERT / all-MiniLM-L6-v2 for title-based topic grouping

## Development Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# GROBID (Docker)
docker pull lfoppiano/grobid:0.8.0
docker run --rm -p 8070:8070 lfoppiano/grobid:0.8.0

# Tests
cd backend && pytest
cd frontend && npm test
```

## Key Technical Decisions

- GROBID is the academic standard for PDF structure extraction (F1 ~0.87-0.90). It runs as a separate Docker service exposing REST on port 8070.
- BibTeX matching uses a waterfall strategy: DOI→CrossRef first, then title→Semantic Scholar, then DBLP, then fallback to constructing BibTeX from GROBID's raw parse.
- All three external APIs (CrossRef, Semantic Scholar, DBLP) are free but rate-limited. Caching by DOI is needed at scale.
- The tool deliberately does NOT do literature management or AI writing — it solves only the mechanical BibTeX collection problem.

## Development Phases

- **Phase 1 (MVP)**: Single PDF → full reference BibTeX list → copy/download
- **Phase 2**: Multi-PDF upload, merge & dedup, match status visualization, filtering
- **Phase 3**: Semantic topic clustering, cross-PDF citation frequency
- **Phase 4**: Overleaf integration, Chrome extension, citation graph visualization

## Constraints & Risks

- API rate limits on CrossRef / Semantic Scholar — cache BibTeX results by DOI
- GROBID parsing degrades on non-standard layouts (workshop papers, preprints) — always have fallback
- No PDF content is stored server-side; only BibTeX metadata is cached
- Target: >95% parse success rate, >85% BibTeX match rate, <30s per PDF
