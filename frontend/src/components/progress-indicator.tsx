"use client";

import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { ExtractionStage } from "@/hooks/use-extract-references";

const STAGES: Record<
  Exclude<ExtractionStage, "idle" | "done" | "error">,
  { label: string; progress: number }
> = {
  uploading: { label: "Uploading PDF...", progress: 15 },
  parsing: { label: "Extracting references with GROBID...", progress: 45 },
  resolving: { label: "Looking up BibTeX entries...", progress: 75 },
};

interface ProgressIndicatorProps {
  stage: ExtractionStage;
}

export function ProgressIndicator({ stage }: ProgressIndicatorProps) {
  if (stage === "idle" || stage === "done" || stage === "error") return null;

  const { label, progress } = STAGES[stage];

  return (
    <div className="w-full space-y-3 py-8">
      <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-center text-xs text-muted-foreground">
        This may take 10-30 seconds depending on the number of references
      </p>
    </div>
  );
}
