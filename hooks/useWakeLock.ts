"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  showWarning: boolean;
}

/**
 * Hook to manage Screen Wake Lock API.
 * Prevents tab sleep during file transfers.
 * Automatically re-acquires lock on visibility change (required by spec).
 */
export function useWakeLock(): WakeLockState & {
  request: () => Promise<void>;
  release: () => Promise<void>;
} {
  const [isActive, setIsActive] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const lockRef = useRef<WakeLockSentinel | null>(null);

  const isSupported =
    typeof navigator !== "undefined" && "wakeLock" in navigator;

  const request = useCallback(async () => {
    if (!isSupported) {
      setShowWarning(true);
      return;
    }
    try {
      lockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
      setIsActive(true);
      setShowWarning(false);

      lockRef.current.addEventListener("release", () => {
        setIsActive(false);
      });
    } catch {
      setShowWarning(true);
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    if (lockRef.current) {
      await lockRef.current.release();
      lockRef.current = null;
      setIsActive(false);
    }
    setShowWarning(false);
  }, []);

  // Re-acquire lock when tab becomes visible again (spec requirement)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isActive && isSupported) {
        await request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive, isSupported, request]);

  return { isSupported, isActive, showWarning, request, release };
}
