"use client";

import { useCallback, useEffect, useState } from "react";
import { PdfUploadZone } from "@/components/pdf-upload-zone";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ReferenceList } from "@/components/reference-list";
import { SettingsDialog } from "@/components/settings-dialog";
import { useExtractReferences } from "@/hooks/use-extract-references";
import { PasswordGate } from "@/components/password-gate";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertCircle, BookOpen, Github, Mail, Bug, Star } from "lucide-react";
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
          </div>
        </div>
      </footer>
    </main>
    </PasswordGate>
  );
}
