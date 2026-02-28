"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { extractReferences } from "@/lib/api-client";
import { buildPaperId } from "@/lib/text-utils";
import {
  BatchFileResult,
  BatchStage,
  BatchSummary,
  ExtractResponse,
  Reference,
  WorkspaceAddResult,
} from "@/lib/types";

interface AddReferencesInput {
  paperId: string;
  paperLabel: string;
  references: Reference[];
}

export function useBatchExtract() {
  const [batchStage, setBatchStage] = useState<BatchStage>("idle");
  const [fileResults, setFileResults] = useState<BatchFileResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const startBatch = useCallback(
    async (
      files: File[],
      grobidInstanceId: string | undefined,
      addToWorkspace: (input: AddReferencesInput) => WorkspaceAddResult
    ) => {
      cancelledRef.current = false;
      const controller = new AbortController();
      abortRef.current = controller;

      const results: BatchFileResult[] = files.map((file) => ({
        file,
        paperId: buildPaperId(file),
        status: "pending" as const,
        data: null,
        error: null,
        workspaceResult: null,
      }));
      setFileResults([...results]);
      setBatchStage("processing");
      setCurrentIndex(0);

      for (let i = 0; i < files.length; i++) {
        if (cancelledRef.current || controller.signal.aborted) {
          setBatchStage("cancelled");
          return;
        }

        setCurrentIndex(i);
        results[i] = { ...results[i], status: "processing" };
        setFileResults([...results]);

        try {
          const data: ExtractResponse = await extractReferences(files[i], {
            signal: controller.signal,
            grobidInstanceId,
          });

          // Auto-add matched + fuzzy references to workspace
          const refsWithBibtex = data.references.filter(
            (r) => r.bibtex && r.match_status !== "unmatched"
          );
          let workspaceResult: WorkspaceAddResult | null = null;
          if (refsWithBibtex.length > 0) {
            workspaceResult = addToWorkspace({
              paperId: results[i].paperId,
              paperLabel: files[i].name,
              references: refsWithBibtex,
            });
          }

          results[i] = {
            ...results[i],
            status: "done",
            data,
            workspaceResult,
          };
        } catch (err) {
          if (controller.signal.aborted) return;
          results[i] = {
            ...results[i],
            status: "error",
            error:
              err instanceof Error ? err.message : "Extraction failed",
          };
        }

        setFileResults([...results]);
      }

      setBatchStage("done");
    },
    []
  );

  const cancelBatch = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setBatchStage("cancelled");
  }, []);

  const resetBatch = useCallback(() => {
    cancelledRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    setFileResults([]);
    setBatchStage("idle");
    setCurrentIndex(0);
  }, []);

  const summary: BatchSummary = useMemo(() => {
    let totalRefs = 0;
    let matchedRefs = 0;
    let addedToWorkspace = 0;
    let mergedInWorkspace = 0;
    let conflictsInWorkspace = 0;
    let processedPapers = 0;
    let failedPapers = 0;

    for (const result of fileResults) {
      if (result.status === "done" && result.data) {
        processedPapers += 1;
        totalRefs += result.data.total_count;
        matchedRefs += result.data.matched_count + result.data.fuzzy_count;
      } else if (result.status === "error") {
        failedPapers += 1;
      }
      if (result.workspaceResult) {
        addedToWorkspace += result.workspaceResult.added;
        mergedInWorkspace += result.workspaceResult.merged;
        conflictsInWorkspace += result.workspaceResult.conflicts;
      }
    }

    return {
      totalPapers: fileResults.length,
      processedPapers,
      failedPapers,
      totalRefs,
      matchedRefs,
      addedToWorkspace,
      mergedInWorkspace,
      conflictsInWorkspace,
    };
  }, [fileResults]);

  return {
    batchStage,
    fileResults,
    currentIndex,
    summary,
    startBatch,
    cancelBatch,
    resetBatch,
  };
}
