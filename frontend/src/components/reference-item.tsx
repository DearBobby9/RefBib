"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Link2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { resolveByDoi } from "@/lib/api-client";
import { BibtexPreview } from "./bibtex-preview";
import {
  DiscoveryResult,
  DiscoverySource,
  MatchStatus,
  Reference,
} from "@/lib/types";

const STATUS_STYLES: Record<MatchStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  matched: { label: "Matched", variant: "default" },
  fuzzy: { label: "Fuzzy", variant: "secondary" },
  unmatched: { label: "Unmatched", variant: "destructive" },
};

const SOURCE_LABELS: Record<string, string> = {
  crossref: "CrossRef",
  semantic_scholar: "S2",
  dblp: "DBLP",
  grobid_fallback: "GROBID",
};
const SCHOLAR_SEARCH_BASE = "https://scholar.google.com/scholar?q=";
const DISCOVERY_SOURCE_LABELS: Record<DiscoverySource, string> = {
  crossref: "CrossRef",
  semantic_scholar: "S2",
  dblp: "DBLP",
};

interface ReferenceItemProps {
  reference: Reference;
  selected: boolean;
  onToggle: (index: number) => void;
  getCachedDiscovery?: (reference: Reference) => DiscoveryResult | null;
  onCheckAvailability?: (reference: Reference) => Promise<DiscoveryResult>;
  onResolveByDoi?: (
    index: number,
    bibtex: string,
    url: string | null,
    citationKey: string | null
  ) => void;
}

export function ReferenceItem({
  reference,
  selected,
  onToggle,
  getCachedDiscovery,
  onCheckAvailability,
  onResolveByDoi,
}: ReferenceItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(
    () => (getCachedDiscovery ? getCachedDiscovery(reference) : null)
  );
  const [showDoiInput, setShowDoiInput] = useState(false);
  const [doiInput, setDoiInput] = useState("");
  const [resolvingDoi, setResolvingDoi] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const { label, variant } = STATUS_STYLES[reference.match_status];
  const titleText = reference.title || reference.raw_citation || "Untitled reference";
  const scholarSearchUrl = reference.title
    ? `${SCHOLAR_SEARCH_BASE}${encodeURIComponent(reference.title)}`
    : null;
  const titleLink = reference.url || scholarSearchUrl;
  const availableOnText = discoveryResult?.available_on
    .map((source) => DISCOVERY_SOURCE_LABELS[source] || source)
    .join(" / ");

  useEffect(() => {
    setDiscoveryResult(getCachedDiscovery ? getCachedDiscovery(reference) : null);
  }, [getCachedDiscovery, reference]);

  const handleCheckAvailability = async () => {
    if (!onCheckAvailability || checkingAvailability) return;
    setCheckingAvailability(true);
    try {
      const result = await onCheckAvailability(reference);
      setDiscoveryResult(result);
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Discovery failed. Please retry.";
      setDiscoveryResult({
        index: reference.index,
        discovery_status: "error",
        available_on: [],
        best_confidence: null,
        best_url: null,
        reason,
      });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const resolveAbortRef = useRef<AbortController | null>(null);

  const handleResolveDoi = async () => {
    if (!doiInput.trim() || resolvingDoi || !onResolveByDoi) return;
    resolveAbortRef.current?.abort();
    const controller = new AbortController();
    resolveAbortRef.current = controller;
    setResolvingDoi(true);
    setResolveError(null);
    try {
      const result = await resolveByDoi(doiInput.trim(), controller.signal);
      onResolveByDoi(
        reference.index,
        result.bibtex,
        result.url,
        result.citation_key
      );
      setShowDoiInput(false);
      setDoiInput("");
    } catch (err) {
      if (controller.signal.aborted) return;
      setResolveError(
        err instanceof Error ? err.message : "Failed to resolve DOI"
      );
    } finally {
      setResolvingDoi(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 transition-colors hover:bg-muted/30">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(reference.index)}
          className="mt-1"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono shrink-0">
              [{reference.index}]
            </span>
            <h3 className="text-sm font-medium leading-tight">
              {titleLink ? (
                <a
                  href={titleLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline underline-offset-2"
                >
                  {titleText}
                </a>
              ) : (
                titleText
              )}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            {reference.authors.length > 0 && (
              <span className="truncate max-w-[300px]">
                {reference.authors.slice(0, 3).join(", ")}
                {reference.authors.length > 3 && " et al."}
              </span>
            )}
            {reference.year && <span>{reference.year}</span>}
            {reference.venue && (
              <span className="italic truncate max-w-[200px]">
                {reference.venue}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Badge variant={variant} className="text-[10px] h-5">
              {label}
            </Badge>
            {reference.match_source && (
              <span className="text-[10px] text-muted-foreground">
                via {SOURCE_LABELS[reference.match_source] || reference.match_source}
              </span>
            )}
            {reference.match_status === "fuzzy" && (
              <span className="text-xs text-muted-foreground">
                ⚠ May not be exact match — verify before using
              </span>
            )}
            {reference.match_status === "unmatched" && scholarSearchUrl && (
              <a
                href={scholarSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Search className="h-3 w-3" />
                Search on Scholar
              </a>
            )}
            {reference.match_status === "unmatched" && onCheckAvailability && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCheckAvailability();
                }}
                disabled={checkingAvailability}
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
              >
                {checkingAvailability ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
                {checkingAvailability ? "Checking..." : "Check availability"}
              </button>
            )}
            {reference.doi && (
              <a
                href={`https://doi.org/${encodeURIComponent(reference.doi)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                DOI
              </a>
            )}
            {reference.match_status === "unmatched" && onResolveByDoi && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDoiInput(!showDoiInput);
                  setResolveError(null);
                }}
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <Link2 className="h-3 w-3" />
                Resolve by DOI
              </button>
            )}
          </div>
          {reference.match_status === "unmatched" && discoveryResult && (
            <div className="mt-1 text-[11px]">
              {discoveryResult.discovery_status === "available" && (
                <span className="text-green-700 dark:text-green-400">
                  Available on: {availableOnText || "indexed sources"}
                  {discoveryResult.best_url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={discoveryResult.best_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        open best match
                      </a>
                    </>
                  ) : null}
                </span>
              )}
              {discoveryResult.discovery_status === "unavailable" && (
                <span className="text-muted-foreground">
                  Unavailable on indexed sources.
                </span>
              )}
              {discoveryResult.discovery_status === "error" && (
                <span className="text-amber-600 dark:text-amber-400">
                  {discoveryResult.reason || "Discovery failed. Please retry."}
                </span>
              )}
              {discoveryResult.discovery_status === "skipped" && (
                <span className="text-muted-foreground">
                  {discoveryResult.reason || "Skipped."}
                </span>
              )}
            </div>
          )}
          {showDoiInput && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Paste DOI (e.g., 10.1234/...)"
                  value={doiInput}
                  onChange={(e) => setDoiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResolveDoi()}
                  className="h-7 text-xs flex-1"
                  disabled={resolvingDoi}
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleResolveDoi();
                  }}
                  disabled={!doiInput.trim() || resolvingDoi}
                >
                  {resolvingDoi && <Loader2 className="h-3 w-3 animate-spin" />}
                  Resolve
                </Button>
              </div>
              {resolveError && (
                <p className="text-[11px] text-destructive">{resolveError}</p>
              )}
            </div>
          )}
        </div>

        {reference.bibtex && (
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label="Toggle BibTeX preview"
            className="shrink-0 p-1 rounded hover:bg-muted"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
      </div>

      {expanded && reference.bibtex && (
        <div className="ml-9">
          <BibtexPreview bibtex={reference.bibtex} />
        </div>
      )}
    </div>
  );
}
