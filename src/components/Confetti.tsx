"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#ff7b7b", "#ffa552", "#ffd24a", "#4fd6a8", "#56bdf5", "#b29bff", "#ff8fc7"];

/** A few seconds of confetti raining over the whole page. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const pieces = Array.from({ length: 170 }, (_, i) => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.6,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 3.5,
      size: 6 + Math.random() * 7,
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.3,
      sway: Math.random() * Math.PI * 2,
      color: COLORS[i % COLORS.length],
      round: i % 4 === 0,
    }));

    const DURATION = 5200;
    const start = performance.now();
    let last = start;
    let frame = 0;
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 16.7, 3);
      last = now;
      const age = now - start;
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = Math.min(1, (DURATION - age) / 900);
      for (const p of pieces) {
        p.sway += 0.05 * dt;
        p.x += (p.vx + Math.sin(p.sway) * 1.2) * dt;
        p.y += p.vy * dt;
        p.spin += p.spinSpeed * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Squash one axis so pieces look like they're tumbling.
          ctx.scale(1, Math.cos(p.spin * 2.3));
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5);
        }
        ctx.restore();
      }
      if (age < DURATION) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, width, height);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
