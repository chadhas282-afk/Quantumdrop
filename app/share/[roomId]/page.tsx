"use client";

import { useEffect } from "react";
import { use } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useTransferStats } from "@/hooks/useTransferStats";
import FileCard from "@/components/FileCard";
import TransferVisualizer from "@/components/TransferVisualizer";
import ConnectionFractured from "@/components/ConnectionFractured";

const PAGE_TRANSITIONS = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -24, scale: 0.97 },
  transition: { type: "spring" as const, stiffness: 280, damping: 30 },
};

interface ReceiverPageProps {
  params: Promise<{ roomId: string }>;
}

export default function ReceiverPage({ params }: ReceiverPageProps) {
  const { roomId } = use(params);

  const {
    state,
    fileMetadata,
    bytesTransferred,
    error,
    connectToRoom,
    reset,
  } = useWebRTC("receiver");

  const wakeLock = useWakeLock();
  const { stats, recordProgress } = useTransferStats(fileMetadata?.size ?? 0);

  // Auto-connect on mount
  useEffect(() => {
    if (roomId) {
      connectToRoom(roomId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Sync progress
  useEffect(() => {
    if (bytesTransferred > 0) {
      recordProgress(bytesTransferred);
    }
  }, [bytesTransferred, recordProgress]);

  // Wake lock during transfer
  useEffect(() => {
    if (state === "transferring" || state === "receiving") {
      wakeLock.request();
    } else if (state === "receive-complete" || state === "error") {
      wakeLock.release();
    }
  }, [state, wakeLock]);

  const isTransferring = state === "transferring" || state === "receiving";
  const isComplete = state === "receive-complete";
  const isConnecting = state === "peer-connecting" || state === "channel-open";

  return (
    <main className="min-h-dvh flex flex-col">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-lg shadow-lg shadow-violet-500/40">
            ⚡
          </div>
          <span className="font-bold text-lg gradient-text">QuantumDrop</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
            Receiving mode
          </span>
        </div>
      </header>

      {/* ── Wake Lock Warning ─────────────────────────────────────── */}
      <AnimatePresence>
        {wakeLock.showWarning && isTransferring && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-6 mb-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-3">
              <span className="text-xl animate-pulse">⚠️</span>
              <p className="text-amber-300 text-xs font-medium">
                <strong>Keep this tab active.</strong> Sleep mode will fracture the bridge.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <AnimatePresence mode="wait">

          {/* ── State: CONNECTING ─────────────────────────────────── */}
          {isConnecting && (
            <motion.div
              key="connecting"
              {...PAGE_TRANSITIONS}
              className="flex flex-col items-center gap-6 text-center"
            >
              <motion.div
                className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(139,92,246,0.3)",
                    "0 0 60px rgba(139,92,246,0.6)",
                    "0 0 20px rgba(139,92,246,0.3)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)",
                }}
              >
                ⚡
              </motion.div>

              <div>
                <h1 className="text-3xl font-black gradient-text mb-2">Establishing Bridge</h1>
                <p className="text-white/40 text-sm">
                  Connecting to sender via WebRTC quantum channel...
                </p>
                <p className="text-white/20 text-xs mt-1 font-mono">
                  room: {roomId}
                </p>
              </div>

              {/* Animated dots */}
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-violet-400"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── State: RECEIVING / TRANSFERRING ───────────────────── */}
          {(isTransferring || isComplete) && (
            <motion.div
              key="receiving"
              {...PAGE_TRANSITIONS}
              className="w-full max-w-2xl flex flex-col items-center gap-6"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {isComplete
                    ? "File Received ✓"
                    : state === "receiving"
                    ? "Awaiting transfer..."
                    : "Receiving..."}
                </h2>
                <p className="text-white/40 text-sm">
                  {isComplete
                    ? "Download has been triggered automatically."
                    : "Data flows directly from sender's browser — zero cloud."}
                </p>
              </div>

              {/* File card — only shown once metadata arrives */}
              {fileMetadata && (
                <FileCard
                  name={fileMetadata.name}
                  size={fileMetadata.size}
                  type={fileMetadata.type}
                />
              )}

              <TransferVisualizer
                stats={
                  isComplete
                    ? { ...stats, percentage: 100, speed: 0, eta: 0 }
                    : fileMetadata
                    ? stats
                    : {
                        bytesTransferred: 0,
                        totalBytes: 0,
                        speed: 0,
                        eta: Infinity,
                        percentage: 0,
                      }
                }
                role="receiver"
                isActive={isTransferring && state !== "receiving"}
              />

              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card rounded-2xl p-5 text-center max-w-sm"
                >
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-white font-bold mb-1">Transfer Complete</h3>
                  <p className="text-white/50 text-sm">
                    Your file has been saved to your downloads.
                  </p>
                  <p className="text-white/25 text-xs mt-2">
                    The bridge has been securely closed. No data was stored on any server.
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── State: ERROR ──────────────────────────────────────── */}
          {state === "error" && (
            <motion.div key="error" {...PAGE_TRANSITIONS}>
              <ConnectionFractured
                onReset={reset}
                message={error ?? undefined}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <footer className="pb-6 text-center">
        <p className="text-white/15 text-xs">
          QuantumDrop · WebRTC · Zero servers · Open source
        </p>
      </footer>
    </main>
  );
}
