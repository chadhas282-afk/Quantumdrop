"use client";

import { motion } from "framer-motion";
import MagneticButton from "./MagneticButton";

interface ConnectionFracturedProps {
  onReset: () => void;
  message?: string;
}

/**
 * Error state UI shown when the WebRTC connection fails or drops.
 * Features a glitch animation and a re-initialize button.
 */
export default function ConnectionFractured({
  onReset,
  message,
}: ConnectionFracturedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 text-center max-w-sm mx-auto"
      id="connection-fractured"
    >
      {/* Fractured icon */}
      <div className="relative">
        <motion.div
          className="text-7xl"
          animate={{
            x: [0, -2, 4, -3, 2, 0],
            opacity: [1, 0.8, 1, 0.6, 1, 1],
          }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            repeatDelay: 2.5,
            times: [0, 0.1, 0.3, 0.5, 0.8, 1],
          }}
        >
          ⚡
        </motion.div>

        {/* Glitch overlay */}
        <motion.div
          className="absolute inset-0 text-7xl text-red-400 mix-blend-screen"
          animate={{
            x: [0, 3, -2, 4, 0],
            opacity: [0, 0.8, 0, 0.5, 0],
          }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            repeatDelay: 2.5,
            times: [0, 0.1, 0.3, 0.5, 1],
          }}
        >
          ⚡
        </motion.div>
      </div>

      {/* Title */}
      <div>
        <motion.h2
          className="text-2xl font-bold text-white mb-2"
          animate={{
            textShadow: [
              "0 0 0px transparent",
              "2px 0 0 rgba(239,68,68,0.8), -2px 0 0 rgba(34,211,238,0.8)",
              "0 0 0px transparent",
            ],
          }}
          transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 3 }}
        >
          Connection Fractured
        </motion.h2>
        <p className="text-white/50 text-sm leading-relaxed">
          {message ||
            "The quantum bridge collapsed. The transfer could not be completed."}
        </p>
      </div>

      {/* Error details */}
      {message && (
        <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <p className="text-red-300 text-xs font-mono">{message}</p>
        </div>
      )}

      {/* Re-initialize button */}
      <MagneticButton
        id="reinitialize-button"
        className="px-8 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-shadow"
        onClick={onReset}
      >
        <span className="flex items-center gap-2">
          <span>🔄</span> Re-initialize Bridge
        </span>
      </MagneticButton>

      <p className="text-white/20 text-xs">
        A new room will be created with a fresh link
      </p>
    </motion.div>
  );
}
