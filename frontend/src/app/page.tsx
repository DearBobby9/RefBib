"use client";

import { useCallback, useEffect, useState } from "react";
import { PdfUploadZone } from "@/components/pdf-upload-zone";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ReferenceList } from "@/components/reference-list";
import { SettingsDialog } from "@/components/settings-dialog";
import { useExtractReferences } from "@/hooks/use-extract-references";
import { PasswordGate } from "@/components/password-gate";
import { ThemeToggle } from "@/components/theme-toggle";
import { checkGrobidHealth, fetchGrobidInstances } from "@/lib/api-client";
import { GrobidInstance } from "@/lib/types";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Bug,
  CircleCheck,
  Github,
  Loader2,
  Mail,
  Server,
  Star,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_GROBID_INSTANCE_ID = "hf-dl";
const GROBID_INSTANCE_STORAGE_KEY = "refbib:grobid-instance-id";
const INSTANCE_CHECK_TIMEOUT_MS = 65_000;

export default function Home() {
  const { stage, data, error, extract, reset } = useExtractReferences();
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
    (file: File) => extract(file, grobidInstanceId),
    [extract, grobidInstanceId]
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
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">RefBib</h1>
            <p className="text-xs text-muted-foreground">
              PDF references to BibTeX in seconds
            </p>
          </div>
          <a
            href="https://github.com/DearBobby9/RefBib"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="GitHub repository">
              <Github className="h-4 w-4" />
            </Button>
          </a>
          <ThemeToggle />
          <SettingsDialog
            selectedInstanceId={grobidInstanceId}
            onSelectInstanceId={setGrobidInstanceId}
          />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8 flex-1">
        {/* Upload zone — show when idle or error */}
        {(stage === "idle" || stage === "error") && (
          <div className="space-y-4">
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
                    onClick={reset}
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
          <ReferenceList data={data} onReset={reset} />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">RefBib</span>
              <span className="text-muted-foreground/30">&middot;</span>
              <span className="text-xs text-muted-foreground/70">
                Powered by{" "}
                <a href="https://github.com/kermitt2/grobid" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">GROBID</a>
                {" / "}
                <a href="https://www.crossref.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">CrossRef</a>
                {" / "}
                <a href="https://www.semanticscholar.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">S2</a>
                {" / "}
                <a href="https://dblp.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">DBLP</a>
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <a
                href="https://github.com/DearBobby9/RefBib"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                <Star className="h-3.5 w-3.5" />
                Star on GitHub
              </a>
              <span className="text-muted-foreground/30">|</span>
              <a
                href="https://github.com/DearBobby9/RefBib/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                <Bug className="h-3.5 w-3.5" />
                Report a bug
              </a>
              <span className="text-muted-foreground/30">|</span>
              <a
                href="mailto:bobbyjia99@gmail.com"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                <Mail className="h-3.5 w-3.5" />
                bobbyjia99@gmail.com
              </a>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center text-xs text-muted-foreground/80">
              <span>
                Designed and built by{" "}
                <span className="font-medium text-muted-foreground">Difan (Bobby) Jia</span>
              </span>
              <span className="text-muted-foreground/30">|</span>
              <a
                href="https://x.com/KeithMaxwell99"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                X @KeithMaxwell99
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
    </PasswordGate>
  );
}
