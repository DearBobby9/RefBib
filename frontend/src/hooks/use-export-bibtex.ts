"use client";

import { useCallback } from "react";
import { Reference } from "@/lib/types";

export function useExportBibtex() {
  const buildBibtexString = useCallback((refs: Reference[]): string => {
    const content = refs
      .filter((r) => r.bibtex)
      .map((r) => r.bibtex!)
      .join("\n\n");
    return content ? `${content}\n` : "";
  }, []);

  const downloadBib = useCallback(
    (refs: Reference[], filename = "references.bib") => {
      const content = buildBibtexString(refs);
      if (!content) return;

      const blob = new Blob([content], { type: "application/x-bibtex" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [buildBibtexString]
  );

  const copyToClipboard = useCallback(
    async (refs: Reference[]): Promise<boolean> => {
      const content = buildBibtexString(refs);
      if (!content) return false;

      try {
        await navigator.clipboard.writeText(content);
        return true;
      } catch {
        return false;
      }
    },
    [buildBibtexString]
  );

  return { downloadBib, copyToClipboard, buildBibtexString };
}
