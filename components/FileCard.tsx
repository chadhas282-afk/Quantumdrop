"use client";

import { motion } from "framer-motion";
import { formatSize } from "@/hooks/useTransferStats";

interface FileCardProps {
  name: string;
  size: number;
  type: string;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("tar")) return "📦";
  if (mimeType.includes("text/") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽️";
  if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("html") || mimeType.includes("css") || mimeType.includes("json")) return "💻";
  return "📁";
}

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "Archive";
  if (mimeType.startsWith("text/")) return "Text";
  return "File";
}

/**
 * Displays file metadata in a glassmorphic card with icon, name, size, and type.
 */
export default function FileCard({ name, size, type }: FileCardProps) {
  const icon = getFileIcon(type);
  const category = getFileCategory(type);
  const formattedSize = formatSize(size);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="glass-card flex items-center gap-4 p-4 rounded-2xl w-full max-w-md"
    >
      {/* File icon */}
      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 flex items-center justify-center text-3xl border border-white/10">
        {icon}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-white font-semibold text-sm truncate"
          title={name}
        >
          {name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20">
            {category}
          </span>
          <span className="text-xs text-white/50">{formattedSize}</span>
        </div>
      </div>

      {/* Animated pulse indicator */}
      <div className="flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]">
          <motion.div
            className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-60"
            animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </div>
    </motion.div>
  );
}
