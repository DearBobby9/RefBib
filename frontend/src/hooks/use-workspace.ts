"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConflictResolution,
  DiscoveryCacheEntry,
  DiscoveryResult,
  Reference,
  WorkspaceAddResult,
  WorkspaceEntry,
  WorkspaceMeta,
  WorkspaceStats,
  WorkspaceStoreV2,
  WorkspaceSourceRef,
} from "@/lib/types";
import { normalizeText, buildBigrams, titleSimilarity } from "@/lib/text-utils";

const WORKSPACE_STORAGE_KEY = "refbib:workspace-v2";
const LEGACY_WORKSPACE_STORAGE_KEY = "refbib:workspace-v1";
const STORE_VERSION = 2;
const DEFAULT_WORKSPACE_ID = "default";
const DEFAULT_WORKSPACE_NAME = "Workspace";
const AUTO_MERGE_THRESHOLD = 0.95;
const CONFLICT_THRESHOLD = 0.88;
const DISCOVERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface LegacyStoredWorkspace {
  entries: WorkspaceEntry[];
  updated_at: number;
}

interface AddReferencesInput {
  paperId: string;
  paperLabel: string;
  references: Reference[];
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ws-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeDoi(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
}

function extractFirstAuthor(authors: string[]): string {
  if (authors.length === 0) return "";
  const first = normalizeText(authors[0]);
  const parts = first.split(" ").filter(Boolean);
  return parts[0] ?? "";
}

function exactFingerprint(reference: Reference): string {
  const doi = normalizeDoi(reference.doi);
  if (doi) return `doi:${doi}`;
  const normalizedTitle = normalizeText(reference.title);
  if (!normalizedTitle) return "";
  const year = reference.year ?? "na";
  const firstAuthor = extractFirstAuthor(reference.authors);
  return `title:${normalizedTitle}|year:${year}|author:${firstAuthor}`;
}

function discoveryFingerprint(reference: Reference): string | null {
  const exact = exactFingerprint(reference);
  if (exact) return exact;
  const fallback = normalizeText(reference.raw_citation);
  return fallback ? `raw:${fallback}` : null;
}

function mergeSourceRef(
  entry: WorkspaceEntry,
  sourceRef: WorkspaceSourceRef,
  now: number
): WorkspaceEntry {
  const exists = entry.source_refs.some(
    (source) =>
      source.paper_id === sourceRef.paper_id
      && source.source_index === sourceRef.source_index
  );
  if (exists) return entry;

  return {
    ...entry,
    source_refs: [...entry.source_refs, sourceRef],
    occurrence_count: entry.occurrence_count + 1,
    updated_at: now,
  };
}

function createDefaultWorkspaceMeta(now: number): WorkspaceMeta {
  return {
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME,
    created_at: now,
    updated_at: now,
  };
}

function createEmptyStore(now = Date.now()): WorkspaceStoreV2 {
  return {
    version: STORE_VERSION,
    active_workspace_id: DEFAULT_WORKSPACE_ID,
    workspaces: [createDefaultWorkspaceMeta(now)],
    entries: [],
    discovery_cache: {},
    updated_at: now,
  };
}

function toStoreFromLegacy(
  legacy: LegacyStoredWorkspace | null | undefined
): WorkspaceStoreV2 {
  const now = Date.now();
  const entries = Array.isArray(legacy?.entries) ? legacy.entries : [];
  return {
    ...createEmptyStore(now),
    entries,
    updated_at: legacy?.updated_at ?? now,
  };
}

function isStoreV2(value: unknown): value is WorkspaceStoreV2 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkspaceStoreV2>;
  return (
    candidate.version === STORE_VERSION
    && typeof candidate.active_workspace_id === "string"
    && Array.isArray(candidate.workspaces)
    && Array.isArray(candidate.entries)
    && typeof candidate.discovery_cache === "object"
    && candidate.discovery_cache !== null
  );
}

function pruneExpiredDiscoveryCache(
  cache: Record<string, DiscoveryCacheEntry>
): Record<string, DiscoveryCacheEntry> {
  const now = Date.now();
  const pruned: Record<string, DiscoveryCacheEntry> = {};
  for (const [key, entry] of Object.entries(cache)) {
    if (entry.expires_at > now) {
      pruned[key] = entry;
    }
  }
  return pruned;
}

function loadWorkspaceFromStorage(): WorkspaceStoreV2 {
  if (typeof window === "undefined") return createEmptyStore();

  try {
    const current = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      if (isStoreV2(parsed)) {
        // Prune expired discovery cache entries on load.
        parsed.discovery_cache = pruneExpiredDiscoveryCache(parsed.discovery_cache);
        return parsed;
      }
    }
  } catch {
    // Fall through to migration/default.
  }

  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw) as LegacyStoredWorkspace;
      const migrated = toStoreFromLegacy(legacyParsed);
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // Fall through to empty store.
  }

  return createEmptyStore();
}

function persistWorkspace(store: WorkspaceStoreV2) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures (private mode/quota exceeded).
  }
}

function computeStats(entries: WorkspaceEntry[]): WorkspaceStats {
  const paperIds = new Set<string>();
  let refs = 0;
  let conflicts = 0;

  for (const entry of entries) {
    refs += entry.occurrence_count;
    if (entry.dedup_status === "conflict") conflicts += 1;
    for (const source of entry.source_refs) {
      paperIds.add(source.paper_id);
    }
  }

  return {
    papers: paperIds.size,
    refs,
    unique: entries.length,
    conflicts,
  };
}

export function useWorkspace() {
  const [store, setStore] = useState<WorkspaceStoreV2>(createEmptyStore);
  const storeRef = useRef(store);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage after mount to avoid SSR/client mismatch.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const persisted = loadWorkspaceFromStorage();
    // Only update if localStorage actually had data (avoid unnecessary render).
    const hasPersistedData =
      persisted.entries.length > 0 ||
      persisted.workspaces.length > 1 ||
      Object.keys(persisted.discovery_cache).length > 0;
    if (hasPersistedData) {
      storeRef.current = persisted;
      setStore(persisted);
    }
  }, []);

  useEffect(() => {
    storeRef.current = store;
    // Only persist after hydration to avoid overwriting localStorage with empty store.
    if (hydratedRef.current) {
      persistWorkspace(store);
    }
  }, [store]);

  const commitStore = useCallback((nextStore: WorkspaceStoreV2) => {
    storeRef.current = nextStore;
    setStore(nextStore);
  }, []);

  const activeWorkspace = useMemo(
    () =>
      store.workspaces.find(
        (workspace) => workspace.id === store.active_workspace_id
      ) || store.workspaces[0],
    [store.active_workspace_id, store.workspaces]
  );

  const entries = useMemo(
    () =>
      store.entries.filter(
        (entry) => entry.workspace_id === store.active_workspace_id
      ),
    [store.active_workspace_id, store.entries]
  );

  const stats = useMemo(() => computeStats(entries), [entries]);

  const addReferences = useCallback(
    ({ paperId, paperLabel, references }: AddReferencesInput): WorkspaceAddResult => {
      const selected = references.filter((reference) => Boolean(reference.bibtex));
      const result: WorkspaceAddResult = { added: 0, merged: 0, conflicts: 0 };
      const previous = storeRef.current;
      const now = Date.now();
      const workspaceId = previous.active_workspace_id;
      const nextEntries = [...previous.entries];

      // Pre-build lookup maps from existing workspace entries for O(1) dedup.
      const doiMap = new Map<string, number>();
      const fingerprintMap = new Map<string, number>();
      // Entries without a DOI are candidates for title-similarity comparison.
      const similarityCandidateIndices: number[] = [];

      for (let i = 0; i < nextEntries.length; i += 1) {
        const entry = nextEntries[i];
        if (entry.workspace_id !== workspaceId) continue;

        const entryDoi = normalizeDoi(entry.reference.doi);
        if (entryDoi) {
          doiMap.set(entryDoi, i);
        } else {
          similarityCandidateIndices.push(i);
        }

        const fp = exactFingerprint(entry.reference);
        if (fp) {
          fingerprintMap.set(fp, i);
        }
      }

      for (const reference of selected) {
        const sourceRef: WorkspaceSourceRef = {
          paper_id: paperId,
          paper_label: paperLabel,
          source_index: reference.index,
        };

        const doi = normalizeDoi(reference.doi);
        let mergedIndex = -1;

        // 1) Exact DOI match — O(1)
        if (doi) {
          mergedIndex = doiMap.get(doi) ?? -1;
        }

        // 2) Fingerprint match — O(1)
        if (mergedIndex < 0) {
          const fingerprint = exactFingerprint(reference);
          if (fingerprint) {
            mergedIndex = fingerprintMap.get(fingerprint) ?? -1;
          }
        }

        if (mergedIndex >= 0) {
          nextEntries[mergedIndex] = mergeSourceRef(
            nextEntries[mergedIndex],
            sourceRef,
            now
          );
          result.merged += 1;
          continue;
        }

        // 3) Title similarity scan — only against non-DOI entries
        let bestCandidateIndex = -1;
        let bestScore = 0;
        for (const candidateIdx of similarityCandidateIndices) {
          const candidate = nextEntries[candidateIdx];
          const score = titleSimilarity(reference.title, candidate.reference.title);
          if (score > bestScore) {
            bestScore = score;
            bestCandidateIndex = candidateIdx;
          }
        }

        if (bestCandidateIndex >= 0 && bestScore >= AUTO_MERGE_THRESHOLD) {
          nextEntries[bestCandidateIndex] = mergeSourceRef(
            nextEntries[bestCandidateIndex],
            sourceRef,
            now
          );
          result.merged += 1;
          continue;
        }

        const bestCandidateId =
          bestCandidateIndex >= 0 ? nextEntries[bestCandidateIndex].id : null;
        const status =
          bestCandidateId && bestScore >= CONFLICT_THRESHOLD ? "conflict" : "unique";
        if (status === "conflict") {
          result.conflicts += 1;
        }

        const newId = createId();
        const fp = exactFingerprint(reference) || `manual:${createId()}`;
        const newEntryIndex = nextEntries.length;

        nextEntries.push({
          id: newId,
          workspace_id: workspaceId,
          paper_id: paperId,
          source_index: reference.index,
          ref_fingerprint: fp,
          dedup_status: status,
          reference,
          source_refs: [sourceRef],
          occurrence_count: 1,
          conflict_with: bestCandidateId,
          created_at: now,
          updated_at: now,
        });
        result.added += 1;

        // Keep lookup maps updated for subsequent references in this batch.
        const newDoi = normalizeDoi(reference.doi);
        if (newDoi) {
          doiMap.set(newDoi, newEntryIndex);
        } else {
          similarityCandidateIndices.push(newEntryIndex);
        }
        if (fp) {
          fingerprintMap.set(fp, newEntryIndex);
        }
      }

      const nextStore: WorkspaceStoreV2 = {
        ...previous,
        entries: nextEntries,
        workspaces: previous.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? { ...workspace, updated_at: now }
            : workspace
        ),
        updated_at: now,
      };
      commitStore(nextStore);

      return result;
    },
    [commitStore]
  );

  const clearWorkspace = useCallback(() => {
    const previous = storeRef.current;
    const now = Date.now();
    commitStore({
      ...previous,
      entries: previous.entries.filter(
        (entry) => entry.workspace_id !== previous.active_workspace_id
      ),
      workspaces: previous.workspaces.map((workspace) =>
        workspace.id === previous.active_workspace_id
          ? { ...workspace, updated_at: now }
          : workspace
      ),
      updated_at: now,
    });
  }, [commitStore]);

  const getCachedDiscovery = useCallback(
    (reference: Reference): DiscoveryResult | null => {
      const key = discoveryFingerprint(reference);
      if (!key) return null;
      const cached = store.discovery_cache[key];
      if (!cached) return null;
      if (cached.expires_at <= Date.now()) return null;
      return cached.result;
    },
    [store.discovery_cache]
  );

  const cacheDiscoveryResult = useCallback(
    (reference: Reference, result: DiscoveryResult) => {
      const key = discoveryFingerprint(reference);
      if (!key) return;
      const previous = storeRef.current;
      const now = Date.now();
      commitStore({
        ...previous,
        discovery_cache: {
          ...previous.discovery_cache,
          [key]: {
            result,
            checked_at: now,
            expires_at: now + DISCOVERY_CACHE_TTL_MS,
          },
        },
        updated_at: now,
      });
    },
    [commitStore]
  );

  const resolveConflict = useCallback(
    (entryId: string, resolution: ConflictResolution) => {
      const previous = storeRef.current;
      const now = Date.now();
      const workspaceId = previous.active_workspace_id;
      const nextEntries = [...previous.entries];

      const entryIdx = nextEntries.findIndex(
        (e) => e.id === entryId && e.workspace_id === workspaceId
      );
      if (entryIdx < 0) return;
      const entry = nextEntries[entryIdx];
      if (entry.dedup_status !== "conflict") return;

      const conflictIdx = entry.conflict_with
        ? nextEntries.findIndex(
            (e) => e.id === entry.conflict_with && e.workspace_id === workspaceId
          )
        : -1;

      if (resolution === "keep_both") {
        nextEntries[entryIdx] = {
          ...entry,
          dedup_status: "unique",
          conflict_with: null,
          resolved_at: now,
          updated_at: now,
        };
        if (conflictIdx >= 0) {
          const other = nextEntries[conflictIdx];
          if (other.dedup_status === "conflict" && other.conflict_with === entryId) {
            nextEntries[conflictIdx] = {
              ...other,
              dedup_status: "unique",
              conflict_with: null,
              resolved_at: now,
              updated_at: now,
            };
          }
        }
      } else {
        // "merge": pick winner based on match quality, combine source_refs.
        if (conflictIdx < 0) {
          // No counterpart found — just mark unique.
          nextEntries[entryIdx] = {
            ...entry,
            dedup_status: "unique",
            conflict_with: null,
            resolved_at: now,
            updated_at: now,
          };
        } else {
          const other = nextEntries[conflictIdx];
          const rank = (e: WorkspaceEntry) => {
            if (e.reference.doi) return 3;
            if (e.reference.match_status === "matched") return 2;
            if (e.reference.match_status === "fuzzy") return 1;
            return 0;
          };
          const [winnerIdx, loserIdx] =
            rank(other) > rank(entry)
              ? [conflictIdx, entryIdx]
              : [entryIdx, conflictIdx];
          const winner = nextEntries[winnerIdx];
          const loser = nextEntries[loserIdx];

          // Merge source_refs and occurrence_count from loser into winner.
          const mergedSourceRefs = [...winner.source_refs];
          for (const sr of loser.source_refs) {
            const exists = mergedSourceRefs.some(
              (s) => s.paper_id === sr.paper_id && s.source_index === sr.source_index
            );
            if (!exists) mergedSourceRefs.push(sr);
          }

          nextEntries[winnerIdx] = {
            ...winner,
            dedup_status: "unique",
            conflict_with: null,
            source_refs: mergedSourceRefs,
            occurrence_count: winner.occurrence_count + loser.occurrence_count,
            resolved_at: now,
            updated_at: now,
          };

          // Remove loser.
          const loserId = loser.id;
          nextEntries.splice(loserIdx, 1);

          // Update any other entries whose conflict_with pointed to the loser.
          for (let i = 0; i < nextEntries.length; i++) {
            if (nextEntries[i].conflict_with === loserId) {
              nextEntries[i] = {
                ...nextEntries[i],
                conflict_with: null,
                dedup_status: "unique",
                updated_at: now,
              };
            }
          }
        }
      }

      commitStore({
        ...previous,
        entries: nextEntries,
        workspaces: previous.workspaces.map((ws) =>
          ws.id === workspaceId ? { ...ws, updated_at: now } : ws
        ),
        updated_at: now,
      });
    },
    [commitStore]
  );

  const updateEntryBibtex = useCallback(
    (entryId: string, bibtex: string | null) => {
      const previous = storeRef.current;
      const now = Date.now();
      const nextEntries = previous.entries.map((entry) =>
        entry.id === entryId
          ? { ...entry, override_bibtex: bibtex, updated_at: now }
          : entry
      );
      commitStore({ ...previous, entries: nextEntries, updated_at: now });
    },
    [commitStore]
  );

  const getUniqueReferences = useCallback(
    () => entries.map((entry) => entry.reference),
    [entries]
  );

  const getAllReferences = useCallback(
    () =>
      entries.flatMap((entry) =>
        Array.from({ length: entry.occurrence_count }, () => entry.reference)
      ),
    [entries]
  );

  return {
    store,
    activeWorkspace,
    entries,
    stats,
    addReferences,
    clearWorkspace,
    resolveConflict,
    updateEntryBibtex,
    getCachedDiscovery,
    cacheDiscoveryResult,
    getUniqueReferences,
    getAllReferences,
  };
}
