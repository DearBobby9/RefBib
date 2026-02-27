"use client";

import { useCallback, useEffect, useState } from "react";
import { PdfUploadZone } from "@/components/pdf-upload-zone";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ReferenceList } from "@/components/reference-list";
import { useExtractReferences } from "@/hooks/use-extract-references";
import { useWorkspace } from "@/hooks/use-workspace";
import { PasswordGate } from "@/components/password-gate";
import {
  checkDiscovery,
  checkGrobidHealth,
  fetchGrobidInstances,
} from "@/lib/api-client";
import { DiscoveryResult, GrobidInstance, Reference } from "@/lib/types";
import {
  AlertCircle,
  AlertTriangle,
  CircleCheck,
  Loader2,
  Server,
  Wand2,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { InstanceNotice } from "@/components/instance-notice";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_GROBID_INSTANCE_ID,
  GROBID_INSTANCE_STORAGE_KEY,
} from "@/lib/constants";

const INSTANCE_CHECK_TIMEOUT_MS = 65_000;

interface CurrentPaper {
  id: string;
  label: string;
}

function buildPaperId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export default function Home() {
  const { stage, data, error, extract, reset } = useExtractReferences();
  const {
    stats: workspaceStats,
    addReferences,
    getCachedDiscovery,
    cacheDiscoveryResult,
  } = useWorkspace();
  // "use client" ensures this component renders only on the client (no SSR),
  // so reading localStorage in useState initializer is safe — no hydration mismatch.
  const [grobidInstanceId, setGrobidInstanceId] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_GROBID_INSTANCE_ID;
    try {
      return (
        window.localStorage.getItem(GROBID_INSTANCE_STORAGE_KEY) ||
        DEFAULT_GROBID_INSTANCE_ID
      );
    } catch {
      return DEFAULT_GROBID_INSTANCE_ID;
    }
  });
  const [instances, setInstances] = useState<GrobidInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(true);
  const [instancesError, setInstancesError] = useState<string | null>(null);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const [checkingInstanceId, setCheckingInstanceId] = useState<string | null>(null);
  const [currentPaper, setCurrentPaper] = useState<CurrentPaper | null>(null);
  const [instanceActionMessage, setInstanceActionMessage] = useState<{
    type: "success" | "warning";
    text: string;
  } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        GROBID_INSTANCE_STORAGE_KEY,
        grobidInstanceId
      );
    } catch {
      // Ignore storage errors.
    }
  }, [grobidInstanceId]);

  const loadInstances = useCallback(async (): Promise<GrobidInstance[]> => {
    const data = await fetchGrobidInstances();
    return data.instances;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setInstancesLoading(true);
      try {
        const loaded = await loadInstances();
        if (cancelled) return;
        setInstances(loaded);
        setInstancesError(null);
      } catch (err) {
        if (cancelled) return;
        setInstancesError(
          err instanceof Error ? err.message : "Failed to load GROBID instances"
        );
      } finally {
        if (!cancelled) setInstancesLoading(false);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [loadInstances]);

  const handleUpload = useCallback(
    (file: File) => {
      setCurrentPaper({
        id: buildPaperId(file),
        label: file.name,
      });
      return extract(file, grobidInstanceId);
    },
    [extract, grobidInstanceId]
  );
  const handleReset = useCallback(() => {
    setCurrentPaper(null);
    reset();
  }, [reset]);
  const handleAddToWorkspace = useCallback(
    (references: Reference[]) => {
      if (!currentPaper) {
        return { added: 0, merged: 0, conflicts: 0 };
      }
      return addReferences({
        paperId: currentPaper.id,
        paperLabel: currentPaper.label,
        references,
      });
    },
    [addReferences, currentPaper]
  );
  const handleCheckAvailability = useCallback(
    async (reference: Reference): Promise<DiscoveryResult> => {
      const cached = getCachedDiscovery(reference);
      if (cached) return cached;

      const response = await checkDiscovery([reference], 1);
      const [result] = response.results;
      if (!result) {
        throw new Error("Discovery check returned no result.");
      }
      cacheDiscoveryResult(reference, result);
      return result;
    },
    [cacheDiscoveryResult, getCachedDiscovery]
  );
  const selectedInstanceName =
    instances.find((instance) => instance.id === grobidInstanceId)?.name ||
    grobidInstanceId;
  const checkingInstanceName =
    checkingInstanceId
      ? instances.find((instance) => instance.id === checkingInstanceId)?.name ||
        checkingInstanceId
      : null;

  const autoSelectAvailableInstance = useCallback(async () => {
    setInstanceActionMessage(null);
    let candidateInstances = instances;
    if (candidateInstances.length === 0) {
      if (instancesLoading) {
        setInstanceActionMessage({
          type: "warning",
          text: "Instance list is still loading. Please wait a moment and retry.",
        });
        return;
      }

      setInstancesLoading(true);
      try {
        candidateInstances = await loadInstances();
        setInstances(candidateInstances);
        setInstancesError(null);
      } catch (err) {
        setInstancesError(
          err instanceof Error ? err.message : "Failed to load GROBID instances"
        );
        setInstanceActionMessage({
          type: "warning",
          text:
            "Failed to load instance list. Please retry or open Settings. Recommended fallback: run Local Docker (`docker run --rm -p 8070:8070 grobid/grobid:0.8.2-crf`).",
        });
        return;
      } finally {
        setInstancesLoading(false);
      }
    }

    if (candidateInstances.length === 0) {
      setInstanceActionMessage({
        type: "warning",
        text:
          "No instance available. Recommended: run Local Docker (`docker run --rm -p 8070:8070 grobid/grobid:0.8.2-crf`) and select Local Docker in Settings.",
      });
      return;
    }

    setAutoSelecting(true);
    try {
      for (const instance of candidateInstances) {
        setCheckingInstanceId(instance.id);
        try {
          const result = await checkGrobidHealth(
            instance.id,
            AbortSignal.timeout(INSTANCE_CHECK_TIMEOUT_MS)
          );
          if (result.reachable) {
            setGrobidInstanceId(instance.id);
            setInstanceActionMessage({
              type: "success",
              text: `Selected available instance: ${instance.name}.`,
            });
            return;
          }
        } catch {
          // Try next instance.
        }
      }

      setInstanceActionMessage({
        type: "warning",
        text:
          "No instance available. Recommended: run Local Docker (`docker run --rm -p 8070:8070 grobid/grobid:0.8.2-crf`) and select Local Docker in Settings.",
      });
    } finally {
      setCheckingInstanceId(null);
      setAutoSelecting(false);
    }
  }, [instances, instancesLoading, loadInstances]);

  return (
    <PasswordGate>
    <main className="min-h-screen flex flex-col">
      <AppHeader
        selectedInstanceId={grobidInstanceId}
        onSelectInstanceId={setGrobidInstanceId}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8 flex-1">
        {/* Upload zone — show when idle or error */}
        {(stage === "idle" || stage === "error") && (
          <div className="space-y-4">
            <InstanceNotice />
            <PdfUploadZone onUpload={handleUpload} disabled={false} />
            <div className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    GROBID instance helper
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current:{" "}
                    <span className="font-medium text-foreground">
                      {selectedInstanceName}
                    </span>
                    {checkingInstanceName
                      ? ` · Checking ${checkingInstanceName}...`
                      : instancesLoading
                      ? " · Loading instance list..."
                      : ""}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={autoSelectAvailableInstance}
                  disabled={autoSelecting || instancesLoading}
                  className="min-h-11 w-full sm:w-auto"
                >
                  {autoSelecting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-1.5" />
                  )}
                  Auto select available
                </Button>
              </div>
              {instancesError ? (
                <p className="mt-2 text-xs text-destructive">{instancesError}</p>
              ) : null}
              {instanceActionMessage ? (
                <div
                  className={`mt-2 flex items-start gap-2 rounded-md border px-3 py-2 ${
                    instanceActionMessage.type === "success"
                      ? "border-green-600/40 bg-green-600/5"
                      : "border-amber-500/40 bg-amber-500/5"
                  }`}
                >
                  {instanceActionMessage.type === "success" ? (
                    <CircleCheck className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <p
                    className={`text-xs ${
                      instanceActionMessage.type === "success"
                        ? "text-green-700 dark:text-green-400"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {instanceActionMessage.text}
                  </p>
                </div>
              ) : null}
            </div>
            {stage === "error" && error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    Extraction failed
                  </p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="mt-2"
                  >
                    Try again
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress indicator — show during processing */}
        {(stage === "uploading" ||
          stage === "parsing" ||
          stage === "resolving") && <ProgressIndicator stage={stage} />}

        {/* Results — show when done */}
        {stage === "done" && data && (
          <ReferenceList
            data={data}
            onReset={handleReset}
            workspaceStats={workspaceStats}
            onAddToWorkspace={handleAddToWorkspace}
            getCachedDiscovery={getCachedDiscovery}
            onCheckAvailability={handleCheckAvailability}
          />
        )}
      </div>

      <SiteFooter />
    </main>
    </PasswordGate>
  );
}
