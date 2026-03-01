"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Plays a short two-tone chime (B4 → E5) via Web Audio API.
 * No audio files needed — tones are generated programmatically.
 *
 * Call `initialize()` on a user gesture (upload click / file drop)
 * to satisfy browser autoplay policy, then `play()` when done.
 */
export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    try {
      ctxRef.current = new AudioContext();
    } catch {
      // Browser doesn't support Web Audio API — fail silently
    }
    return ctxRef.current;
  }, []);

  const initialize = useCallback(async () => {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // Autoplay blocked (e.g. iOS silent mode) — fail silently
      }
    }
  }, [getContext]);

  const play = useCallback(() => {
    const ctx = getContext();
    if (!ctx || ctx.state !== "running") return;

    try {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.connect(ctx.destination);

      // Tone 1: B4 (493.88 Hz)
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 493.88;
      osc1.connect(gain);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Tone 2: E5 (659.26 Hz) — higher, "success" feel
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 659.26;
      osc2.connect(gain);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.35);

      // Fade out to prevent click artifact
      gain.gain.setValueAtTime(0.25, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      // Disconnect gain node after last oscillator ends
      osc2.onended = () => {
        try { gain.disconnect(); } catch { /* already disconnected */ }
      };
    } catch {
      // Audio playback failed — fail silently
    }
  }, [getContext]);

  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        void ctxRef.current.close();
      }
    };
  }, []);

  return { initialize, play };
}
