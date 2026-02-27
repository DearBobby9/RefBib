"use client";

import Link from "next/link";
import { Database, FileStack, Layers } from "lucide-react";
import { WorkspaceStats } from "@/lib/types";

interface WorkspaceDockProps {
  stats: WorkspaceStats;
}

export function WorkspaceDock({ stats }: WorkspaceDockProps) {
  return (
    <aside className="fixed bottom-24 right-4 z-40 md:right-6">
      <Link
        href="/workspace"
        aria-label="Open Workspace"
        className="group block rounded-full border border-blue-200 bg-blue-50/95 px-4 py-3 shadow-sm backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-blue-900/60 dark:bg-blue-950/60"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-white/90 p-2 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
            <Database className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-800 dark:text-blue-200">
              Workspace
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Papers {stats.papers}
              </span>
              <span className="text-blue-400/80 dark:text-blue-500/80">|</span>
              <span className="inline-flex items-center gap-1">
                <FileStack className="h-3.5 w-3.5" aria-hidden="true" />
                Refs {stats.refs}
              </span>
              <span className="text-blue-400/80 dark:text-blue-500/80">|</span>
              <span>Unique {stats.unique}</span>
            </div>
            <p className="mt-1 text-[11px] text-blue-700/90 dark:text-blue-300/90">
              No account required. Saved locally on this browser.
            </p>
          </div>
        </div>
      </Link>
    </aside>
  );
}
