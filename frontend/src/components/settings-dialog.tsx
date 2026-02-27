"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings,
  Server,
  CircleCheck,
  CircleX,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { checkGrobidHealth, fetchGrobidInstances } from "@/lib/api-client";
import { GrobidInstance } from "@/lib/types";
import { DEFAULT_GROBID_INSTANCE_ID } from "@/lib/constants";

interface SettingsDialogProps {
  selectedInstanceId: string;
  onSelectInstanceId: (id: string) => void;
}

// Hard abort for the underlying fetch — no point waiting longer than this.
const INSTANCE_HEALTH_TIMEOUT_MS = 65_000;
// UX timeout: if a check takes longer than this, show "timeout" immediately
// but keep the background fetch running so late results still update the UI.
const UX_TIMEOUT_MS = 10_000;

// The primary instance ID that gets top-tier treatment
const PRIMARY_INSTANCE_ID = DEFAULT_GROBID_INSTANCE_ID;

type InstanceStatus = boolean | "timeout" | null;

export function SettingsDialog({
  selectedInstanceId,
  onSelectInstanceId,
}: SettingsDialogProps) {
  const [instances, setInstances] = useState<GrobidInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(true);
  const [defaultInstanceId, setDefaultInstanceId] = useState("");
  const [checking, setChecking] = useState<string | null>(null);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, InstanceStatus>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [autoSelectMessage, setAutoSelectMessage] = useState<{
    type: "success" | "warning";
    text: string;
  } | null>(null);
  // Track late arrivals for autoSelectAvailable: if a background probe returns
  // reachable after autoSelect already finished, auto-select it.
  const autoSelectDoneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setInstancesLoading(true);
      try {
        const data = await fetchGrobidInstances();
        if (cancelled) return;
        setInstances(data.instances);
        setFetchError(null);
        const resolvedDefaultId =
          data.default_id ?? data.instances[0]?.id ?? "";
        setDefaultInstanceId(resolvedDefaultId);
      } catch (err) {
        if (cancelled) return;
        setFetchError(
          err instanceof Error ? err.message : "Failed to load instances"
        );
      } finally {
        if (!cancelled) setInstancesLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (instances.length === 0) return;
    const selectedExists = instances.some(
      (instance) => instance.id === selectedInstanceId
    );
    if (!selectedExists) {
      const fallbackId = defaultInstanceId || instances[0].id;
      if (fallbackId) onSelectInstanceId(fallbackId);
    }
  }, [instances, selectedInstanceId, defaultInstanceId, onSelectInstanceId]);

  // Split instances into primary and community
  const primaryInstance = instances.find((i) => i.id === PRIMARY_INSTANCE_ID);
  const communityInstances = instances.filter(
    (i) => i.id !== PRIMARY_INSTANCE_ID
  );

  // Fire-and-forget background fetch. Returns a "UX result" within UX_TIMEOUT_MS
  // via Promise.race, but the real fetch keeps running and updates status when done.
  const probeInstance = useCallback(
    (id: string): Promise<boolean> => {
      // The real fetch — runs to completion regardless of the UX timer.
      const fetchPromise = checkGrobidHealth(
        id,
        AbortSignal.timeout(INSTANCE_HEALTH_TIMEOUT_MS)
      )
        .then((result) => {
          const reachable = result.reachable;
          setStatuses((prev) => ({ ...prev, [id]: reachable }));
          // Late arrival during autoSelect: if reachable and autoSelect already
          // finished without finding anything, auto-select this one.
          if (reachable && autoSelectDoneRef.current) {
            autoSelectDoneRef.current = false;
            onSelectInstanceId(id);
            const name = instances.find((inst) => inst.id === id)?.name ?? id;
            setAutoSelectMessage({
              type: "success",
              text: `Late arrival — selected: ${name}.`,
            });
          }
          return reachable;
        })
        .catch(() => {
          setStatuses((prev) => {
            // Don't overwrite a late-arriving true with false.
            if (prev[id] === true) return prev;
            return { ...prev, [id]: false };
          });
          return false;
        });

      // UX timer — if the fetch hasn't resolved within UX_TIMEOUT_MS, return
      // false immediately and mark as "timeout". The fetch continues in background.
      const uxTimer = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          setStatuses((prev) => {
            // Only set timeout if not already resolved.
            if (prev[id] != null) return prev;
            return { ...prev, [id]: "timeout" };
          });
          resolve(false);
        }, UX_TIMEOUT_MS);
      });

      return Promise.race([fetchPromise, uxTimer]);
    },
    [instances, onSelectInstanceId]
  );

  const checkInstance = useCallback(
    async (id: string) => {
      setAutoSelectMessage(null);
      setChecking(id);
      await probeInstance(id);
      setChecking((prev) => (prev === id ? null : prev));
    },
    [probeInstance]
  );

  const autoSelectAvailable = useCallback(async () => {
    setAutoSelectMessage(null);
    autoSelectDoneRef.current = false;
    if (instancesLoading) {
      setAutoSelectMessage({
        type: "warning",
        text: "Instance list is still loading. Please wait a moment and retry.",
      });
      return;
    }
    if (instances.length === 0) {
      setAutoSelectMessage({
        type: "warning",
        text: fetchError
          ? "Failed to load instance list. Please retry or configure Local Docker."
          : "No instance available.",
      });
      return;
    }

    setAutoSelecting(true);
    try {
      // Always try primary instance first
      if (primaryInstance) {
        setChecking(primaryInstance.id);
        const reachable = await probeInstance(primaryInstance.id);
        if (reachable) {
          onSelectInstanceId(primaryInstance.id);
          setAutoSelectMessage({
            type: "success",
            text: `Selected: ${primaryInstance.name}.`,
          });
          return;
        }
      }

      // Primary unavailable — try community instances
      for (const inst of communityInstances) {
        setChecking(inst.id);
        const reachable = await probeInstance(inst.id);
        if (reachable) {
          onSelectInstanceId(inst.id);
          setCommunityOpen(true);
          setAutoSelectMessage({
            type: "success",
            text: `Primary unavailable. Selected fallback: ${inst.name}.`,
          });
          return;
        }
      }

      // All timed out or failed within the UX window — but background fetches
      // are still running. If one comes back reachable, autoSelectDoneRef
      // tells the probeInstance callback to auto-select it.
      autoSelectDoneRef.current = true;
      setAutoSelectMessage({
        type: "warning",
        text: "No instance responded in time. Background checks are still running — if one comes back online it will be auto-selected.",
      });
    } finally {
      setChecking(null);
      setAutoSelecting(false);
    }
  }, [
    instances,
    instancesLoading,
    fetchError,
    primaryInstance,
    communityInstances,
    onSelectInstanceId,
    probeInstance,
  ]);

  const checkAll = useCallback(async () => {
    setAutoSelectMessage(null);
    if (instancesLoading || instances.length === 0) {
      return;
    }
    // Fire all probes concurrently — each has its own UX timeout.
    await Promise.allSettled(instances.map((inst) => probeInstance(inst.id)));
  }, [instancesLoading, instances, probeInstance]);

  const renderInstanceCard = (
    inst: GrobidInstance,
    options?: { hideUrl?: boolean; isPrimary?: boolean }
  ) => {
    const isSelected = selectedInstanceId === inst.id;
    const status = statuses[inst.id];
    const isChecking = checking === inst.id;

    return (
      <button
        key={inst.id}
        onClick={() => onSelectInstanceId(inst.id)}
        className={`w-full text-left rounded-lg border p-3 transition-colors ${
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{inst.name}</span>
            {inst.id === defaultInstanceId && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                default
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isChecking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : status === true ? (
              <CircleCheck className="h-3.5 w-3.5 text-green-600" />
            ) : status === "timeout" ? (
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            ) : status === false ? (
              <CircleX className="h-3.5 w-3.5 text-destructive" />
            ) : null}
            {isSelected && (
              <span className="text-xs text-primary font-medium">
                Selected
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {inst.description}
        </p>
        {!options?.hideUrl && (
          <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
            {inst.url}
          </p>
        )}
      </button>
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            GROBID Instance
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Choose which GROBID server to use for PDF parsing. If the selected
          instance fails, others will be tried automatically as fallback.
        </p>

        <div className="space-y-2 mt-2">
          {autoSelectMessage && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 ${
                autoSelectMessage.type === "success"
                  ? "border-green-600/40 bg-green-600/5"
                  : "border-amber-500/40 bg-amber-500/5"
              }`}
            >
              {autoSelectMessage.type === "success" ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              )}
              <p
                className={`text-xs ${
                  autoSelectMessage.type === "success"
                    ? "text-green-700 dark:text-green-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                {autoSelectMessage.text}
              </p>
            </div>
          )}
          {fetchError && instances.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{fetchError}</p>
            </div>
          )}

          {/* Primary instance — always visible */}
          {primaryInstance &&
            renderInstanceCard(primaryInstance, {
              hideUrl: true,
              isPrimary: true,
            })}

          {/* Community instances — collapsible */}
          {communityInstances.length > 0 && (
            <Collapsible open={communityOpen} onOpenChange={setCommunityOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    communityOpen ? "" : "-rotate-90"
                  }`}
                />
                <span>
                  Community instances ({communityInstances.length})
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 pt-1">
                  {communityInstances.map((inst) =>
                    renderInstanceCard(inst)
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkAll}
            disabled={
              checking !== null ||
              autoSelecting ||
              instancesLoading ||
              instances.length === 0
            }
            className="w-full"
          >
            {checking && !autoSelecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Check all instances
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={autoSelectAvailable}
            disabled={checking !== null || autoSelecting || instancesLoading}
            className="w-full"
          >
            {autoSelecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Auto select available
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
