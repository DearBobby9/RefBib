"use client";

import { useCallback, useMemo, useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { ReferenceItem } from "./reference-item";
import { FilterBar, Filters } from "./filter-bar";
import { ExportToolbar } from "./export-toolbar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExtractResponse, MatchStatus } from "@/lib/types";

interface ReferenceListProps {
  data: ExtractResponse;
  onReset: () => void;
}

export function ReferenceList({ data, onReset }: ReferenceListProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(data.references.map((r) => r.index))
  );
  const [filters, setFilters] = useState<Filters>({
    search: "",
    statuses: new Set<MatchStatus>(["matched", "fuzzy", "unmatched"]),
  });

  const filteredRefs = useMemo(() => {
    return data.references.filter((ref) => {
      if (!filters.statuses.has(ref.match_status)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = [
          ref.title,
          ref.raw_citation,
          ...ref.authors,
          ref.venue,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [data.references, filters]);

  const selectedRefs = useMemo(
    () => data.references.filter((r) => selected.has(r.index)),
    [data.references, selected]
  );
  const filteredIndexSet = useMemo(
    () => new Set(filteredRefs.map((r) => r.index)),
    [filteredRefs]
  );
  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    for (const index of selected) {
      if (filteredIndexSet.has(index)) count += 1;
    }
    return count;
  }, [filteredIndexSet, selected]);

  const toggleRef = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const ref of filteredRefs) {
        next.add(ref.index);
      }
      return next;
    });
  }, [filteredRefs]);

  const deselectAll = useCallback(() => {
    setSelected((prev) => {
      if (filteredRefs.length === 0) return prev;
      const next = new Set(prev);
      for (const ref of filteredRefs) {
        next.delete(ref.index);
      }
      return next;
    });
  }, [filteredRefs]);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {data.total_count} references
          </span>{" "}
          found in {data.processing_time_seconds.toFixed(1)}s
          <span className="ml-2">
            ({data.matched_count} matched, {data.fuzzy_count} fuzzy,{" "}
            {data.unmatched_count} unmatched)
          </span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-primary hover:underline"
        >
          Upload another PDF
        </button>
      </div>

      {/* Status legend */}
      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <Info className="h-3.5 w-3.5" />
          <span>What do matched / fuzzy / unmatched mean?</span>
          <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-lg border bg-muted/30 px-4 py-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-foreground shrink-0" />
              <p>
                <strong className="text-foreground">Matched</strong> &mdash;
                Verified BibTeX from CrossRef, Semantic Scholar, or DBLP with
                high confidence (DOI or exact title match). Ready to use.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-yellow-500 shrink-0" />
              <p>
                <strong className="text-foreground">Fuzzy</strong> &mdash;
                Found a likely match, but title similarity is below 90%.
                Review before using &mdash; the BibTeX may belong to a different paper.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-destructive shrink-0" />
              <p>
                <strong className="text-foreground">Unmatched</strong> &mdash;
                No match found in any database. BibTeX was constructed from
                GROBID&apos;s raw parse. Fields may be incomplete or need manual correction.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <FilterBar
        references={data.references}
        filters={filters}
        onFiltersChange={setFilters}
        selectedCount={selectedVisibleCount}
        totalCount={filteredRefs.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
      />

      {/* Reference items */}
      <div className="space-y-2">
        {filteredRefs.map((ref) => (
          <ReferenceItem
            key={ref.index}
            reference={ref}
            selected={selected.has(ref.index)}
            onToggle={toggleRef}
          />
        ))}
        {filteredRefs.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No references match your filters.
          </p>
        )}
      </div>

      {/* Sticky export toolbar */}
      <ExportToolbar selectedRefs={selectedRefs} />
    </div>
  );
}
