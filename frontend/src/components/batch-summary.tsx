"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchFileResult, BatchSummary as BatchSummaryType } from "@/lib/types";

interface BatchSummaryProps {
  summary: BatchSummaryType;
  fileResults: BatchFileResult[];
  cancelled: boolean;
  onUploadMore: () => void;
}

export function BatchSummary({
  summary,
  fileResults,
  cancelled,
  onUploadMore,
}: BatchSummaryProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">
          {cancelled ? "Batch cancelled" : "Batch complete"}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {summary.processedPapers} of {summary.totalPapers} papers processed
          {summary.failedPapers > 0 &&
            `, ${summary.failedPapers} failed`}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Papers" value={summary.processedPapers} />
        <StatCard label="Total refs" value={summary.totalRefs} />
        <StatCard label="Matched" value={summary.matchedRefs} />
        <StatCard
          label="Added to workspace"
          value={summary.addedToWorkspace}
        />
      </div>
      {(summary.mergedInWorkspace > 0 ||
        summary.conflictsInWorkspace > 0) && (
        <p className="text-xs text-muted-foreground">
          {summary.mergedInWorkspace > 0 &&
            `${summary.mergedInWorkspace} merged (duplicates)`}
          {summary.mergedInWorkspace > 0 &&
            summary.conflictsInWorkspace > 0 &&
            " · "}
          {summary.conflictsInWorkspace > 0 &&
            `${summary.conflictsInWorkspace} conflicts to review`}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Only matched and fuzzy references were auto-added to workspace.
        Unmatched references can be resolved individually from the single-file
        view.
      </p>

      {/* Per-file results */}
      <div className="space-y-1.5">
        {fileResults.map((result) => (
          <div
            key={result.paperId}
            className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
          >
            {result.status === "done" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : result.status === "error" ? (
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="truncate flex-1">{result.file.name}</span>
            {result.status === "done" && result.data && (
              <span className="text-xs text-muted-foreground shrink-0">
                {result.data.total_count} refs (
                {result.data.matched_count + result.data.fuzzy_count} matched)
              </span>
            )}
            {result.status === "error" && (
              <span className="text-xs text-destructive shrink-0 max-w-[200px] truncate">
                {result.error}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {summary.addedToWorkspace > 0 && (
          <Button onClick={() => router.push("/workspace")} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Go to Workspace
          </Button>
        )}
        <Button variant="outline" onClick={onUploadMore}>
          Upload More
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
