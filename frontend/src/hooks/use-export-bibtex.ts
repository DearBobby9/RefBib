"use client";

import { useCallback } from "react";
import { Reference, WorkspaceEntry } from "@/lib/types";

function effectiveBibtex(entry: WorkspaceEntry): string | null {
  return entry.override_bibtex ?? entry.reference.bibtex;
}

export function useExportBibtex() {
  const buildBibtexString = useCallback((refs: Reference[]): string => {
    const content = refs
      .filter((r) => r.bibtex)
      .map((r) => r.bibtex!)
      .join("\n\n");
    return content ? `${content}\n` : "";
  }, []);

  const buildWorkspaceBibtex = useCallback(
    (entries: WorkspaceEntry[]): string => {
      const content = entries
        .map(effectiveBibtex)
        .filter(Boolean)
        .join("\n\n");
      return content ? `${content}\n` : "";
    },
    []
  );

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

  const downloadWorkspaceBib = useCallback(
    (entries: WorkspaceEntry[], filename = "references.bib") => {
      const content = buildWorkspaceBibtex(entries);
      if (!content) return;

      const blob = new Blob([content], { type: "application/x-bibtex" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [buildWorkspaceBibtex]
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

  const copyWorkspaceBibtex = useCallback(
    async (entries: WorkspaceEntry[]): Promise<boolean> => {
      const content = buildWorkspaceBibtex(entries);
      if (!content) return false;

      try {
        await navigator.clipboard.writeText(content);
        return true;
      } catch {
        return false;
      }
    },
    [buildWorkspaceBibtex]
  );

  return {
    downloadBib,
    downloadWorkspaceBib,
    copyToClipboard,
    copyWorkspaceBibtex,
    buildBibtexString,
    buildWorkspaceBibtex,
  };
}
