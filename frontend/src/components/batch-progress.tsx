"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchFileResult } from "@/lib/types";

interface BatchProgressProps {
  fileResults: BatchFileResult[];
  currentIndex: number;
  onCancel: () => void;
}

export function BatchProgress({
  fileResults,
  currentIndex,
  onCancel,
}: BatchProgressProps) {
  const doneCount = fileResults.filter(
    (r) => r.status === "done" || r.status === "error"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">
            Processing {Math.min(doneCount + 1, fileResults.length)} of {fileResults.length} PDFs...
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Files are processed sequentially due to API rate limits. This may
            take a moment.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="space-y-1.5">
        {fileResults.map((result, i) => (
          <div
            key={result.paperId}
            className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
              i === currentIndex && result.status === "processing"
                ? "border-primary/50 bg-primary/5"
                : ""
            }`}
          >
            <StatusIcon status={result.status} />
            <span className="truncate flex-1">{result.file.name}</span>
            {result.status === "done" && result.data && (
              <span className="text-xs text-muted-foreground shrink-0">
                {result.data.matched_count + result.data.fuzzy_count}/
                {result.data.total_count} matched
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
    </div>
  );
}

function StatusIcon({ status }: { status: BatchFileResult["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
    case "processing":
      return (
        <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
      );
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}
