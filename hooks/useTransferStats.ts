"use client";

import { useState, useCallback, useRef } from "react";
import { TransferStats } from "@/types";

const WINDOW_MS = 500; // 500ms rolling window for speed calculation

interface SpeedSample {
  timestamp: number;
  bytes: number;
}

/**
 * Hook for real-time transfer statistics with rolling average speed calculation.
 * Uses a 500ms sliding window to smooth out speed fluctuations.
 */
export function useTransferStats(totalBytes: number) {
  const [stats, setStats] = useState<TransferStats>({
    bytesTransferred: 0,
    totalBytes,
    speed: 0,
    eta: Infinity,
    percentage: 0,
  });

  const samplesRef = useRef<SpeedSample[]>([]);
  const lastBytesRef = useRef(0);

  const recordProgress = useCallback(
    (bytesTransferred: number) => {
      const now = Date.now();

      // Add new sample
      samplesRef.current.push({ timestamp: now, bytes: bytesTransferred });

      // Remove samples older than the window
      samplesRef.current = samplesRef.current.filter(
        (s) => now - s.timestamp <= WINDOW_MS
      );

      // Calculate speed from the window
      let speed = 0;
      if (samplesRef.current.length >= 2) {
        const oldest = samplesRef.current[0];
        const newest = samplesRef.current[samplesRef.current.length - 1];
        const deltaBytes = newest.bytes - oldest.bytes;
        const deltaTime = (newest.timestamp - oldest.timestamp) / 1000; // seconds
        speed = deltaTime > 0 ? deltaBytes / deltaTime : 0;
      }

      const remaining = totalBytes - bytesTransferred;
      const eta = speed > 0 ? remaining / speed : Infinity;
      const percentage = totalBytes > 0 ? (bytesTransferred / totalBytes) * 100 : 0;

      lastBytesRef.current = bytesTransferred;

      setStats({
        bytesTransferred,
        totalBytes,
        speed,
        eta,
        percentage,
      });
    },
    [totalBytes]
  );

  const reset = useCallback(() => {
    samplesRef.current = [];
    lastBytesRef.current = 0;
    setStats({
      bytesTransferred: 0,
      totalBytes,
      speed: 0,
      eta: Infinity,
      percentage: 0,
    });
  }, [totalBytes]);

  return { stats, recordProgress, reset };
}

/** Formats bytes/s into human-readable speed string */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024)
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  if (bytesPerSecond < 1024 * 1024 * 1024)
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

/** Formats seconds into human-readable ETA */
export function formatETA(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "Calculating...";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/** Formats bytes into human-readable size */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
