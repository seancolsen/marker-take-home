"use client";

import { useRef } from "react";
import { NOTE_NAMES } from "@/lib/music";
import { useKeyPointers } from "./useKeyPointers";

const WHITE = [0, 2, 4, 5, 7, 9, 11];
// Each black key straddles the boundary to the right of white key n.
const BLACK: { pc: number; after: number }[] = [
  { pc: 1, after: 1 },
  { pc: 3, after: 2 },
  { pc: 6, after: 4 },
  { pc: 8, after: 5 },
  { pc: 10, after: 6 },
];
const BLACK_WIDTH = 0.6 / 7; // as a fraction of the keyboard
const BLACK_HEIGHT = 0.62;

/** Which key is under a point? Pure geometry, so there are no dead gaps. */
function keyAt(el: HTMLElement, clientX: number, clientY: number): number | null {
  const rect = el.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
  if (y < BLACK_HEIGHT) {
    const black = BLACK.find((b) => Math.abs(x - b.after / 7) < BLACK_WIDTH / 2);
    if (black) return black.pc;
  }
  return WHITE[Math.floor(x * 7)];
}

/**
 * One octave from middle C. Multi-touch, and you can slide across the keys
 * (glissando) with a finger or a held mouse button.
 */
export function PianoKeyboard({
  onPress,
  lit = [],
}: {
  /** Called on every key press with a point near the key's label. */
  onPress?: (pitchClass: number, origin: { x: number; y: number }) => void;
  /** Extra keys to light up (e.g. a note being auditioned elsewhere). */
  lit?: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  const { down, handlers } = useKeyPointers<HTMLDivElement>(
    (x, y) => (ref.current ? keyAt(ref.current, x, y) : null),
    (pc) => {
      if (!onPress || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const black = BLACK.find((b) => b.pc === pc);
      onPress(pc, {
        x: rect.left + rect.width * (black ? black.after / 7 : (WHITE.indexOf(pc) + 0.5) / 7),
        y: rect.top + rect.height * (black ? BLACK_HEIGHT - 0.14 : 0.86),
      });
    },
  );

  const isLit = (pc: number) => down.includes(pc) || lit.includes(pc);

  return (
    <div
      ref={ref}
      className="piano"
      role="group"
      aria-label="Piano keyboard, one octave from middle C"
      {...handlers}
    >
      {WHITE.map((pc, i) => (
        <div
          key={pc}
          className="piano-key piano-white"
          data-on={isLit(pc) || undefined}
          style={{ left: `${(i / 7) * 100}%`, width: `${100 / 7}%` }}
        >
          <span>{NOTE_NAMES[pc]}</span>
        </div>
      ))}
      {BLACK.map(({ pc, after }) => (
        <div
          key={pc}
          className="piano-key piano-black"
          data-on={isLit(pc) || undefined}
          style={{
            left: `${(after / 7 - BLACK_WIDTH / 2) * 100}%`,
            width: `${BLACK_WIDTH * 100}%`,
            height: `${BLACK_HEIGHT * 100}%`,
          }}
        >
          <span>{NOTE_NAMES[pc]}</span>
        </div>
      ))}
    </div>
  );
}
