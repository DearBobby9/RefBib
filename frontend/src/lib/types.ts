export type MatchStatus = "matched" | "fuzzy" | "unmatched";
export type MatchSource =
  | "crossref"
  | "semantic_scholar"
  | "dblp"
  | "grobid_fallback";

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
