# Frontend (RefBib)

Next.js frontend for RefBib.

Core flow:
- `Extract` view: upload PDF -> show extraction progress -> review/filter references -> export selected BibTeX entries
- `Workspace` view: inspect deduplicated local workspace, grouped source papers, conflicts, and workspace-level export

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 + shadcn/ui
- next-themes (light/dark mode)

## Prerequisites

- Node.js 18+
- Running backend API (default: `http://localhost:8000`)

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variable

Set backend API base URL:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If unset, frontend falls back to `http://localhost:8000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Key Files

- `src/app/page.tsx`: Main page composition and state wiring
- `src/app/workspace/page.tsx`: Workspace page (stats, grouped view, conflict queue, export/clear)
- `src/components/password-gate.tsx`: Server health + password wall UX
- `src/components/settings-dialog.tsx`: GROBID instance picker and health checks
- `src/components/app-header.tsx`: Shared top header + `Extract | Workspace` navigation
- `src/components/site-footer.tsx`: Shared footer
- `src/components/pdf-upload-zone.tsx`: Single PDF upload UI
- `src/components/reference-list.tsx`: Search/filter/select reference list
- `src/components/reference-item.tsx`: Per-reference card + BibTeX preview + unmatched discovery checks
- `src/components/export-toolbar.tsx`: Add-to-workspace + copy/download selected BibTeX
- `src/components/workspace-dock.tsx`: Floating workspace quick entry + counters
- `src/hooks/use-extract-references.ts`: Extraction state machine
- `src/hooks/use-workspace.ts`: Workspace store, v1->v2 migration, local dedup, discovery cache
- `src/lib/api-client.ts`: API calls (`/api/extract`, `/api/discovery/check`, `/api/health`, `/api/auth/*`)

## Current Status

Implemented:

- Single-PDF extraction UX
- Match status filtering (`matched`, `fuzzy`, `unmatched`)
- Unmatched `Check availability` flow (`available` / `unavailable` / `error` / `skipped`)
- Copy/download BibTeX
- Local Workspace with dedup stats, grouped source papers, conflict queue
- Workspace-level export (`unique` and `all with duplicates`)
- Top navigation (`Extract | Workspace`)
- Password gate
- GROBID instance selection + availability check
- Dark mode toggle

Not yet implemented:

- Multi-PDF batch upload UX
- Multi-workspace management
- Year/source filter controls
- Manual edit/retry tools for unmatched entries
