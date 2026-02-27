"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Github } from "lucide-react";
import { SettingsDialog } from "@/components/settings-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_GROBID_INSTANCE_ID,
  GROBID_INSTANCE_STORAGE_KEY,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV_ANIMATION_MS = 170;
const EXTRACT_PATH = "/";
const WORKSPACE_PATH = "/workspace";

type ViewType = "extract" | "workspace";

interface NavTabsProps {
  activeView: ViewType;
  onNavigate: (target: ViewType) => void;
  className?: string;
}

function NavTabs({ activeView, onNavigate, className }: NavTabsProps) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-2 items-center rounded-md border bg-muted/20 p-1",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1 top-1 bottom-1 w-[calc(50%-0.25rem)] rounded bg-background shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
          activeView === "workspace" ? "translate-x-full" : "translate-x-0"
        )}
      />
      <button
        type="button"
        aria-current={activeView === "extract" ? "page" : undefined}
        onClick={() => onNavigate("extract")}
        className={cn(
          "relative z-10 rounded px-2.5 py-1 text-xs font-medium cursor-pointer",
          activeView === "extract"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Extract
      </button>
      <button
        type="button"
        aria-current={activeView === "workspace" ? "page" : undefined}
        onClick={() => onNavigate("workspace")}
        className={cn(
          "relative z-10 rounded px-2.5 py-1 text-xs font-medium cursor-pointer",
          activeView === "workspace"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Workspace
      </button>
    </div>
  );
}

interface AppHeaderProps {
  selectedInstanceId?: string;
  onSelectInstanceId?: (instanceId: string) => void;
}

export function AppHeader({
  selectedInstanceId,
  onSelectInstanceId,
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentView: ViewType = pathname.startsWith("/workspace")
    ? "workspace"
    : "extract";
  const [pendingView, setPendingView] = useState<ViewType | null>(null);
  const [internalInstanceId, setInternalInstanceId] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_GROBID_INSTANCE_ID;
    try {
      return (
        window.localStorage.getItem(GROBID_INSTANCE_STORAGE_KEY)
        || DEFAULT_GROBID_INSTANCE_ID
      );
    } catch {
      return DEFAULT_GROBID_INSTANCE_ID;
    }
  });

  const activeView =
    pendingView && pendingView !== currentView ? pendingView : currentView;
  const effectiveInstanceId = selectedInstanceId ?? internalInstanceId;
  const effectiveSetInstanceId = onSelectInstanceId ?? setInternalInstanceId;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Clear pendingView once the route actually changes.
  useEffect(() => {
    setPendingView(null);
  }, [pathname]);

  useEffect(() => {
    if (onSelectInstanceId) return;
    try {
      window.localStorage.setItem(GROBID_INSTANCE_STORAGE_KEY, internalInstanceId);
    } catch {
      // Ignore storage errors.
    }
  }, [internalInstanceId, onSelectInstanceId]);

  const handleNavigate = (target: ViewType) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (target === currentView) {
      setPendingView(null);
      return;
    }
    setPendingView(target);
    timerRef.current = setTimeout(() => {
      router.push(target === "extract" ? EXTRACT_PATH : WORKSPACE_PATH);
      timerRef.current = null;
    }, NAV_ANIMATION_MS);
  };

  useEffect(() => {
    router.prefetch(EXTRACT_PATH);
    router.prefetch(WORKSPACE_PATH);
  }, [router]);

  return (
    <header className="border-b">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">RefBib</h1>
          <p className="text-xs text-muted-foreground">
            PDF references to BibTeX in seconds
          </p>
        </div>
        <nav className="hidden sm:block shrink-0">
          <NavTabs
            activeView={activeView}
            onNavigate={handleNavigate}
            className="w-[190px]"
          />
        </nav>
        <div className="flex items-center justify-end gap-1.5 shrink-0 min-w-[108px]">
          <a
            href="https://github.com/DearBobby9/RefBib"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="GitHub repository"
            >
              <Github className="h-4 w-4" />
            </Button>
          </a>
          <ThemeToggle />
          <SettingsDialog
            selectedInstanceId={effectiveInstanceId}
            onSelectInstanceId={effectiveSetInstanceId}
          />
        </div>
      </div>
      <div className="sm:hidden border-t">
        <nav className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-2">
          <NavTabs activeView={activeView} onNavigate={handleNavigate} />
        </nav>
      </div>
    </header>
  );
}
