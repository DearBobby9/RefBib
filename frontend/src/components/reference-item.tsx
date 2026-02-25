"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BibtexPreview } from "./bibtex-preview";
import { Reference, MatchStatus } from "@/lib/types";

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

interface ReferenceItemProps {
  reference: Reference;
  selected: boolean;
  onToggle: (index: number) => void;
}

export function ReferenceItem({
  reference,
  selected,
  onToggle,
}: ReferenceItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { label, variant } = STATUS_STYLES[reference.match_status];

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
              {reference.title || reference.raw_citation || "Untitled reference"}
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
          </div>
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
