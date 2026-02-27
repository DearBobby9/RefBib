"use client";

import { useState } from "react";
import { Github, Info, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "refbib:instance-notice-dismissed";
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const expiry = parseInt(raw, 10);
    if (Date.now() < expiry) return true;
    localStorage.removeItem(DISMISS_KEY);
    return false;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    const expiry = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(expiry));
  } catch {
    // Ignore storage errors.
  }
}

export function InstanceNotice() {
  const [visible, setVisible] = useState(() => !isDismissed());

  if (!visible) return null;

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  return (
    <div className="rounded-lg border bg-muted/40 p-4 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
        aria-label="Dismiss notice"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex gap-3 pr-6">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-2.5">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Hosted by Difan (Bobby) Jia
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This is a personal instance with rate-limited academic APIs.
              The server may occasionally be offline.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80 font-mono">
            <span>CrossRef 10 req/s</span>
            <span className="text-muted-foreground/30">·</span>
            <span>Semantic Scholar 1 req/s</span>
            <span className="text-muted-foreground/30">·</span>
            <span>DBLP 3 req/s</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-7 text-xs gap-1.5 cursor-pointer"
            >
              <a
                href="https://github.com/DearBobby9/RefBib"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Star className="h-3 w-3" />
                Star on GitHub
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 text-xs gap-1.5 cursor-pointer"
            >
              <a
                href="https://github.com/DearBobby9/RefBib#development-commands"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-3 w-3" />
                Self-host guide
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
