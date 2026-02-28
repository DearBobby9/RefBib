"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_BATCH_FILES = 20;

interface PdfUploadZoneProps {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
}

export function PdfUploadZone({ onUpload, disabled }: PdfUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [tooManyError, setTooManyError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: File[]) => {
      const pdfs = files.filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfs.length === 0) return;
      if (pdfs.length > MAX_BATCH_FILES) {
        setTooManyError(true);
        return;
      }
      setTooManyError(false);
      setSelectedFiles(pdfs);
      onUpload(pdfs);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [disabled, handleFiles]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      handleFiles(files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const clearFiles = useCallback(() => setSelectedFiles([]), []);

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed
          p-12 transition-all cursor-pointer
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:bg-muted/50"}
          ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/25"}
        `}
      >
        <div className="rounded-full bg-muted p-4">
          <Upload className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium">
            Drop your PDFs here, or click to browse
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            One or more academic papers with reference sections (max 50MB each)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {tooManyError && (
        <p className="mt-2 text-sm text-destructive">
          Too many files. Please select up to {MAX_BATCH_FILES} PDFs at a time.
        </p>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          {selectedFiles.length === 1 ? (
            <>
              <span className="truncate">{selectedFiles[0].name}</span>
              <span className="text-xs">
                ({(selectedFiles[0].size / 1024 / 1024).toFixed(1)} MB)
              </span>
            </>
          ) : (
            <span>
              {selectedFiles.length} PDFs selected (
              {(
                selectedFiles.reduce((sum, f) => sum + f.size, 0) /
                1024 /
                1024
              ).toFixed(1)}{" "}
              MB total)
            </span>
          )}
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-auto"
              onClick={(e) => {
                e.stopPropagation();
                clearFiles();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
