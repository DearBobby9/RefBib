import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Reference } from "@/lib/types";
import { useWorkspace } from "@/hooks/use-workspace";

const WORKSPACE_STORAGE_KEY = "refbib:workspace-v2";

function createStorageMock(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

function makeReference(index: number, title: string): Reference {
  return {
    index,
    raw_citation: `${title}.`,
    title,
    authors: ["Doe, J."],
    year: 2024,
    doi: null,
    venue: "TestConf",
    bibtex: `@article{ref${index}, title={${title}}}`,
    citation_key: `ref${index}`,
    match_status: "matched",
    match_source: "crossref",
    url: null,
  };
}

function makeReferenceWithDoi(
  index: number,
  title: string,
  doi: string
): Reference {
  return { ...makeReference(index, title), doi };
}

describe("useWorkspace", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createStorageMock(),
      configurable: true,
    });
  });

  it("persists addReferences immediately to localStorage", () => {
    const { result } = renderHook(() => useWorkspace());

    let addResult:
      | ReturnType<typeof result.current.addReferences>
      | undefined;
    act(() => {
      addResult = result.current.addReferences({
        paperId: "paper-1",
        paperLabel: "paper-1.pdf",
        references: [makeReference(1, "Immediate Persistence")],
      });
    });

    expect(addResult).toEqual({ added: 1, merged: 0, conflicts: 0 });

    const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].reference.title).toBe("Immediate Persistence");
  });

  it("persists clearWorkspace immediately to localStorage", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.addReferences({
        paperId: "paper-1",
        paperLabel: "paper-1.pdf",
        references: [makeReference(1, "Keep me")],
      });
    });

    act(() => {
      result.current.clearWorkspace();
    });

    const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.entries).toHaveLength(0);
  });

  it("deduplicates by DOI and increments occurrence_count", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.addReferences({
        paperId: "paper-1",
        paperLabel: "paper-1.pdf",
        references: [makeReferenceWithDoi(1, "Paper A", "10.1234/a")],
      });
    });

    let addResult:
      | ReturnType<typeof result.current.addReferences>
      | undefined;
    act(() => {
      addResult = result.current.addReferences({
        paperId: "paper-2",
        paperLabel: "paper-2.pdf",
        references: [makeReferenceWithDoi(1, "Paper A different title", "10.1234/a")],
      });
    });

    expect(addResult).toEqual({ added: 0, merged: 1, conflicts: 0 });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].occurrence_count).toBe(2);
    expect(result.current.entries[0].source_refs).toHaveLength(2);
  });

  it("deduplicates by fingerprint (title+year+author) when no DOI", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.addReferences({
        paperId: "paper-1",
        paperLabel: "paper-1.pdf",
        references: [makeReference(1, "Exact Title Match")],
      });
    });

    let addResult:
      | ReturnType<typeof result.current.addReferences>
      | undefined;
    act(() => {
      // Same title, year, and first author — should merge by fingerprint.
      addResult = result.current.addReferences({
        paperId: "paper-2",
        paperLabel: "paper-2.pdf",
        references: [makeReference(2, "Exact Title Match")],
      });
    });

    expect(addResult).toEqual({ added: 0, merged: 1, conflicts: 0 });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].occurrence_count).toBe(2);
  });

  it("auto-merges when title similarity >= 0.95", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.addReferences({
        paperId: "paper-1",
        paperLabel: "paper-1.pdf",
        references: [makeReference(1, "Attention Is All You Need")],
      });
    });

    let addResult:
      | ReturnType<typeof result.current.addReferences>
      | undefined;
    act(() => {
      // Nearly identical title — high similarity, should auto-merge.
      addResult = result.current.addReferences({
        paperId: "paper-2",
        paperLabel: "paper-2.pdf",
        references: [makeReference(2, "Attention Is All You Need.")],
      });
    });

    expect(addResult?.merged).toBe(1);
    expect(result.current.entries).toHaveLength(1);
  });

  it("detects conflicts when title similarity is between 0.88 and 0.95", () => {
    const { result } = renderHook(() => useWorkspace());

    // These two titles have bigram similarity ~0.925 (between 0.88 conflict threshold
    // and 0.95 auto-merge threshold).
    act(() => {
      result.current.addReferences({
        paperId: "paper-1",
        paperLabel: "paper-1.pdf",
        references: [
          makeReference(1, "A Survey on Transfer Learning for Deep Neural Networks"),
        ],
      });
    });

    let addResult:
      | ReturnType<typeof result.current.addReferences>
      | undefined;
    act(() => {
      addResult = result.current.addReferences({
        paperId: "paper-2",
        paperLabel: "paper-2.pdf",
        references: [
          makeReference(2, "A Survey on Transfer Learning for Deep Learning Networks"),
        ],
      });
    });

    expect(addResult?.conflicts).toBe(1);
    expect(addResult?.added).toBe(1);
    const conflictEntry = result.current.entries.find(
      (e) => e.dedup_status === "conflict"
    );
    expect(conflictEntry).toBeDefined();
    expect(conflictEntry?.conflict_with).toBeTruthy();
  });

  it("adds as unique when titles are sufficiently different", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.addReferences({
        paperId: "paper-1",
        paperLabel: "paper-1.pdf",
        references: [makeReference(1, "Machine Learning for Climate Science")],
      });
    });

    let addResult:
      | ReturnType<typeof result.current.addReferences>
      | undefined;
    act(() => {
      addResult = result.current.addReferences({
        paperId: "paper-2",
        paperLabel: "paper-2.pdf",
        references: [makeReference(2, "Quantum Computing and Cryptography")],
      });
    });

    expect(addResult).toEqual({ added: 1, merged: 0, conflicts: 0 });
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries.every((e) => e.dedup_status === "unique")).toBe(
      true
    );
  });

  it("does not merge a DOI entry via title similarity", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.addReferences({
        paperId: "paper-1",
        paperLabel: "paper-1.pdf",
        references: [makeReferenceWithDoi(1, "Same Title", "10.1234/a")],
      });
    });

    let addResult:
      | ReturnType<typeof result.current.addReferences>
      | undefined;
    act(() => {
      // Same title but different DOI — should add as new, not merge via similarity.
      addResult = result.current.addReferences({
        paperId: "paper-2",
        paperLabel: "paper-2.pdf",
        references: [makeReferenceWithDoi(2, "Same Title", "10.1234/b")],
      });
    });

    // DOI mismatch means it's a genuinely different paper — adds as unique.
    expect(addResult?.added).toBe(1);
    expect(result.current.entries).toHaveLength(2);
  });
});
