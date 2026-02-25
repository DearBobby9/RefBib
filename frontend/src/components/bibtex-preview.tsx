"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BibtexPreviewProps {
  bibtex: string;
}

export function BibtexPreview({ bibtex }: BibtexPreviewProps) {
  const [copied, setCopied] = useState(false);

  const copyEntry = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(bibtex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [bibtex]);

  return (
    <div className="relative mt-2 rounded-md bg-muted/50 p-3">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7"
        onClick={copyEntry}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap pr-8">
        {bibtex}
      </pre>
    </div>
  );
}
