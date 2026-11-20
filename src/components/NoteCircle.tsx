"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { INTERVAL_NAMES, IS_BLACK, NOTE_NAMES } from "@/lib/music";
import { useKeyPointers } from "./useKeyPointers";

/** The circle is drawn in a 320-unit square centred on the origin. */
export const VIEW = 320;

/** A point on the circle: 0° is 12 o'clock, angles run clockwise. */
export function polar(degrees: number, radius: number): [number, number] {
  const a = (degrees * Math.PI) / 180;
  return [Math.sin(a) * radius, -Math.cos(a) * radius];
}

/** Convert a pointer position to the circle's own coordinates. */
export function toCircle(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const rect = svg.getBoundingClientRect();
  return [
    ((clientX - rect.left) / rect.width - 0.5) * VIEW,
    ((clientY - rect.top) / rect.height - 0.5) * VIEW,
  ];
}

/**
 * Smoothly animates a list of numbers towards `target` whenever it changes.
 * Used to morph one scale polygon into another.
 */
export function useTween(target: number[] | null, ms = 280): number[] | null {
  const [frame, setFrame] = useState<number[] | null>(null);
  const shown = useRef(target);
  const key = target ? target.join(",") : "";

  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = target;
    if (!from || !target || from.length !== target.length) return;
    if (from.every((v, i) => v === target[i])) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - k) ** 3;
      const values = from.map((f, i) => f + (target[i] - f) * eased);
      shown.current = values;
      setFrame(k < 1 ? values : null);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    tick(start); // paint the starting position before the browser does
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);

  return frame ?? target;
}

/**
 * The twelve notes arranged in a circle with C at the top — a piano keyboard
 * bent round on itself. Keys are playable exactly like the piano's: press,
 * hold, slide between them, with as many fingers as you like.
 */
export function NoteCircle({
  enabled,
  ring = 108,
  keyRadius = 22,
  showIntervals = false,
  under,
  children,
  label,
}: {
  /** Which of the twelve notes can be played. */
  enabled: boolean[];
  /** Radius of the ring the key centres sit on. */
  ring?: number;
  keyRadius?: number;
  /** Label each position with its interval from the tonal center. */
  showIntervals?: boolean;
  /** SVG drawn beneath the keys (the scale and chord polygons). */
  under?: ReactNode;
  /** HTML laid over the circle (the "Choose …" button). */
  children?: ReactNode;
  label: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const { down, handlers } = useKeyPointers<SVGSVGElement>((clientX, clientY) => {
    if (!svgRef.current) return null;
    const [x, y] = toCircle(svgRef.current, clientX, clientY);
    for (let pc = 0; pc < 12; pc++) {
      if (!enabled[pc]) continue;
      const [kx, ky] = polar(pc * 30, ring);
      if (Math.hypot(x - kx, y - ky) <= keyRadius + 3) return pc;
    }
    return null; // not on a key: leave it for the polygons underneath
  });

  const labelRadius = ring + keyRadius + 9;

  return (
    <div className="circle-slot">
      <div className="circle">
        <svg
          ref={svgRef}
          viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
          role="group"
          aria-label={label}
          {...handlers}
        >
          {showIntervals &&
            INTERVAL_NAMES.map((name, pc) => {
              const [x, y] = polar(pc * 30, labelRadius);
              const side = Math.sin((pc * 30 * Math.PI) / 180);
              return (
                <text
                  key={pc}
                  className="ck-interval"
                  data-off={!enabled[pc] || undefined}
                  x={x}
                  y={y}
                  dy={pc === 0 ? "-0.1em" : pc === 6 ? "0.8em" : "0.35em"}
                  textAnchor={side > 0.2 ? "start" : side < -0.2 ? "end" : "middle"}
                >
                  {name}
                </text>
              );
            })}

          {under}

          {NOTE_NAMES.map((name, pc) => {
            const [x, y] = polar(pc * 30, ring);
            return (
              <g key={pc} transform={`translate(${x} ${y})`}>
                <g
                  className="ck"
                  data-black={IS_BLACK[pc] || undefined}
                  data-off={!enabled[pc] || undefined}
                  data-on={down.includes(pc) || undefined}
                >
                  <circle r={keyRadius} />
                  <text dy="0.36em" textAnchor="middle">
                    {name}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
        {children}
      </div>
    </div>
  );
}
