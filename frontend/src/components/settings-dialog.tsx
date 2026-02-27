"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings, Server, CircleCheck, CircleX, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { checkGrobidHealth, fetchGrobidInstances } from "@/lib/api-client";
import { GrobidInstance } from "@/lib/types";

interface SettingsDialogProps {
  selectedInstanceId: string;
  onSelectInstanceId: (id: string) => void;
}

const INSTANCE_HEALTH_TIMEOUT_MS = 65_000;

export function SettingsDialog({
  selectedInstanceId,
  onSelectInstanceId,
}: SettingsDialogProps) {
  const [instances, setInstances] = useState<GrobidInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(true);
  const [defaultInstanceId, setDefaultInstanceId] = useState("");
  const [checking, setChecking] = useState<string | null>(null);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, boolean | null>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoSelectMessage, setAutoSelectMessage] = useState<{
    type: "success" | "warning";
    text: string;
  } | null>(null);

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

  const probeInstance = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await checkGrobidHealth(
        id,
        AbortSignal.timeout(INSTANCE_HEALTH_TIMEOUT_MS)
      );
      const reachable = result.reachable;
      setStatuses((prev) => ({ ...prev, [id]: reachable }));
      return reachable;
    } catch {
      setStatuses((prev) => ({ ...prev, [id]: false }));
      return false;
    }
  }, []);

  const checkInstance = useCallback(async (id: string) => {
    setAutoSelectMessage(null);
    setChecking(id);
    try {
      await probeInstance(id);
    } finally {
      setChecking(null);
    }
  }, [probeInstance]);

  const autoSelectAvailable = useCallback(async () => {
    setAutoSelectMessage(null);
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
          : "No instance available. Recommended: run Local Docker and select Local Docker.",
      });
      return;
    }

    setAutoSelecting(true);
    try {
      for (const inst of instances) {
        setChecking(inst.id);
        const reachable = await probeInstance(inst.id);
        if (reachable) {
          onSelectInstanceId(inst.id);
          setAutoSelectMessage({
            type: "success",
            text: `Selected available instance: ${inst.name}.`,
          });
          return;
        }
      }

      setAutoSelectMessage({
        type: "warning",
        text:
          "No instance available. Recommended: run Local Docker (`docker run --rm -p 8070:8070 grobid/grobid:0.8.2-crf`) and select Local Docker.",
      });
    } finally {
      setChecking(null);
      setAutoSelecting(false);
    }
  }, [instances, instancesLoading, fetchError, onSelectInstanceId, probeInstance]);

  const checkAll = useCallback(async () => {
    setAutoSelectMessage(null);
    if (instancesLoading || instances.length === 0) {
      return;
    }
    await Promise.allSettled(instances.map((inst) => checkInstance(inst.id)));
  }, [instancesLoading, instances, checkInstance]);

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
          {instances.map((inst) => {
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
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isChecking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : status === true ? (
                      <CircleCheck className="h-3.5 w-3.5 text-green-600" />
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
                <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                  {inst.url}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkAll}
            disabled={
              checking !== null
              || autoSelecting
              || instancesLoading
              || instances.length === 0
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
