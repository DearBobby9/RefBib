import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceEntry, Reference } from "@/lib/types";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

// Mock BibtexEditor to avoid Radix Dialog portal complexity
vi.mock("@/components/bibtex-editor", () => ({
  BibtexEditor: ({ entry }: { entry: { id: string } }) => (
    <button data-testid={`edit-${entry.id}`}>Edit</button>
  ),
}));

// Mock heavy dependencies that WorkspacePage pulls in
vi.mock("@/components/settings-dialog", () => ({
  SettingsDialog: () => <button>settings</button>,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button>theme</button>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => null,
  Cell: () => null,
}));

function makeEntry(overrides: Partial<Reference> = {}): WorkspaceEntry {
  const reference: Reference = {
    index: 1,
    title: "Attention Is All You Need",
    authors: [],
    year: null,
    doi: null,
    venue: null,
    bibtex: "@article{vaswani2017, title={Attention Is All You Need}}",
    citation_key: "vaswani2017",
    match_status: "matched",
    match_source: "crossref",
    url: null,
    raw_citation: "Vaswani et al. Attention Is All You Need. 2017.",
    ...overrides,
  };

  return {
    id: "entry-1",
    workspace_id: "ws-1",
    paper_id: "paper-1",
    source_index: 0,
    ref_fingerprint: "fp-1",
    dedup_status: "unique",
    reference,
    source_refs: [
      { paper_id: "paper-1", paper_label: "test.pdf", source_index: 0 },
    ],
    occurrence_count: 1,
    conflict_with: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

// Mock useWorkspace — `mockEntries` is set per test
let mockEntries: WorkspaceEntry[] = [];

vi.mock("@/hooks/use-workspace", () => ({
  useWorkspace: () => ({
    activeWorkspace: { id: "ws-1", name: "Test", created_at: 0, updated_at: 0 },
    entries: mockEntries,
    stats: { papers: 1, refs: mockEntries.length, unique: mockEntries.length, conflicts: 0 },
    clearWorkspace: vi.fn(),
    resolveConflict: vi.fn(),
    updateEntryBibtex: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-export-bibtex", () => ({
  useExportBibtex: () => ({ downloadWorkspaceBib: vi.fn() }),
}));

// Import after all mocks
const { default: WorkspacePage } = await import("./page");

/** Helper: render page and return the card `<article>` element */
function renderCard(refOverrides: Partial<Reference> = {}) {
  mockEntries = [makeEntry(refOverrides)];
  render(<WorkspacePage />);
  return within(screen.getByRole("article"));
}

describe("WorkspaceEntryCard — authors & venue/year", () => {
  it("renders authors when present (first 3 + et al.)", () => {
    const card = renderCard({
      authors: ["Vaswani, A.", "Shazeer, N.", "Parmar, N.", "Uszkoreit, J."],
    });
    expect(
      card.getByText("Vaswani, A., Shazeer, N., Parmar, N. et al.")
    ).toBeInTheDocument();
  });

  it("renders exactly 3 authors without et al.", () => {
    const card = renderCard({
      authors: ["Vaswani, A.", "Shazeer, N.", "Parmar, N."],
    });
    expect(
      card.getByText("Vaswani, A., Shazeer, N., Parmar, N.")
    ).toBeInTheDocument();
    expect(card.queryByText(/et al\./)).not.toBeInTheDocument();
  });

  it("renders venue and year when both present", () => {
    const card = renderCard({ venue: "NeurIPS", year: 2017 });
    expect(card.getByText("NeurIPS")).toBeInTheDocument();
    expect(card.getByText("2017")).toBeInTheDocument();
  });

  it("renders only year when venue is null", () => {
    const card = renderCard({ venue: null, year: 2020 });
    expect(card.getByText("2020")).toBeInTheDocument();
  });

  it("renders only venue when year is null", () => {
    const card = renderCard({ venue: "ICML", year: null });
    expect(card.getByText("ICML")).toBeInTheDocument();
  });

  it("hides authors line when authors array is empty", () => {
    const card = renderCard({ authors: [] });
    expect(card.queryByText(/et al\./)).not.toBeInTheDocument();
  });

  it("hides venue/year line when both are null", () => {
    const card = renderCard({ venue: null, year: null });
    // Title should be present
    expect(card.getByText("Attention Is All You Need")).toBeInTheDocument();
  });
});
