"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Github, Loader2, Lock, RefreshCw, Server, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checkAuthRequired,
  checkServerHealth,
  verifyPassword,
} from "@/lib/api-client";

const AUTH_STORAGE_KEY = "refbib:authenticated";
const MAX_HEALTH_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;
const SLOW_THRESHOLD_MS = 5000;

interface PasswordGateProps {
  children: React.ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [status, setStatus] = useState<
    "connecting" | "unlocked" | "locked" | "fading" | "unreachable"
  >("connecting");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const retriesRef = useRef(0);
  const cancelledRef = useRef(false);

  const connectToServer = useCallback(async () => {
    cancelledRef.current = false;
    setStatus("connecting");
    setSlowHint(false);
    retriesRef.current = 0;

    const slowTimer = setTimeout(() => setSlowHint(true), SLOW_THRESHOLD_MS);

    async function attempt(): Promise<boolean> {
      try {
        const reachable = await checkServerHealth();
        return reachable;
      } catch {
        return false;
      }
    }

    while (retriesRef.current < MAX_HEALTH_RETRIES) {
      if (cancelledRef.current) return;

      const ok = await attempt();
      if (cancelledRef.current) return;

      if (ok) {
        clearTimeout(slowTimer);

        // Server is up. Now check if already authenticated.
        if (localStorage.getItem(AUTH_STORAGE_KEY) === "true") {
          setStatus("unlocked");
          return;
        }

        // Check if password is required.
        try {
          const required = await checkAuthRequired();
          if (cancelledRef.current) return;
          setStatus(required ? "locked" : "unlocked");
        } catch {
          if (cancelledRef.current) return;
          // Fail closed: show password wall rather than granting access on error.
          setStatus("locked");
        }
        return;
      }

      retriesRef.current += 1;
      if (retriesRef.current < MAX_HEALTH_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
      }
    }

    clearTimeout(slowTimer);
    if (!cancelledRef.current) {
      setStatus("unreachable");
    }
  }, []);

  useEffect(() => {
    // If already authenticated, try fast path first.
    if (localStorage.getItem(AUTH_STORAGE_KEY) === "true") {
      // Still ping server to trigger cold start, but don't block.
      checkServerHealth().catch(() => {});
      setStatus("unlocked");
      return;
    }

    connectToServer();
    return () => {
      cancelledRef.current = true;
    };
  }, [connectToServer]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim() || submitting) return;

      setSubmitting(true);
      setErrorMsg("");

      try {
        const valid = await verifyPassword(password);
        if (valid) {
          localStorage.setItem(AUTH_STORAGE_KEY, "true");
          setStatus("fading");
          setTimeout(() => setStatus("unlocked"), 500);
        } else {
          setErrorMsg("Incorrect password");
        }
      } catch {
        setErrorMsg("Unable to reach server. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [password, submitting]
  );

  // Authenticated — render the app.
  if (status === "unlocked") return <>{children}</>;

  // Connecting to server — show spinner.
  if (status === "connecting") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <BookOpen className="h-8 w-8 text-primary" />
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Connecting to server...
            </p>
          </div>
          {slowHint && (
            <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
              Server is waking up from sleep. This may take a moment...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Server unreachable after retries.
  if (status === "unreachable") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <BookOpen className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">
            Unable to reach server
          </p>
          <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
            The backend may be down or still starting up. Please try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={connectToServer}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Password wall (locked or fading out).
  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 transition-all duration-500 ease-out ${
        status === "fading"
          ? "opacity-0 scale-95"
          : "opacity-100 scale-100"
      }`}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="flex flex-col items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">RefBib</h1>
          <p className="text-sm text-muted-foreground">
            Enter password to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9"
              autoFocus
              disabled={submitting}
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Verifying..." : "Enter"}
          </Button>
        </form>

        {/* Self-host notice */}
        <div className="border-t pt-5 space-y-4">
          <div className="flex items-start gap-3">
            <Server className="h-5 w-5 text-foreground/70 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/70 leading-relaxed">
              This instance runs on <strong className="text-foreground">shared public APIs</strong> (GROBID,
              CrossRef, Semantic Scholar, DBLP) with{" "}
              <strong className="text-foreground">limited capacity</strong>.
              Please avoid heavy or automated use.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Github className="h-5 w-5 text-foreground/70 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/70 leading-relaxed">
              RefBib is{" "}
              <strong className="text-foreground">open source</strong>. For
              regular use, we encourage you to{" "}
              <a
                href="https://github.com/DearBobby9/RefBib"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors"
              >
                self-host your own instance
              </a>{" "}
              &mdash; it only takes a few minutes with Docker.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 text-foreground/70 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/70 leading-relaxed">
              If you find RefBib helpful, consider giving it a{" "}
              <a
                href="https://github.com/DearBobby9/RefBib"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors"
              >
                star on GitHub
              </a>
              {" "}&mdash; it means a lot!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
