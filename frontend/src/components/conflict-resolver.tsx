"use client";

import { GitMerge, Split, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { titleSimilarity } from "@/lib/text-utils";
import { ConflictResolution, WorkspaceEntry } from "@/lib/types";

interface ConflictResolverProps {
  conflictEntries: WorkspaceEntry[];
  allEntries: WorkspaceEntry[];
  onResolve: (entryId: string, resolution: ConflictResolution) => void;
}

function matchBadgeVariant(status: string) {
  if (status === "matched") return "default" as const;
  if (status === "fuzzy") return "secondary" as const;
  return "outline" as const;
}

function ConflictPairCard({
  entry,
  counterpart,
  onResolve,
}: {
  entry: WorkspaceEntry;
  counterpart: WorkspaceEntry | undefined;
  onResolve: (entryId: string, resolution: ConflictResolution) => void;
}) {
  const similarity = counterpart
    ? titleSimilarity(entry.reference.title, counterpart.reference.title)
    : 0;

  return (
    <div className="rounded-lg border border-amber-300/70 dark:border-amber-500/40 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <EntryCard entry={entry} label="Entry A" />
        {counterpart ? (
          <EntryCard entry={counterpart} label="Entry B" />
        ) : (
          <div className="p-3 flex items-center justify-center text-xs text-muted-foreground">
            Counterpart not found
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-t flex-wrap">
        <span className="text-xs text-muted-foreground">
          Similarity: {(similarity * 100).toFixed(0)}%
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => onResolve(entry.id, "merge")}
          >
            <GitMerge className="h-3.5 w-3.5" />
            Merge
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => onResolve(entry.id, "keep_both")}
          >
            <Split className="h-3.5 w-3.5" />
            Keep Both
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry, label }: { entry: WorkspaceEntry; label: string }) {
  const ref = entry.reference;
  return (
    <div className="p-3 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </span>
        <Badge variant={matchBadgeVariant(ref.match_status)} className="text-[10px] h-4">
          {ref.match_status}
        </Badge>
      </div>
      <p className="text-sm font-medium leading-snug">
        {ref.title || "Untitled reference"}
      </p>
      {ref.authors.length > 0 && (
        <p className="text-xs text-muted-foreground truncate">
          {ref.authors.join(", ")}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        {ref.year && <span>{ref.year}</span>}
        {ref.venue && <span className="truncate max-w-[160px]">{ref.venue}</span>}
        {ref.doi && (
          <span className="font-mono text-[10px] truncate max-w-[160px]">
            {ref.doi}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Sources: {entry.source_refs.map((s) => s.paper_label).join(", ")}
      </p>
    </div>
  );
}

export function ConflictResolver({
  conflictEntries,
  allEntries,
  onResolve,
}: ConflictResolverProps) {
  if (conflictEntries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No conflict entries.</p>
    );
  }

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Conflict Queue
        </h3>
        <Badge variant="destructive" className="text-[10px] h-4 ml-1">
          {conflictEntries.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3">
        {conflictEntries.map((entry) => {
          const counterpart = entry.conflict_with
            ? allEntries.find((e) => e.id === entry.conflict_with)
            : undefined;
          return (
            <ConflictPairCard
              key={entry.id}
              entry={entry}
              counterpart={counterpart}
              onResolve={onResolve}
            />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
