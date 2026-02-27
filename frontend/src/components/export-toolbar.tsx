"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Copy, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useExportBibtex } from "@/hooks/use-export-bibtex";
import { Reference, WorkspaceAddResult } from "@/lib/types";

interface ExportToolbarProps {
  selectedRefs: Reference[];
  onAddToWorkspace: (
    selectedRefs: Reference[]
  ) => WorkspaceAddResult | Promise<WorkspaceAddResult>;
}

export function ExportToolbar({
  selectedRefs,
  onAddToWorkspace,
}: ExportToolbarProps) {
  const router = useRouter();
  const { downloadBib, copyToClipboard } = useExportBibtex();
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [workspaceAlert, setWorkspaceAlert] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const count = selectedRefs.filter((r) => r.bibtex).length;

  const handleCopy = async () => {
    const ok = await copyToClipboard(selectedRefs);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddToWorkspace = async () => {
    if (count === 0 || adding) return;
    setAdding(true);
    try {
      const result = await onAddToWorkspace(selectedRefs);
      const summary = `${result.added} added, ${result.merged} merged.`;
      setWorkspaceAlert({ type: "success", text: summary });
      toast.success(summary, {
        description:
          result.conflicts > 0
            ? `${result.conflicts} potential conflicts flagged for review.`
            : undefined,
      });
      // Only auto-navigate when there are no conflicts to review.
      if (result.conflicts === 0) {
        router.push("/workspace");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Please try again in a moment.";
      setWorkspaceAlert({
        type: "error",
        text: "Failed to add selected references to Workspace.",
      });
      toast.error("Failed to add selected references to Workspace.", {
        description: message,
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "entry" : "entries"} ready to export
          </p>
          {workspaceAlert ? (
            <p
              role="alert"
              className={`text-xs ${
                workspaceAlert.type === "success"
                  ? "text-green-700 dark:text-green-400"
                  : "text-destructive"
              }`}
            >
              {workspaceAlert.text}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddToWorkspace}
            disabled={count === 0 || adding}
            className="gap-1.5 min-h-11"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add selected to Workspace
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={count === 0}
            className="gap-1.5"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy BibTeX"}
          </Button>
          <Button
            size="sm"
            onClick={() => downloadBib(selectedRefs)}
            disabled={count === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Download .bib
          </Button>
        </div>
      </div>
    </div>
  );
}
