"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { audio } from "@/lib/audio";
import { CHORDS, REGION_BOUNDS, SONG, type ChordId } from "@/lib/music";
import { capture } from "./useKeyPointers";

export type TimelineSlot = {
  chord: ChordId | null;
  /** A dragged chord is hovering over this slot. */
  hot?: boolean;
  /** The learner just dropped the wrong chord here. */
  wrong?: boolean;
};

function formatTime(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The song transport: play/pause plus a scrubbable, always-looping timeline.
 * Pass `slots` to split it into the song's chord regions (the last step).
 */
export function Timeline({
  slots,
  slotRef,
}: {
  slots?: TimelineSlot[];
  slotRef?: (index: number, el: HTMLDivElement | null) => void;
}) {
  const playing = useSyncExternalStore(
    audio.subscribe,
    () => audio.playing,
    () => false,
  );
  const duration = audio.duration;

  const trackRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<SVGSVGElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const slotEls = useRef<(HTMLDivElement | null)[]>([]);
  const dragging = useRef<number | null>(null); // pointerId
  const dragTime = useRef(0);

  // Paint the playhead straight to the DOM every frame — no React re-renders.
  useEffect(() => {
    let frame = 0;
    let shownSecond = -1;
    let shownSlot = -1;
    const paint = () => {
      const t = dragging.current !== null ? dragTime.current : audio.position();
      const pct = duration ? (t / duration) * 100 : 0;
      if (markerRef.current) markerRef.current.style.left = `${pct}%`;
      if (playedRef.current) {
        playedRef.current.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      }
      const second = Math.floor(t);
      if (second !== shownSecond) {
        shownSecond = second;
        if (timeRef.current) timeRef.current.textContent = formatTime(t);
        trackRef.current?.setAttribute("aria-valuenow", String(second));
        trackRef.current?.setAttribute("aria-valuetext", formatTime(t));
      }
      const slot = REGION_BOUNDS.findIndex((b, i) => t >= b && t < REGION_BOUNDS[i + 1]);
      if (slot !== shownSlot) {
        slotEls.current[shownSlot]?.removeAttribute("data-now");
        slotEls.current[slot]?.setAttribute("data-now", "");
        shownSlot = slot;
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  const timeAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 0.9999);
    return x * duration;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
    capture(e.currentTarget, e.pointerId);
    dragging.current = e.pointerId;
    dragTime.current = timeAt(e.clientX);
    audio.scrub(dragTime.current);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== e.pointerId) return;
    dragTime.current = timeAt(e.clientX);
    audio.scrub(dragTime.current);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== e.pointerId) return;
    audio.seek(dragTime.current);
    audio.endScrub();
    dragging.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") audio.seek(audio.position() + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") audio.seek(audio.position() - 1);
    else if (e.key === "Home") audio.seek(0);
    else if (e.key === " " || e.key === "Enter") audio.toggle();
    else return;
    e.preventDefault();
  };

  // The waveform, drawn once as mirrored bars.
  const wavePath = useMemo(() => {
    return audio.peaks
      .map((p, i) => {
        const h = Math.max(0.06, p) * 0.92;
        return `M${i + 0.5} ${(0.5 - h / 2).toFixed(3)}v${h.toFixed(3)}`;
      })
      .join("");
  }, []);
  const bars = audio.peaks.length || 1;
  const wave = (
    <path d={wavePath} strokeWidth={0.62} fill="none" />
  );

  return (
    <div className={`timeline ${slots ? "timeline-slotted" : ""}`}>
      <button
        type="button"
        className="tl-play"
        onClick={() => audio.toggle()}
        aria-label={playing ? "Pause the song" : "Play the song"}
        data-playing={playing || undefined}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5.5" y="4.5" width="4.5" height="15" rx="1.4" />
            <rect x="14" y="4.5" width="4.5" height="15" rx="1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.5 5.5v13l10.5-6.5z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="tl-body">
        <div
          ref={trackRef}
          className="tl-track"
          role="slider"
          tabIndex={0}
          aria-label="Song position"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <div className="tl-wave">
            <svg viewBox={`0 0 ${bars} 1`} preserveAspectRatio="none" className="tl-wave-base" aria-hidden="true">
              {wave}
            </svg>
            <svg ref={playedRef} viewBox={`0 0 ${bars} 1`} preserveAspectRatio="none" className="tl-wave-played" aria-hidden="true">
              {wave}
            </svg>
          </div>

          {slots && (
            <div className="tl-slots">
              {/* The pickup before the first downbeat belongs to no chord. */}
              <div
                className="tl-leadin"
                style={{ width: `${(REGION_BOUNDS[0] / duration) * 100}%` }}
                title="Lead-in"
              />
              {slots.map((slot, i) => {
                const left = (REGION_BOUNDS[i] / duration) * 100;
                const width = ((REGION_BOUNDS[i + 1] - REGION_BOUNDS[i]) / duration) * 100;
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      slotEls.current[i] = el;
                      slotRef?.(i, el);
                    }}
                    className="tl-slot"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      ...(slot.chord ? { ["--chord" as string]: CHORDS[slot.chord].color } : null),
                    }}
                    data-filled={slot.chord ? "" : undefined}
                    data-hot={slot.hot || undefined}
                    data-wrong={slot.wrong || undefined}
                  >
                    <span className="tl-slot-inner" key={slot.chord ?? "empty"}>
                      {slot.chord ?? <span className="tl-slot-num">{i + 1}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div ref={markerRef} className="tl-marker" aria-hidden="true">
            <span className="tl-knob" />
          </div>
        </div>

        <div className="tl-meta">
          <span className="tl-time">
            <span ref={timeRef}>0:00</span> / {formatTime(duration)}
            <span className="tl-loop" title="This excerpt loops forever">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
              </svg>
              loops
            </span>
          </span>
          <span className="tl-credit">
            “{SONG.title}” · {SONG.artist}
          </span>
        </div>
      </div>
    </div>
  );
}
