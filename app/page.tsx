"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useTransferStats } from "@/hooks/useTransferStats";
import DropZone from "@/components/DropZone";
import FileCard from "@/components/FileCard";
import ShareCard from "@/components/ShareCard";
import TransferVisualizer from "@/components/TransferVisualizer";
import ConnectionFractured from "@/components/ConnectionFractured";
import MagneticButton from "@/components/MagneticButton";

const PAGE_TRANSITIONS = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -24, scale: 0.97 },
  transition: { type: "spring" as const, stiffness: 280, damping: 30 },
};

export default function Home() {
  const {
    state,
    roomId,
    file,
    bytesTransferred,
    error,
    selectFile,
    createRoom,
    reset,
  } = useWebRTC("sender");

  const wakeLock = useWakeLock();
  const { stats, recordProgress } = useTransferStats(file?.size ?? 0);

  // Sync bytesTransferred from WebRTC hook into transfer stats
  useEffect(() => {
    if (bytesTransferred > 0) {
      recordProgress(bytesTransferred);
    }
  }, [bytesTransferred, recordProgress]);

  // Activate wake lock when transfer starts
  useEffect(() => {
    if (state === "transferring" || state === "channel-open") {
      wakeLock.request();
    } else if (state === "complete" || state === "error") {
      wakeLock.release();
    }
  }, [state, wakeLock]);

  const isTransferring = state === "transferring" || state === "channel-open";
  const isComplete = state === "complete";
  const isWaiting = state === "room-created" || state === "peer-connecting";

  return (
    <main className="min-h-dvh flex flex-col">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-5">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-lg shadow-lg shadow-violet-500/40">
            ⚡
          </div>
          <span className="font-bold text-lg gradient-text">QuantumDrop</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2"
        >
          <span className="text-xs text-white/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            Zero cloud storage
          </span>
        </motion.div>
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
                <strong>Keep this tab active.</strong> Sleep mode will collapse the bridge and interrupt the transfer.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <AnimatePresence mode="wait">

          {/* ── State: IDLE — drop zone ────────────────────────────── */}
          {state === "idle" && (
            <motion.div
              key="idle"
              {...PAGE_TRANSITIONS}
              className="w-full max-w-xl flex flex-col items-center gap-8"
            >
              <div className="text-center">
                <motion.h1
                  className="text-4xl sm:text-5xl font-black mb-3 gradient-text"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Send any file.
                </motion.h1>
                <motion.p
                  className="text-white/40 text-base"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  Direct browser-to-browser. No servers. No limits.
                </motion.p>
              </div>

              <DropZone onFileDrop={selectFile} />

              <motion.p
                className="text-white/20 text-xs text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Files travel exclusively through WebRTC — encrypted end-to-end by default.
              </motion.p>
            </motion.div>
          )}

          {/* ── State: FILE SELECTED ───────────────────────────────── */}
          {state === "file-selected" && file && (
            <motion.div
              key="file-selected"
              {...PAGE_TRANSITIONS}
              className="w-full max-w-md flex flex-col items-center gap-6"
            >
              <h2 className="text-2xl font-bold text-white">Ready to beam</h2>
              <FileCard name={file.name} size={file.size} type={file.type} />

              <MagneticButton
                id="create-room-button"
                className="w-full py-4 px-8 rounded-2xl font-bold text-base bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-shadow"
                onClick={createRoom}
              >
                <span className="flex items-center justify-center gap-2">
                  <span>⚡</span> Generate Transfer Link
                </span>
              </MagneticButton>

              <button
                onClick={reset}
                className="text-white/30 text-sm hover:text-white/60 transition-colors"
              >
                ← Choose a different file
              </button>
            </motion.div>
          )}

          {/* ── State: ROOM CREATED / WAITING ─────────────────────── */}
          {isWaiting && roomId && file && (
            <motion.div
              key="waiting"
              {...PAGE_TRANSITIONS}
              className="w-full max-w-md flex flex-col items-center gap-5"
            >
              <FileCard name={file.name} size={file.size} type={file.type} />
              <ShareCard
                roomId={roomId}
                fileName={file.name}
                fileSize={file.size}
              />
            </motion.div>
          )}

          {/* ── State: TRANSFERRING ───────────────────────────────── */}
          {(isTransferring || isComplete) && file && (
            <motion.div
              key="transferring"
              {...PAGE_TRANSITIONS}
              className="w-full max-w-2xl flex flex-col items-center gap-6"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {isComplete ? "Transfer Complete ✓" : "Quantum Bridge Active"}
                </h2>
                <p className="text-white/40 text-sm">
                  {isComplete
                    ? "The file has been delivered. The bridge is now closed."
                    : "File data flows directly — no detours."}
                </p>
              </div>

              <TransferVisualizer
                stats={isComplete ? { ...stats, percentage: 100, speed: 0, eta: 0 } : stats}
                role="sender"
                isActive={isTransferring && !isComplete}
              />

              {isComplete && (
                <MagneticButton
                  id="send-another-button"
                  className="px-8 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/30"
                  onClick={reset}
                >
                  Send Another File
                </MagneticButton>
              )}
            </motion.div>
          )}

          {/* ── State: ERROR ──────────────────────────────────────── */}
          {state === "error" && (
            <motion.div key="error" {...PAGE_TRANSITIONS}>
              <ConnectionFractured onReset={reset} message={error ?? undefined} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="pb-6 text-center">
        <p className="text-white/15 text-xs">
          QuantumDrop · WebRTC · Zero servers · Open source
        </p>
      </footer>
    </main>
  );
}
