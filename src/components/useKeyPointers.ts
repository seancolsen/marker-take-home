"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { audio, type Voice } from "@/lib/audio";

/** setPointerCapture throws if the pointer has already gone; that's fine. */
export function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // The pointer was released before we could capture it.
  }
}

/**
 * The playing logic shared by the piano and the circular keyboard.
 *
 * Every pointer (mouse, or each finger) that goes down on a key is tracked
 * separately, so the keyboard is multi-touch. While a pointer stays down,
 * sliding onto another key releases the old note and starts the new one —
 * a glissando. Releasing lets the note die away with a short envelope.
 *
 * `keyAt` maps a screen position to a pitch class, or null for "no key".
 */
export function useKeyPointers<E extends Element>(
  keyAt: (clientX: number, clientY: number) => number | null,
  onPress?: (pitchClass: number) => void,
) {
  const pointers = useRef(new Map<number, { pc: number | null; voice: Voice | null }>());
  const [down, setDown] = useState<number[]>([]);

  const sync = () =>
    setDown(
      [...pointers.current.values()].flatMap((p) => (p.pc === null ? [] : [p.pc])),
    );

  const move = (pointerId: number, pc: number | null) => {
    const current = pointers.current.get(pointerId);
    if (current && current.pc === pc) return;
    current?.voice?.release();
    pointers.current.set(pointerId, { pc, voice: pc === null ? null : audio.noteOn(pc) });
    if (pc !== null) onPress?.(pc);
    sync();
  };

  const onPointerDown = (e: PointerEvent<E>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const pc = keyAt(e.clientX, e.clientY);
    if (pc === null) return;
    capture(e.currentTarget, e.pointerId);
    move(e.pointerId, pc);
  };

  const onPointerMove = (e: PointerEvent<E>) => {
    if (!pointers.current.has(e.pointerId)) return;
    move(e.pointerId, keyAt(e.clientX, e.clientY));
  };

  const onPointerUp = (e: PointerEvent<E>) => {
    const current = pointers.current.get(e.pointerId);
    if (!current) return;
    current.voice?.release();
    pointers.current.delete(e.pointerId);
    sync();
  };

  // Don't leave notes hanging if the keyboard goes away mid-press.
  useEffect(() => {
    const held = pointers.current;
    return () => {
      held.forEach((p) => p.voice?.release());
      held.clear();
    };
  }, []);

  return {
    /** Pitch classes currently held down. */
    down,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onLostPointerCapture: onPointerUp,
    },
  };
}
