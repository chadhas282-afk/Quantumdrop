"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  phase: number;
}

/**
 * Animated background with morphing gradient blobs.
 * Creates the "Liquid Space" atmosphere using canvas for performance.
 */
export default function BackgroundBlobs() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const blobs: Blob[] = [
      { x: 0.2, y: 0.2, vx: 0.0001, vy: 0.00015, radius: 0.35, color: "#7c3aed", phase: 0 },
      { x: 0.8, y: 0.7, vx: -0.00012, vy: -0.0001, radius: 0.4, color: "#2563eb", phase: Math.PI / 3 },
      { x: 0.5, y: 0.9, vx: 0.00008, vy: -0.00018, radius: 0.3, color: "#06b6d4", phase: Math.PI * 2 / 3 },
      { x: 0.9, y: 0.1, vx: -0.00009, vy: 0.00013, radius: 0.25, color: "#7c3aed", phase: Math.PI },
    ];

    let animId: number;
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      blobs.forEach((blob) => {
        // Gentle drift
        blob.x += blob.vx;
        blob.y += blob.vy;

        // Bounce off edges
        if (blob.x < 0 || blob.x > 1) blob.vx *= -1;
        if (blob.y < 0 || blob.y > 1) blob.vy *= -1;

        const cx = blob.x * canvas.width;
        const cy = blob.y * canvas.height;
        const r = blob.radius * Math.min(canvas.width, canvas.height);

        // Pulsing radius
        const pulseFactor = 1 + 0.08 * Math.sin(t * 0.5 + blob.phase);
        const actualR = r * pulseFactor;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, actualR);
        gradient.addColorStop(0, blob.color + "66"); // 40% opacity center
        gradient.addColorStop(0.5, blob.color + "33"); // 20%
        gradient.addColorStop(1, blob.color + "00"); // transparent

        ctx.beginPath();
        ctx.arc(cx, cy, actualR, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      t += 0.016;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ filter: "blur(60px)" }}
      />
      {/* Static noise texture overlay */}
      <motion.div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </>
  );
}
