"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, CheckSquare, Square } from "lucide-react";
import { Reference, MatchStatus } from "@/lib/types";

export interface Filters {
  search: string;
  statuses: Set<MatchStatus>;
}

interface FilterBarProps {
  references: Reference[];
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function FilterBar({
  references,
  filters,
  onFiltersChange,
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
}: FilterBarProps) {
  const statusCounts = useMemo(() => {
    const counts: Record<MatchStatus, number> = {
      matched: 0,
      fuzzy: 0,
      unmatched: 0,
    };
    for (const ref of references) {
      counts[ref.match_status]++;
    }
    return counts;
  }, [references]);

  const toggleStatus = (status: MatchStatus) => {
    const next = new Set(filters.statuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onFiltersChange({ ...filters, statuses: next });
  };

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search titles, authors..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-1">
          {(["matched", "fuzzy", "unmatched"] as MatchStatus[]).map(
            (status) => (
              <Button
                key={status}
                variant={filters.statuses.has(status) ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => toggleStatus(status)}
              >
                {status}
                <Badge
                  variant="secondary"
                  className="h-4 min-w-[16px] text-[10px] px-1"
                >
                  {statusCounts[status]}
                </Badge>
              </Button>
            )
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 px-2"
          onClick={allSelected ? onDeselectAll : onSelectAll}
        >
          {allSelected ? (
            <Square className="h-3 w-3" />
          ) : (
            <CheckSquare className="h-3 w-3" />
          )}
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
        <span>
          {selectedCount} of {totalCount} selected
        </span>
      </div>
    </div>
  );
}
