export type MatchStatus = "matched" | "fuzzy" | "unmatched";
export type MatchSource =
  | "crossref"
  | "semantic_scholar"
  | "dblp"
  | "grobid_fallback";
export type DedupStatus = "unique" | "merged" | "conflict";
export type ConflictResolution = "merge" | "keep_both";
export type GroupByMode = "none" | "venue" | "year";
export type DiscoveryStatus = "available" | "unavailable" | "error" | "skipped";
export type DiscoverySource = "crossref" | "semantic_scholar" | "dblp";

export interface Reference {
  index: number;
  title: string | null;
  authors: string[];
  year: number | null;
  doi: string | null;
  venue: string | null;
  bibtex: string | null;
  citation_key: string | null;
  match_status: MatchStatus;
  match_source: MatchSource | null;
  url: string | null;
  raw_citation: string;
}

export interface ExtractResponse {
  references: Reference[];
  total_count: number;
  matched_count: number;
  fuzzy_count: number;
  unmatched_count: number;
  processing_time_seconds: number;
}

export interface ExtractError {
  detail: string;
}

export interface GrobidInstance {
  id: string;
  name: string;
  url: string;
  description: string;
}

export interface GrobidInstancesResponse {
  instances: GrobidInstance[];
  default_id: string | null;
}

export interface WorkspaceSourceRef {
  paper_id: string;
  paper_label: string;
  source_index: number;
}

export interface WorkspaceEntry {
  id: string;
  workspace_id: string;
  paper_id: string;
  source_index: number;
  ref_fingerprint: string;
  dedup_status: DedupStatus;
  reference: Reference;
  source_refs: WorkspaceSourceRef[];
  occurrence_count: number;
  conflict_with: string | null;
  override_bibtex?: string | null;
  resolved_at?: number | null;
  created_at: number;
  updated_at: number;
}

export interface WorkspaceStats {
  papers: number;
  refs: number;
  unique: number;
  conflicts: number;
}

export interface WorkspaceAddResult {
  added: number;
  merged: number;
  conflicts: number;
}

export interface DiscoveryResult {
  index: number;
  discovery_status: DiscoveryStatus;
  available_on: DiscoverySource[];
  best_confidence: number | null;
  best_url: string | null;
  reason: string | null;
}

export interface DiscoveryCheckResponse {
  results: DiscoveryResult[];
}

export interface DiscoveryCacheEntry {
  result: DiscoveryResult;
  checked_at: number;
  expires_at: number;
}

export interface WorkspaceMeta {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface WorkspaceStoreV2 {
  version: 2;
  active_workspace_id: string;
  workspaces: WorkspaceMeta[];
  entries: WorkspaceEntry[];
  discovery_cache: Record<string, DiscoveryCacheEntry>;
  updated_at: number;
}

export interface WorkspaceReferenceView {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  dedup_status: DedupStatus;
  occurrence_count: number;
  source_refs: WorkspaceSourceRef[];
  doi: string | null;
  citation_key: string | null;
}
