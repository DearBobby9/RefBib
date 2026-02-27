"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Download, FolderOpen, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useExportBibtex } from "@/hooks/use-export-bibtex";
import { useWorkspace } from "@/hooks/use-workspace";

function dedupBadgeVariant(status: "unique" | "merged" | "conflict") {
  if (status === "conflict") return "destructive";
  if (status === "merged") return "secondary";
  return "default";
}

export default function WorkspacePage() {
  const {
    activeWorkspace,
    entries,
    stats,
    clearWorkspace,
    getAllReferences,
    getUniqueReferences,
  } = useWorkspace();
  const { downloadBib } = useExportBibtex();

  const uniqueReferences = useMemo(() => getUniqueReferences(), [getUniqueReferences]);
  const allReferences = useMemo(() => getAllReferences(), [getAllReferences]);
  const conflictEntries = useMemo(
    () => entries.filter((entry) => entry.dedup_status === "conflict"),
    [entries]
  );

  const groupedByPaper = useMemo(() => {
    const map = new Map<
      string,
      { label: string; refs: number; uniqueIds: Set<string>; titles: Set<string> }
    >();

    for (const entry of entries) {
      for (const source of entry.source_refs) {
        const record = map.get(source.paper_id) || {
          label: source.paper_label,
          refs: 0,
          uniqueIds: new Set<string>(),
          titles: new Set<string>(),
        };
        record.refs += 1;
        record.uniqueIds.add(entry.id);
        record.titles.add(entry.reference.title || "Untitled reference");
        map.set(source.paper_id, record);
      }
    }

    return Array.from(map.entries()).map(([paperId, record]) => ({
      paperId,
      label: record.label,
      refs: record.refs,
      unique: record.uniqueIds.size,
      titles: Array.from(record.titles),
    }));
  }, [entries]);

  return (
    <main className="min-h-screen flex flex-col">
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8 flex-1 space-y-6">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {activeWorkspace?.name || "Workspace"}
          </h2>
          <p className="text-sm text-muted-foreground">
            No account required. Saved locally on this browser.
          </p>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Papers</p>
            <p className="text-xl font-semibold">{stats.papers}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Refs</p>
            <p className="text-xl font-semibold">{stats.refs}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Unique</p>
            <p className="text-xl font-semibold">{stats.unique}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Conflicts</p>
            <p className="text-xl font-semibold">{stats.conflicts}</p>
          </div>
        </section>

        <section className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">Workspace actions</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadBib(uniqueReferences)}
                disabled={uniqueReferences.length === 0}
                className="gap-1.5 min-h-11"
              >
                <Download className="h-4 w-4" />
                Export Unique .bib
              </Button>
              <Button
                size="sm"
                onClick={() => downloadBib(allReferences)}
                disabled={allReferences.length === 0}
                className="gap-1.5 min-h-11"
              >
                <Download className="h-4 w-4" />
                Export All (with duplicates)
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm("Clear all references in current workspace?")) {
                    clearWorkspace();
                  }
                }}
                disabled={entries.length === 0}
                className="gap-1.5 min-h-11"
              >
                <Trash2 className="h-4 w-4" />
                Clear Workspace
              </Button>
            </div>
          </div>
        </section>

        {entries.length === 0 ? (
          <section className="rounded-lg border border-dashed p-8 text-center space-y-3">
            <div className="mx-auto w-fit rounded-full bg-muted p-3">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Workspace is empty. Add references from the extract page.
            </p>
            <Button asChild>
              <Link href="/">Go to Extract</Link>
            </Button>
          </section>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Unique References
              </h3>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <article key={entry.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {entry.reference.title || "Untitled reference"}
                      </p>
                      <Badge variant={dedupBadgeVariant(entry.dedup_status)}>
                        {entry.dedup_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Occurrences: {entry.occurrence_count} · Sources:{" "}
                      {entry.source_refs.length}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Source Papers
              </h3>
              <div className="space-y-2">
                {groupedByPaper.map((paper) => (
                  <details key={paper.paperId} className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      {paper.label}
                    </summary>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Refs: {paper.refs} · Unique in workspace: {paper.unique}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {paper.titles.map((title, idx) => (
                        <li key={`${paper.paperId}-${idx}`} className="text-xs text-muted-foreground">
                          {title}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Conflict Queue
              </h3>
              {conflictEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No conflict entries.
                </p>
              ) : (
                <div className="space-y-2">
                  {conflictEntries.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-lg border border-amber-300/70 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/20 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm font-medium">
                          {entry.reference.title || "Untitled reference"}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        Similar title detected. Review before merging manually.
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
