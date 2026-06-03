"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import MagneticButton from "./MagneticButton";

interface ShareCardProps {
  roomId: string;
  fileSize?: number;
  fileName?: string;
}

/**
 * Glassmorphic card showing the shareable link and QR code.
 *
 * QR URL strategy:
 * - If the sender opened via localhost → fetch the real LAN IP from /api/local-ip
 *   and substitute it, so phones on the same WiFi get a scannable URL.
 * - If the sender opened via a network IP already → use it as-is.
 */
export default function ShareCard({ roomId, fileSize, fileName }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    const onLocalhost =
      hostname === "localhost" || hostname === "127.0.0.1";

    setIsLocalhost(onLocalhost);

    if (onLocalhost) {
      // Fetch the machine's real LAN IP from the API route
      fetch("/api/local-ip")
        .then((r) => r.json())
        .then(({ ip }) => {
          if (ip) {
            // Replace localhost with the real IP — phone can now reach this
            const networkUrl = `${protocol}//${ip}${port && port !== "80" && port !== "443" ? `:${port}` : ""}/share/${roomId}`;
            setShareUrl(networkUrl);
          } else {
            // Fallback: use origin as-is
            setShareUrl(`${window.location.origin}/share/${roomId}`);
          }
        })
        .catch(() => {
          setShareUrl(`${window.location.origin}/share/${roomId}`);
        });
    } else {
      // Already on a network IP — use it directly
      setShareUrl(`${window.location.origin}/share/${roomId}`);
    }
  }, [roomId]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="glass-card rounded-3xl p-6 w-full max-w-md mx-auto"
      id="share-card"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-base shadow-lg shadow-violet-500/30">
          ⚡
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Quantum Bridge Active</h3>
          {fileName && (
            <p className="text-white/40 text-xs truncate max-w-[200px]" title={fileName}>
              {fileName}
            </p>
          )}
        </div>
        {/* Pulsing status dot */}
        <div className="ml-auto">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute h-3 w-3 rounded-full bg-emerald-400 opacity-75" />
            <span className="relative rounded-full h-3 w-3 bg-emerald-500" />
          </span>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-5">
        <div className="p-3 rounded-2xl bg-white shadow-lg shadow-black/40">
          {shareUrl ? (
            <QRCodeSVG
              value={shareUrl}
              size={160}
              fgColor="#1e1b4b"
              bgColor="transparent"
              level="M"
              id="share-qr-code"
            />
          ) : (
            // Placeholder while URL resolves
            <div className="w-40 h-40 flex items-center justify-center bg-gray-100 rounded-lg">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border-2 border-indigo-900 border-t-transparent rounded-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Room ID */}
      <div className="mb-3 text-center">
        <p className="text-white/40 text-xs mb-1">Room ID</p>
        <code className="text-violet-300 font-mono text-sm font-semibold tracking-wider">
          {roomId}
        </code>
      </div>

      {/* URL display */}
      <div className="flex items-center gap-2 mb-3 bg-white/5 rounded-xl p-3 border border-white/10">
        <p className="text-white/60 text-xs font-mono truncate flex-1">{shareUrl || "Resolving network address..."}</p>
      </div>

      {/* Copy button */}
      <MagneticButton
        id="copy-link-button"
        className={`
          w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-300
          ${copied
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            : "bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50"
          }
        `}
        onClick={handleCopy}
        disabled={!shareUrl}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span
              key="copied"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center justify-center gap-2"
            >
              <span>✓</span> Link Copied to Clipboard
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center justify-center gap-2"
            >
              <span>🔗</span> Copy Transfer Link
            </motion.span>
          )}
        </AnimatePresence>
      </MagneticButton>

      {/* Waiting indicator */}
      <div className="mt-4 flex items-center justify-center gap-2 text-white/30 text-xs">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full"
        />
        Awaiting receiver to open the link...
      </div>
    </motion.div>
  );
}
