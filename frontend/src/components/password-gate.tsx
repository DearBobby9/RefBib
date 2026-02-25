"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkAuthRequired, verifyPassword } from "@/lib/api-client";

const AUTH_STORAGE_KEY = "refbib:authenticated";

interface PasswordGateProps {
  children: React.ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [status, setStatus] = useState<
    "checking" | "unlocked" | "locked" | "error"
  >("checking");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // If already authenticated this session, skip the API call.
      if (localStorage.getItem(AUTH_STORAGE_KEY) === "true") {
        setStatus("unlocked");
        return;
      }

      try {
        const required = await checkAuthRequired();
        if (cancelled) return;
        setStatus(required ? "locked" : "unlocked");
      } catch {
        if (cancelled) return;
        // If backend is unreachable, let the user through
        // (they'll get errors on actual API calls anyway).
        setStatus("unlocked");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

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
          setStatus("unlocked");
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

  // Loading state — show nothing to avoid flash.
  if (status === "checking") return null;

  // Authenticated — render the app.
  if (status === "unlocked") return <>{children}</>;

  // Password wall.
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
      </div>
    </div>
  );
}
