"use client";

import { useCallback, useEffect, useState } from "react";
import { PdfUploadZone } from "@/components/pdf-upload-zone";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ReferenceList } from "@/components/reference-list";
import { SettingsDialog } from "@/components/settings-dialog";
import { useExtractReferences } from "@/hooks/use-extract-references";
import { AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_GROBID_INSTANCE_ID = "hf-dl";
const GROBID_INSTANCE_STORAGE_KEY = "refbib:grobid-instance-id";

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

  const handleUpload = useCallback(
    (file: File) => extract(file, grobidInstanceId),
    [extract, grobidInstanceId]
  );

  return (
    <main className="min-h-screen">
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
          <SettingsDialog
            selectedInstanceId={grobidInstanceId}
            onSelectInstanceId={setGrobidInstanceId}
          />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8">
        {/* Upload zone — show when idle or error */}
        {(stage === "idle" || stage === "error") && (
          <div className="space-y-4">
            <PdfUploadZone onUpload={handleUpload} disabled={false} />
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
    </main>
  );
}
