"use client";

import { useCallback, useRef, useState } from "react";
import { extractReferences } from "@/lib/api-client";
import { ExtractResponse } from "@/lib/types";

export type ExtractionStage =
  | "idle"
  | "uploading"
  | "parsing"
  | "resolving"
  | "done"
  | "error";

interface ExtractionState {
  stage: ExtractionStage;
  data: ExtractResponse | null;
  error: string | null;
}

export function useExtractReferences() {
  const [state, setState] = useState<ExtractionState>({
    stage: "idle",
    data: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const extract = useCallback(async (file: File, grobidInstanceId?: string) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ stage: "uploading", data: null, error: null });

    // Stage transitions are time-based estimates, not real backend events.
    // The backend processes everything in a single request; these timers
    // provide perceived progress while waiting for the response.
    const parsingTimer = setTimeout(() => {
      setState((s) =>
        requestIdRef.current === requestId && s.stage === "uploading"
          ? { ...s, stage: "parsing" }
          : s
      );
    }, 800);

    const resolvingTimer = setTimeout(() => {
      setState((s) =>
        requestIdRef.current === requestId && s.stage === "parsing"
          ? { ...s, stage: "resolving" }
          : s
      );
    }, 3000);

    try {
      const data = await extractReferences(file, {
        signal: controller.signal,
        grobidInstanceId,
      });
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return;

      setState({ stage: "done", data, error: null });
    } catch (err) {
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return;
      const isAbortError = err instanceof Error && err.name === "AbortError";
      if (isAbortError) return;

      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setState({ stage: "error", data: null, error: message });
    } finally {
      clearTimeout(parsingTimer);
      clearTimeout(resolvingTimer);
    }
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ stage: "idle", data: null, error: null });
  }, []);

  return { ...state, extract, reset };
}
