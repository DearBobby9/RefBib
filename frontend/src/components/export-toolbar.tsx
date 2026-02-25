"use client";

import { useState } from "react";
import { Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExportBibtex } from "@/hooks/use-export-bibtex";
import { Reference } from "@/lib/types";

interface ExportToolbarProps {
  selectedRefs: Reference[];
}

export function ExportToolbar({ selectedRefs }: ExportToolbarProps) {
  const { downloadBib, copyToClipboard } = useExportBibtex();
  const [copied, setCopied] = useState(false);

  const count = selectedRefs.filter((r) => r.bibtex).length;

  const handleCopy = async () => {
    const ok = await copyToClipboard(selectedRefs);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? "entry" : "entries"} ready to export
        </p>
        <div className="flex items-center gap-2">
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
