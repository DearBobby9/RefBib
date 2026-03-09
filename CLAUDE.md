# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RefBib** — A lightweight web app that extracts all references from an academic PDF and outputs standard BibTeX entries. Core workflow: drag PDF → auto-extract references → select entries → export `.bib` file.

Target users: researchers writing LaTeX/Overleaf papers who need to batch-collect BibTeX from reference lists.

**GitHub:** https://github.com/DearBobby9/RefBib
**Live:** https://ref-bib.vercel.app (password-protected)

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
                                                 │     citation-key dedup       │
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
cd backend && .venv/bin/pytest       # backend tests (84 tests)
cd frontend && npx vitest run        # frontend tests (16 tests)
cd frontend && npm run build         # frontend type-check + build

# GROBID (local Docker, optional)
docker run --rm -p 8070:8070 grobid/grobid:0.8.2-crf
```

## Key File Locations

### Backend (`backend/`)
- `app/main.py` — FastAPI app entry, CORS, lifespan (httpx clients + rate limiters)
- `app/config.py` — Settings + GROBID_INSTANCES list (6 instances)
- `app/routers/auth.py` — `/api/verify-password`, `/api/auth/status` (hmac.compare_digest)
- `app/routers/health.py` — `/api/health`, `/api/grobid-instances`, `/api/grobid-instances/{id}/health`
- `app/routers/references.py` — `POST /api/extract` (PDF upload + validation + GROBID fallback chain), `POST /api/discovery/check`, `POST /api/resolve-doi`
- `app/models/api.py` — Pydantic models (DiscoveryReferenceInput, ResolveDoiRequest/Response with DOI regex + field length validators)
- `app/services/bibtex_assembler.py` — Waterfall orchestrator (CrossRef → S2 → DBLP → fallback)
- `app/services/discovery_service.py` — Unmatched discovery: probe CrossRef/S2/DBLP for availability (decoupled from match_status)
- `app/services/grobid_service.py` — GROBID API client with fallback chain
- `app/services/grobid_xml_parser.py` — TEI XML → ParsedReference
- `app/services/crossref_service.py` — CrossRef DOI/title lookup
- `app/services/semanticscholar_service.py` — Semantic Scholar title lookup
- `app/services/dblp_service.py` — DBLP title lookup
- `app/utils/bibtex_formatter.py` — Citation key generation + LaTeX-aware BibTeX escaping
- `app/utils/rate_limiter.py` — Token bucket rate limiter
- `app/utils/text_similarity.py` — Title fuzzy matching

### Frontend (`frontend/`)
- `src/app/page.tsx` — Main page (unified queue: upload → batch progress → batch summary, single file auto-expands)
- `src/app/workspace/page.tsx` — Workspace page (search/filter, dedup stats, source papers, conflict queue, analytics, export); WorkspaceEntryCard displays authors (first 3 + "et al.") and venue/year metadata
- `src/components/pdf-upload-zone.tsx` — Drag-and-drop PDF upload (supports multi-file, max 20)
- `src/components/reference-list.tsx` — Results display with select/filter + DOI resolution override
- `src/components/reference-item.tsx` — Individual reference card (title links, Scholar search for all statuses, fuzzy warnings, DOI resolve input)
- `src/components/batch-progress.tsx` — Processing progress with per-file status + "Add more" append button
- `src/components/batch-summary.tsx` — Results with Radix Collapsible accordion, resume/retry, auto-expand for single file, append button
- `src/components/conflict-resolver.tsx` — Interactive conflict merge/keep-both UI
- `src/components/bibtex-editor.tsx` — Dialog-based BibTeX override editor
- `src/components/workspace-analytics.tsx` — Recharts dashboard (year bar, venue bar, match pie, most-cited)
- `src/components/grouped-references.tsx` — Collapsible grouped display by venue/year
- `src/components/instance-notice.tsx` — Self-hosted instance notice banner
- `src/components/app-header.tsx` — Top navigation with Extract | Workspace tabs (NavTabs subcomponent)
- `src/components/site-footer.tsx` — Site footer
- `src/components/workspace-dock.tsx` — Sticky workspace indicator on extract page
- `src/components/theme-provider.tsx` — next-themes ThemeProvider wrapper
- `src/components/theme-toggle.tsx` — Sun/Moon dark mode toggle button
- `src/components/password-gate.tsx` — Auth gate with server health check + retry for cold starts
- `src/components/settings-dialog.tsx` — GROBID instance selection + health check
- `src/components/export-toolbar.tsx` — Export .bib / copy to clipboard + Add to Workspace (compact prop for nested contexts)
- `src/components/filter-bar.tsx` — Filter by match status
- `src/components/bibtex-preview.tsx` — BibTeX syntax-highlighted preview
- `src/hooks/use-batch-extract.ts` — Unified extraction queue (single + batch) with abort, resume, retry, append
- `src/hooks/use-notification-sound.ts` — Web Audio API chime on extraction completion (no audio files)
- `src/hooks/use-export-bibtex.ts` — Export logic
- `src/hooks/use-workspace.ts` — Workspace state (localStorage, V2 schema, O(1) dedup with bigram similarity)
- `src/lib/api-client.ts` — Backend API functions (extract, discovery, health, auth, resolveByDoi)
- `src/lib/types.ts` — TypeScript types (Reference, ExtractResponse, WorkspaceEntry, BatchFileResult, etc.)
- `src/lib/text-utils.ts` — Shared text utilities (normalizeText, buildBigrams, buildPaperId, titleSimilarity)
- `src/lib/constants.ts` — Shared constants (GROBID instance defaults, storage keys, Scholar search base URL)

## Current Delivery Snapshot

Implemented now:

- Unified extraction queue — single file and batch use the same flow (single file = batch of 1, auto-expanded)
- Multi-PDF batch upload (sequential processing, max 20, auto-add matched/fuzzy to workspace)
- Append PDFs at any stage ("Add more PDFs" button during processing or on results page)
- Batch resume/retry — resume remaining pending files, retry individual failed files
- Progressive rendering for large reference lists in compact accordion mode (rAF-based chunked render)
- Abort handling with status revert — cancel leaves files in correct state (pending/error, not stuck processing)
- GROBID instance picker + health checks + automatic fallback chain
- Match status UX (`matched` / `fuzzy` / `unmatched`) with search + status filter
- Manual DOI resolution for unmatched references (`/api/resolve-doi` + inline UI)
- BibTeX export (copy + download)
- Password gate and backend cold-start handling
- Dark mode toggle
- Local Workspace with dedup (DOI, fingerprint, bigram similarity), conflict queue, workspace-level export
- Conflict resolution (interactive merge/keep-both in conflict queue)
- Manual BibTeX editor (override_bibtex with dialog-based textarea)
- Workspace analytics dashboard (Recharts: year bar, venue bar, match pie, most-cited list)
- Workspace search/filter (text search + dedup status toggle chips)
- Venue/Year grouping (collapsible grouped display)
- Unmatched Discovery (`/api/discovery/check`) — probe CrossRef/S2/DBLP availability
- App-level navigation (Extract | Workspace tabs)
- Instance notice banner (self-hosted info, rate limits, GitHub CTA)
- Notification chime on extraction completion (Web Audio API, no audio files)
- Google Scholar search button on all references (Extract + Workspace)
- Clickable title links + DOI links in workspace entry cards
- Workspace card authors display (first 3 + "et al.") and venue/year metadata
- Frontend vitest test suite (22 tests: workspace dedup + component tests + workspace card metadata)
- Backend pytest suite (84 tests)

Not implemented yet:

- Multi-workspace management (create/rename/switch/delete) — data structure ready, UI pending
- Semantic topic clustering
- Overleaf integration / browser extension / citation graph view

## Key Technical Decisions

- GROBID is the academic standard for PDF structure extraction (F1 ~0.87-0.90). Runs as external service, not embedded.
- 6 GROBID instances configured with automatic fallback chain. Selected instance tried first, then others in order.
- BibTeX matching uses waterfall strategy: DOI→CrossRef, title→Semantic Scholar, title→DBLP, then GROBID fallback `@misc`.
- All three external APIs are free but rate-limited. Token bucket rate limiters enforce per-service RPS.
- Concurrent resolution with semaphore (`max_concurrent_lookups=10`).
- BibTeX escaping is LaTeX-aware: detects `\commands`, `{braces}`, `$math$` and only escapes BibTeX-special chars (`& % # _`), preserving LaTeX structure.
- Frontend health checks proxy through backend (`/api/grobid-instances/{id}/health`) to avoid CORS.
- Password gate: `SITE_PASSWORD` env var on backend, frontend-only gate (no JWT/session). `hmac.compare_digest` for timing-safe comparison.
- Server health check on page load: auto-ping `/api/health` with 8s timeout, retry up to 5 times (3s interval) for Fly.io cold starts. Fail-closed: auth errors default to showing password wall.
- The tool deliberately does NOT use LLMs — all BibTeX comes from verified academic databases. No hallucinations.
- Each service returns `(bibtex, confidence, url)` tuples; URL is passed through to frontend for clickable reference titles.
- Dark mode via next-themes ThemeProvider, toggle button in header. CSS variables for light/dark already defined in globals.css.
- Workspace dedup uses O(1) lookup maps (doiMap, fingerprintMap) with bigram similarity fallback (thresholds: ≥0.95 auto-merge, 0.88–0.95 conflict, <0.88 unique).
- Discovery endpoint uses `DiscoveryReferenceInput` model (decoupled from internal `ParsedReference`) with DOI regex validation and field length caps.
- Shared constants in `src/lib/constants.ts` to avoid duplication across components.
- Unified queue model: single file and batch share the same `useBatchExtract` hook. No separate `useExtractReferences`. Single file = batch of 1 with auto-expand in BatchSummary.
- `appendFiles` uses eager ref sync (`fileResultsRef.current = next`) inside the state updater so `resumeBatch` can see appended files immediately without waiting for React re-render.
- `startBatch` iterates the closed-over `files` param (won't see appended files); appended files are processed by subsequent `resumeBatch` calls.
- Abort revert pattern: all async paths (startBatch, resumeBatch, retryFile) revert in-flight file status before returning on abort — prevents files stuck in "processing".
- Batch upload processes files sequentially (not concurrently) to respect API rate limits. No hardcoded file limit in the hook; PdfUploadZone enforces max 20.
- DOI resolution: `/api/resolve-doi` strips URL prefixes (`https://doi.org/`, `doi:`) and validates format. Uses CrossRef `_lookup_by_doi` → JSON fallback.
- DOI resolution uses `resolvedOverrides: Map<number, Partial<Reference>>` pattern in `reference-list.tsx` to overlay resolved data without mutating original extract response.
- Workspace search filters entries client-side; conflict queue and analytics always use unfiltered data to avoid hiding important items.
- Workspace analytics uses Recharts library for visualizations.
- `text-utils.ts` contains shared utilities (normalizeText, buildBigrams, buildPaperId, titleSimilarity) used by both workspace dedup and batch extract.
- `scrollbar-gutter: stable` on `html` (not `body`) to properly reserve viewport scrollbar space and prevent layout shift during accordion expand/collapse.
- `overflow-x: clip` on both `html` and `body` to prevent horizontal overflow (`hidden` used as fallback for older browsers).
- All flex button groups (filter-bar, export-toolbar, reference-item action row, workspace dedup filters) use `flex-wrap` for narrow viewport resilience.
- WorkspaceEntryCard title row uses `flex-1 min-w-0` on title + `shrink-0` on badge container to pin badges top-right regardless of title length.
- Progressive rendering in compact mode (inside batch accordion): rAF-based chunked render (16 items/frame) avoids blocking the main thread when expanding panels with 50+ references.

## Development Phases

- **Phase 1 (MVP)** ✅: Single PDF → full reference BibTeX list → copy/download. Filter by match status. GROBID instance selection + fallback.
- **Phase 1.5 (MVP+)** ✅: Workspace with dedup + discovery + navigation.
- **Phase 2 (Workspace Features)** ✅: Conflict resolution, BibTeX editor, analytics dashboard (Recharts), venue/year grouping.
- **Phase 2.5 (Batch + Search + DOI)** ✅: Multi-PDF batch upload, workspace search/filter, manual DOI resolution, unified queue model, append support, resume/retry, smooth accordion.
- **Phase 3**: Multi-workspace management, semantic topic clustering
- **Phase 4**: Overleaf integration, Chrome extension, citation graph visualization

## Deployment

- **Frontend**: Vercel (auto-deploy on push to main), root dir `frontend`
  - Env var: `NEXT_PUBLIC_API_URL=https://refbib-api.fly.dev`
- **Backend**: Fly.io, 1 machine × 256MB (free tier), region sjc
  - `auto_stop_machines = 'stop'`, `min_machines_running = 0` → cold starts
  - Secrets: `SITE_PASSWORD`, `FRONTEND_URL` (set via `fly secrets set`)
  - Deploy: `cd backend && fly deploy`
- No secrets in repo — all config via env vars / platform secrets

## Workflow Rules

### Post-Implementation Review (Mandatory)

After completing a feature, bug fix, or any meaningful code change:

1. **Auto-review with SuperPowers** — Immediately dispatch `superpowers:code-reviewer` to review the diff. Do NOT skip this step or wait for the user to ask.
2. **Report review results** — Summarize the review findings (Critical / Important / Suggestion) to the user. Fix Critical and Important issues before moving on.
3. **Manual testing guide** — After the review, provide a 中英文混合 manual testing guide that tells the user exactly how to verify the changes as a real human tester. Format:
   - 列出每个需要手动测试的场景 (list each scenario to test)
   - 给出具体的操作步骤 (provide concrete steps: click what, type what, expect what)
   - 标注 expected behavior 和 edge cases
   - 如果涉及多个页面/流程，按顺序排列测试路径

Example format:
```
### 手动测试指南 (Manual Testing Guide)

**前置条件 (Prerequisites):**
- `npm run dev` 启动前端
- Backend running on port 8000

**测试场景 1: [Feature Name]**
1. 打开 http://localhost:3000
2. 操作: [specific action]
3. Expected: [what should happen]
4. Edge case: [what to also try]
```

### Post-Push Documentation Sync (Mandatory)

After every `git push`, immediately update ALL related documentation and memory:

1. **CLAUDE.md** — Update "Current Delivery Snapshot", "Key File Locations", "Key Technical Decisions", "Development Phases", test counts, and any other sections affected by the pushed changes.
2. **Auto-memory** (`~/.claude/projects/.../memory/MEMORY.md`) — Update project status, features implemented, phase progress, and any new patterns or conventions.
3. **Topic memory files** — Update or create relevant topic files (e.g., `patterns.md`) if new patterns/conventions were established.

Do NOT wait for the user to ask — this is automatic after every push.

## Constraints & Risks

- API rate limits on CrossRef / Semantic Scholar — cache BibTeX results by DOI at scale
- GROBID parsing degrades on non-standard layouts (workshop papers, anonymous submissions with line numbers) — fallback chain mitigates
- Standard published papers: ~100% extraction. Anonymous review copies with line numbers: ~30-60%.
- No PDF content is stored server-side; only BibTeX metadata is cached
- Target: >95% parse success rate, >85% BibTeX match rate, <30s per PDF
