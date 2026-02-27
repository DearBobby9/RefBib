"use client";

import { useCallback, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WorkspaceEntry } from "@/lib/types";

interface BibtexEditorProps {
  entry: WorkspaceEntry;
  onSave: (entryId: string, bibtex: string | null) => void;
}

export function BibtexEditor({ entry, onSave }: BibtexEditorProps) {
  const original = entry.reference.bibtex || "";
  const current = entry.override_bibtex ?? original;
  const [draft, setDraft] = useState(current);
  const [open, setOpen] = useState(false);
  const hasOverride = entry.override_bibtex != null;

  const handleOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraft(entry.override_bibtex ?? original);
      }
      setOpen(nextOpen);
    },
    [entry.override_bibtex, original]
  );

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === original.trim()) {
      onSave(entry.id, null);
    } else {
      onSave(entry.id, trimmed);
    }
    setOpen(false);
  }, [draft, original, entry.id, onSave]);

  const handleReset = useCallback(() => {
    setDraft(original);
  }, [original]);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-7 text-xs"
          aria-label="Edit BibTeX"
        >
          <Pencil className="h-3 w-3" />
          {hasOverride ? "Edited" : "Edit"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit BibTeX</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground truncate">
          {entry.reference.title || "Untitled reference"}
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full h-56 rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          spellCheck={false}
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={draft === original}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Original
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="text-xs">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
