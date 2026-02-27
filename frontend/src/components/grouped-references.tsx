"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GroupByMode, WorkspaceEntry } from "@/lib/types";

interface GroupedReferencesProps {
  entries: WorkspaceEntry[];
  groupBy: GroupByMode;
  renderEntry: (entry: WorkspaceEntry) => React.ReactNode;
}

interface Group {
  label: string;
  entries: WorkspaceEntry[];
}

function groupEntries(
  entries: WorkspaceEntry[],
  mode: GroupByMode
): Group[] {
  if (mode === "none") {
    return [{ label: "", entries }];
  }

  const map = new Map<string, WorkspaceEntry[]>();

  for (const entry of entries) {
    let key: string;
    if (mode === "year") {
      key = entry.reference.year ? String(entry.reference.year) : "Unknown Year";
    } else {
      key = entry.reference.venue || "Unknown Venue";
    }
    const group = map.get(key) ?? [];
    group.push(entry);
    map.set(key, group);
  }

  const groups = Array.from(map.entries()).map(([label, items]) => ({
    label,
    entries: items,
  }));

  if (mode === "year") {
    groups.sort((a, b) => {
      const yearA = parseInt(a.label) || 0;
      const yearB = parseInt(b.label) || 0;
      return yearB - yearA;
    });
  } else {
    groups.sort((a, b) => b.entries.length - a.entries.length);
  }

  return groups;
}

export function GroupedReferences({
  entries,
  groupBy,
  renderEntry,
}: GroupedReferencesProps) {
  const groups = useMemo(
    () => groupEntries(entries, groupBy),
    [entries, groupBy]
  );

  if (groupBy === "none") {
    return (
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id}>{renderEntry(entry)}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <Collapsible key={group.label} defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
            <span className="text-sm font-medium">{group.label}</span>
            <Badge variant="secondary" className="text-[10px] h-4 ml-1">
              {group.entries.length}
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 ml-6 space-y-2 border-l-2 border-border pl-3">
            {group.entries.map((entry) => (
              <div key={entry.id}>{renderEntry(entry)}</div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
