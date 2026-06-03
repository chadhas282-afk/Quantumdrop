"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { TransferStats } from "@/types";
import { formatSpeed, formatETA, formatSize } from "@/hooks/useTransferStats";

interface TransferVisualizerProps {
  stats: TransferStats;
  role: "sender" | "receiver";
  isActive: boolean;
}

interface Pulse {
  t: number; // progress along path 0-1
  speed: number;
  alpha: number;
  size: number;
}

/**
 * Canvas-based transfer visualizer.
 * Shows:
 * - Two glowing nodes (Sender + Receiver)
 * - An energy beam (bezier curve) connecting them
 * - Animated data pulses traveling along the beam
 * - Speed-reactive wave frequency on the beam
 * - Stats overlay with smooth Framer Motion number interpolation
 */
export default function TransferVisualizer({
  stats,
  role,
  isActive,
}: TransferVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulsesRef = useRef<Pulse[]>([]);
  const animRef = useRef<number>(0);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const spawnCooldown = { value: 0 };

    const getPoint = (progress: number, w: number, h: number) => {
      // Bezier curve control points
      const p0 = { x: 60, y: h / 2 };
      const p1 = { x: w * 0.3, y: h * 0.2 };
      const p2 = { x: w * 0.7, y: h * 0.8 };
      const p3 = { x: w - 60, y: h / 2 };

      const nt = 1 - progress;
      return {
        x: nt ** 3 * p0.x + 3 * nt ** 2 * progress * p1.x + 3 * nt * progress ** 2 * p2.x + progress ** 3 * p3.x,
        y: nt ** 3 * p0.y + 3 * nt ** 2 * progress * p1.y + 3 * nt * progress ** 2 * p2.y + progress ** 3 * p3.y,
      };
    };

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const currentStats = statsRef.current;
      const speedMB = currentStats.speed / (1024 * 1024);
      const intensity = Math.min(1, speedMB / 10); // 0-1 based on MB/s

      // Spawn new pulses based on speed
      spawnCooldown.value -= 0.016;
      const spawnInterval = isActive ? Math.max(0.05, 0.4 - intensity * 0.35) : 0.4;
      if (spawnCooldown.value <= 0 && (isActive || currentStats.percentage < 100)) {
        pulsesRef.current.push({
          t: role === "sender" ? 0 : 1,
          speed: 0.4 + intensity * 0.6 + Math.random() * 0.2,
          alpha: 0.7 + Math.random() * 0.3,
          size: 4 + Math.random() * 6,
        });
        spawnCooldown.value = spawnInterval;
      }

      // ─ Draw energy beam ────────────────────────────────────────────────
      const drawBeam = (alpha: number, lineWidth: number, color1: string, color2: string) => {
        const gradient = ctx.createLinearGradient(60, h / 2, w - 60, h / 2);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(0.5, color2);
        gradient.addColorStop(1, color1);

        ctx.beginPath();
        ctx.moveTo(60, h / 2);

        // Draw wave on the beam
        const steps = 80;
        for (let i = 0; i <= steps; i++) {
          const progress = i / steps;
          const base = getPoint(progress, w, h);
          const waveFreq = 3 + speedMB * 0.5;
          const waveAmp = isActive ? 6 + intensity * 10 : 3;
          const wave = Math.sin(progress * Math.PI * 2 * waveFreq + t * 4) * waveAmp;
          const perp = { x: -Math.sin(progress * Math.PI), y: Math.cos(progress * Math.PI) };
          ctx.lineTo(base.x + perp.x * wave, base.y + perp.y * wave);
        }

        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = alpha;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.globalAlpha = 1;
      };

      // Glow layer (thick, low opacity)
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#7c3aed";
      drawBeam(0.15, 20, "#7c3aed", "#06b6d4");

      // Core beam (thin, high opacity)
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#a78bfa";
      drawBeam(0.8, 2.5, "#a78bfa", "#22d3ee");
      ctx.shadowBlur = 0;

      // ─ Update and draw pulses ──────────────────────────────────────────
      pulsesRef.current = pulsesRef.current.filter((p) =>
        role === "sender" ? p.t < 1 : p.t > 0
      );

      pulsesRef.current.forEach((p) => {
        p.t += (role === "sender" ? 1 : -1) * p.speed * 0.016;

        const point = getPoint(Math.max(0, Math.min(1, p.t)), w, h);

        // Glow
        const pulseGrad = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, p.size * 3
        );
        pulseGrad.addColorStop(0, `rgba(200,180,255,${p.alpha})`);
        pulseGrad.addColorStop(0.4, `rgba(139,92,246,${p.alpha * 0.5})`);
        pulseGrad.addColorStop(1, "rgba(139,92,246,0)");

        ctx.beginPath();
        ctx.arc(point.x, point.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = pulseGrad;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(point.x, point.y, p.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(240,220,255,0.9)";
        ctx.fill();
      });

      // ─ Draw nodes ──────────────────────────────────────────────────────
      const drawNode = (x: number, y: number, label: string, isLocal: boolean) => {
        const pulseSize = 35 + Math.sin(t * 2) * 5;

        // Outer glow ring
        const nodeGrad = ctx.createRadialGradient(x, y, 0, x, y, pulseSize);
        nodeGrad.addColorStop(0, isLocal ? "rgba(139,92,246,0.6)" : "rgba(34,211,238,0.4)");
        nodeGrad.addColorStop(0.6, isLocal ? "rgba(139,92,246,0.15)" : "rgba(34,211,238,0.1)");
        nodeGrad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = nodeGrad;
        ctx.fill();

        // Inner core
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = isLocal ? "#7c3aed" : "#06b6d4";
        ctx.shadowBlur = 20;
        ctx.shadowColor = isLocal ? "#7c3aed" : "#06b6d4";
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, x, y + 52);
      };

      const isSender = role === "sender";
      drawNode(60, h / 2, "YOU", isSender);
      drawNode(w - 60, h / 2, isSender ? "RECEIVER" : "SENDER", !isSender);

      t += 0.016;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isActive, role]);

  const pct = Math.min(100, stats.percentage);

  return (
    <div className="w-full flex flex-col items-center gap-6">
      {/* Canvas */}
      <div className="w-full relative" style={{ height: "200px" }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          id="transfer-visualizer-canvas"
        />
      </div>

      {/* Stats */}
      <div className="w-full max-w-xl grid grid-cols-3 gap-3">
        {[
          {
            label: "Speed",
            value: isActive && stats.speed > 0 ? formatSpeed(stats.speed) : "—",
            icon: "⚡",
            color: "violet",
          },
          {
            label: "Progress",
            value: `${pct.toFixed(1)}%`,
            icon: "📡",
            color: "cyan",
          },
          {
            label: "ETA",
            value: isActive ? formatETA(stats.eta) : "—",
            icon: "⏱",
            color: "emerald",
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            className="glass-card rounded-2xl p-4 text-center"
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <motion.p
              className={`text-lg font-bold font-mono ${
                stat.color === "violet"
                  ? "text-violet-300"
                  : stat.color === "cyan"
                  ? "text-cyan-300"
                  : "text-emerald-300"
              }`}
              key={stat.value}
            >
              {stat.value}
            </motion.p>
            <p className="text-white/40 text-xs mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xl">
        <div className="flex justify-between text-xs text-white/40 mb-2">
          <span>{formatSize(stats.bytesTransferred)}</span>
          <span>{formatSize(stats.totalBytes)}</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
            style={{
              boxShadow: "0 0 10px rgba(139,92,246,0.6)",
            }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
