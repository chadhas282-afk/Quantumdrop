"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  icon: string;
  rotation: number;
  vr: number;
  gravity: number;
}

function getFileEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "📦";
  return "📁";
}

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  isDisabled?: boolean;
}

/**
 * Liquid drag-and-drop zone with:
 * - Organic border that warps toward cursor on hover
 * - Particle explosion effect on file drop (canvas-based)
 * - Spring-physics driven interactions
 */
export default function DropZone({ onFileDrop, isDisabled = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springX = useSpring(mouseX, { stiffness: 80, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 80, damping: 20 });

  // Border radius morphs toward cursor
  const borderTopLeft = useTransform([springX, springY], ([x, y]: number[]) =>
    `${40 - (x as number) * 20}% ${40 - (y as number) * 20}%`
  );
  const borderTopRight = useTransform([springX, springY], ([x, y]: number[]) =>
    `${40 + (x as number) * 20}% ${40 - (y as number) * 20}%`
  );
  const borderBottomRight = useTransform([springX, springY], ([x, y]: number[]) =>
    `${40 + (x as number) * 20}% ${40 + (y as number) * 20}%`
  );
  const borderBottomLeft = useTransform([springX, springY], ([x, y]: number[]) =>
    `${40 - (x as number) * 20}% ${40 + (y as number) * 20}%`
  );

  const borderRadius = useTransform(
    [borderTopLeft, borderTopRight, borderBottomRight, borderBottomLeft],
    (vals: string[]) => vals.join(" / ")
  );

  // ── Canvas particle animation ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0.01);

      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.98;
        p.alpha *= 0.93;
        p.rotation += p.vr;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `${p.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.icon, 0, 0);
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const explodeParticles = useCallback((x: number, y: number, mimeType: string) => {
    const icon = getFileEmoji(mimeType);
    const canvas = canvasRef.current;
    if (!canvas) return;

    for (let i = 0; i < 60; i++) {
      const angle = (Math.PI * 2 * i) / 60 + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 9;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        alpha: 1,
        size: 14 + Math.random() * 12,
        icon,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        gravity: 0.15,
      });
    }
  }, []);

  // ── Canvas sizing ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.left = `${rect.left}px`;
      canvas.style.top = `${rect.top}px`;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width);
      mouseY.set((e.clientY - rect.top) / rect.height);
    },
    [mouseX, mouseY]
  );

  const processFile = useCallback(
    (file: File, x: number, y: number) => {
      if (isDisabled) return;
      explodeParticles(x, y, file.type);
      onFileDrop(file);
    },
    [explodeParticles, isDisabled, onFileDrop]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : 0;
      const y = rect ? e.clientY - rect.top : 0;
      processFile(file, x, y);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const cx = rect ? rect.width / 2 : 200;
      const cy = rect ? rect.height / 2 : 150;
      processFile(file, cx, cy);
    },
    [processFile]
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      {/* Canvas for particle explosions — fixed position to overlay everything */}
      <canvas
        ref={canvasRef}
        className="fixed pointer-events-none z-50"
        style={{ position: "fixed" }}
      />

      <motion.div
        className={`
          relative flex flex-col items-center justify-center
          min-h-[320px] cursor-pointer select-none
          border-2 transition-all duration-300
          ${isDragOver
            ? "border-violet-400 bg-violet-500/10"
            : isHovering
            ? "border-cyan-400/60 bg-white/5"
            : "border-white/20 bg-white/[0.03]"
          }
          ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        style={{
          borderRadius,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: isDragOver
            ? "0 0 60px rgba(139,92,246,0.3), inset 0 0 60px rgba(139,92,246,0.05)"
            : isHovering
            ? "0 0 40px rgba(34,211,238,0.15)"
            : "0 0 0px transparent",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          mouseX.set(0.5);
          mouseY.set(0.5);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDisabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInput}
          id="file-upload-input"
        />

        {/* Animated upload icon */}
        <motion.div
          animate={
            isDragOver
              ? { scale: 1.2, rotate: 10 }
              : isHovering
              ? { scale: 1.05 }
              : { scale: 1, rotate: 0 }
          }
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="mb-6"
        >
          <div
            className={`
              w-20 h-20 rounded-2xl flex items-center justify-center text-4xl
              bg-gradient-to-br shadow-lg transition-all duration-300
              ${isDragOver
                ? "from-violet-500/40 to-cyan-500/40 shadow-violet-500/30"
                : "from-white/10 to-white/5 shadow-black/20"
              }
            `}
          >
            {isDragOver ? "⚡" : "☁️"}
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          className="text-center px-8"
          animate={isDragOver ? { y: -4 } : { y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {isDragOver ? (
            <p className="text-violet-300 font-semibold text-lg">
              Release to quantum-lock
            </p>
          ) : (
            <>
              <p className="text-white font-semibold text-lg mb-2">
                Drop any file here
              </p>
              <p className="text-white/40 text-sm">
                or click to browse · Any size · Zero cloud storage
              </p>
            </>
          )}
        </motion.div>

        {/* Glowing ring pulse when hovering */}
        {isHovering && !isDragOver && (
          <motion.div
            className="absolute inset-0 rounded-[inherit] border border-cyan-400/30 pointer-events-none"
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.01, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.div>
    </div>
  );
}
