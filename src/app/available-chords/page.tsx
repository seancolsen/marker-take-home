"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { NoteCircle, polar, toCircle, VIEW } from "@/components/NoteCircle";
import { StepShell, type Feedback } from "@/components/StepShell";
import { Fresh } from "@/components/tutorial";
import { capture } from "@/components/useKeyPointers";
import { audio, type Voice } from "@/lib/audio";
import {
  CHORD_IDS,
  CHORDS,
  chordIdFor,
  chordLabel,
  NOTE_NAMES,
  SCALES,
  TRIADS,
  triadNotes,
  type ChordId,
  type Quality,
} from "@/lib/music";

export default function Page() {
  return (
    <Fresh>
      <AvailableChords />
    </Fresh>
  );
}

const RING = 128;
const KEY_RADIUS = 24;
const POLYGON_RADIUS = RING - KEY_RADIUS - 6;

const SCALE = SCALES.major;
const IN_SCALE = Array.from({ length: 12 }, (_, pc) => SCALE.includes(pc));
const SCALE_POINTS = SCALE.map((pc) => polar(pc * 30, POLYGON_RADIUS).join(",")).join(" ");

/** The chord clicks into place with its root on each note of the scale. */
const DETENTS = SCALE.map((pc) => pc * 30);
/** Within this many degrees, a detent grabs the chord while dragging. */
const MAGNET = 9;

const mod360 = (a: number) => ((a % 360) + 360) % 360;
const wrap180 = (a: number) => mod360(a + 180) - 180;

function nearestDetent(angle: number) {
  let best = 0;
  let distance = Infinity;
  for (const detent of DETENTS) {
    const d = Math.abs(wrap180(angle - detent));
    if (d < distance) {
      distance = d;
      best = detent;
    }
  }
  return { angle: best, distance };
}

/** The centre of the largest circle that fits inside a triangle. */
function incenter(points: [number, number][]): [number, number] {
  const [a, b, c] = points;
  const la = Math.hypot(b[0] - c[0], b[1] - c[1]);
  const lb = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const lc = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const sum = la + lb + lc;
  return [
    (la * a[0] + lb * b[0] + lc * c[0]) / sum,
    (la * a[1] + lb * b[1] + lc * c[1]) / sum,
  ];
}

const START: Feedback = {
  kind: "hint",
  text: "Pick a chord shape to drop it into the scale. Which notes can it sit on with all three corners touching the scale?",
};

function AvailableChords() {
  const [quality, setQuality] = useState<Quality | null>(null);
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [found, setFound] = useState<ChordId[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(START);
  const feedbackId = useRef(0);

  const drag = useRef<{
    id: number;
    prev: number; // last pointer angle
    raw: number; // un-snapped chord angle
    detent: number; // last detent it clicked into
    moved: boolean;
  } | null>(null);
  const settle = useRef(0);

  // There's no timeline on this page, so make sure the song isn't left playing.
  useEffect(() => {
    audio.pause();
    return () => cancelAnimationFrame(settle.current);
  }, []);

  const solved = found.length === CHORD_IDS.length;
  const root = Math.round(nearestDetent(angle).angle / 30) % 12;

  const say = (kind: Feedback["kind"], text: string) =>
    setFeedback({ kind, text, id: ++feedbackId.current });

  const pick = (q: Quality) => {
    setQuality(q);
    audio.chordTap(root, q);
    if (!quality) {
      say("hint", "Now drag the triangle to spin it around the circle. It clicks into place on each note of the scale.");
    }
  };

  // -- Rotating the chord ------------------------------------------------------

  const pointerAngle = (e: PointerEvent<SVGGElement>) => {
    const [x, y] = toCircle(e.currentTarget.ownerSVGElement!, e.clientX, e.clientY);
    return (Math.atan2(x, -y) * 180) / Math.PI;
  };

  /** Glide the last few degrees into a detent. */
  const settleTo = (from: number, to: number) => {
    cancelAnimationFrame(settle.current);
    const delta = wrap180(to - from);
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 140);
      setAngle(k < 1 ? mod360(from + delta * (1 - (1 - k) ** 3)) : to);
      if (k < 1) settle.current = requestAnimationFrame(tick);
    };
    settle.current = requestAnimationFrame(tick);
  };

  const onPointerDown = (e: PointerEvent<SVGGElement>) => {
    if (!quality || drag.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.stopPropagation(); // the triangle wins over any key it overlaps
    capture(e.currentTarget, e.pointerId);
    cancelAnimationFrame(settle.current);
    drag.current = {
      id: e.pointerId,
      prev: pointerAngle(e),
      raw: angle,
      detent: nearestDetent(angle).angle,
      moved: false,
    };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !quality) return;
    const now = pointerAngle(e);
    const step = wrap180(now - d.prev);
    d.prev = now;
    d.raw += step;
    if (Math.abs(step) > 0.5) d.moved = true;
    const near = nearestDetent(d.raw);
    if (near.distance < MAGNET) {
      if (near.angle !== d.detent) {
        d.detent = near.angle;
        audio.chordTap(near.angle / 30, quality, 0.6); // "click"
      }
      setAngle(near.angle);
    } else {
      setAngle(mod360(d.raw));
    }
  };

  const onPointerUp = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !quality) return;
    drag.current = null;
    setDragging(false);
    const near = nearestDetent(d.raw);
    settleTo(angle, near.angle);
    // A tap plays the chord; so does coming to rest somewhere new.
    if (!d.moved || near.angle !== d.detent) audio.chordTap(near.angle / 30, quality);
  };

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (!quality) return;
    const direction = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    e.preventDefault();
    const i = DETENTS.indexOf(nearestDetent(angle).angle);
    const next = DETENTS[(i + direction + DETENTS.length) % DETENTS.length];
    settleTo(angle, next);
    audio.chordTap(next / 30, quality);
  };

  // -- Choosing ----------------------------------------------------------------

  const choose = () => {
    if (!quality) return;
    const label = chordLabel(root, quality);
    const notes = triadNotes(root, quality);
    const id = chordIdFor(root, quality);
    audio.chordTap(root, quality, 0.5);

    if (!id) {
      const outside = notes.filter((pc) => !SCALE.includes(pc)).map((pc) => NOTE_NAMES[pc]);
      const other: Quality = quality === "major" ? "minor" : "major";
      audio.sfx("incorrect");
      say(
        "oops",
        `Not quite! ${NOTE_NAMES[root]} ${quality} needs ${outside.join(" and ")}, which ${outside.length > 1 ? "aren’t" : "isn’t"} in the C major scale — see the corner pointing at a greyed-out note? ` +
          (chordIdFor(root, other)
            ? `Try the ${other} shape here instead.`
            : "Neither shape fits on B, so spin onwards!"),
      );
      return;
    }
    if (found.includes(id)) {
      say("hint", `You’ve already found ${label}. Keep spinning to track down the rest!`);
      return;
    }

    const all = [...found, id];
    setFound(all);
    audio.sfx("correct");
    if (all.length === CHORD_IDS.length) {
      say(
        "good",
        "That’s all six! C, Dm, Em, F, G and Am are the chords that live in the key of C major. (Nothing fits on B — its chord is a spiky, rare one called “diminished”, so we’ll leave it be.)",
      );
      return;
    }
    const left = CHORD_IDS.filter((c) => !all.includes(c));
    const sameShapeLeft = left.some((c) => CHORDS[c].quality === quality);
    say(
      "good",
      `Yes! ${label} fits — all three corners (${notes.map((pc) => NOTE_NAMES[pc]).join(", ")}) land on notes in the scale. ` +
        (sameShapeLeft
          ? `${left.length} more to find.`
          : `That’s every ${quality} chord — now try the ${quality === "major" ? "minor" : "major"} shape!`),
    );
  };

  // -- Drawing -----------------------------------------------------------------

  const corners = quality
    ? TRIADS[quality].map((i) => polar(angle + i * 30, POLYGON_RADIUS))
    : null;
  const center = corners ? incenter(corners) : null;
  const chosenId = quality ? chordIdFor(root, quality) : null;
  const alreadyFound = chosenId !== null && found.includes(chosenId);

  return (
    <StepShell
      step={2}
      title="Let’s find the chords within the C major scale!"
      solved={solved}
      feedback={feedback}
    >
      <div className="prose">
        <p>
          A chord is set of notes played together. Different types of chords are defined by their
          relative pattern of musical intervals, meaning we can visualize chords as polygons in the
          circle of notes too! Try rotating the major and minor chords within the scale to see
          where they fit. <strong>Choose all the chords within the scale.</strong>
        </p>
      </div>

      <div className="picker">
        <NoteCircle
          enabled={IN_SCALE}
          ring={RING}
          keyRadius={KEY_RADIUS}
          label="Circular keyboard showing the C major scale"
          under={
            <>
              <polygon className="scale-poly scale-poly-quiet" points={SCALE_POINTS} />
              {corners && quality && (
                <g
                  className="chord-poly"
                  data-quality={quality}
                  data-dragging={dragging || undefined}
                  role="slider"
                  tabIndex={0}
                  aria-label="Chord position — drag or use the arrow keys to rotate"
                  aria-valuemin={0}
                  aria-valuemax={DETENTS.length - 1}
                  aria-valuenow={DETENTS.indexOf(nearestDetent(angle).angle)}
                  aria-valuetext={chordLabel(root, quality)}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onLostPointerCapture={onPointerUp}
                  onKeyDown={onKeyDown}
                >
                  <polygon points={corners.map((p) => p.join(",")).join(" ")} />
                  {corners.map(([x, y], i) => (
                    <g key={i}>
                      {/* A generous invisible handle around each corner. */}
                      <circle cx={x} cy={y} r={15} className="chord-handle" />
                      <circle cx={x} cy={y} r={i === 0 ? 7.5 : 5} className={i === 0 ? "chord-root" : "chord-corner"} />
                    </g>
                  ))}
                </g>
              )}
            </>
          }
        >
          {center && quality && (
            <button
              type="button"
              className="choose-btn choose-btn-round"
              style={{
                left: `${(center[0] / VIEW + 0.5) * 100}%`,
                top: `${(center[1] / VIEW + 0.5) * 100}%`,
              }}
              data-chosen={alreadyFound || undefined}
              disabled={dragging}
              onClick={choose}
            >
              <span>{alreadyFound ? "✓" : "Choose"}</span>
              <b>{chordLabel(root, quality)}</b>
            </button>
          )}
        </NoteCircle>

        <div className="picker-controls">
          <div className="seg" role="group" aria-label="Chord shape">
            {(["major", "minor"] as const).map((q) => (
              <button
                key={q}
                type="button"
                className="seg-btn"
                aria-pressed={quality === q}
                onClick={() => pick(q)}
              >
                {q === "major" ? "Major chord" : "Minor chord"}
              </button>
            ))}
          </div>

          <div className="found" aria-label={`Chords found: ${found.length} of ${CHORD_IDS.length}`}>
            <span className="found-title">Found</span>
            {CHORD_IDS.map((id) =>
              found.includes(id) ? (
                <HoldChord key={id} id={id} />
              ) : (
                <span key={id} className="chord-chip chord-chip-empty" aria-hidden="true">
                  ?
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </StepShell>
  );
}

/** A found chord: press and hold to hear it again. */
function HoldChord({ id }: { id: ChordId }) {
  const voice = useRef<Voice | null>(null);
  const stop = () => {
    voice.current?.release();
    voice.current = null;
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      className="chord-chip pop-in"
      style={{ "--chord": CHORDS[id].color } as CSSProperties}
      aria-label={`${id} — press to hear`}
      onPointerDown={(e) => {
        capture(e.currentTarget, e.pointerId);
        stop();
        voice.current = audio.chordOn(CHORDS[id].root, CHORDS[id].quality);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {id}
    </button>
  );
}
