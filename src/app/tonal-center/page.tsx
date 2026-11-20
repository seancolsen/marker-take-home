"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { StepShell, type Feedback } from "@/components/StepShell";
import { Timeline } from "@/components/Timeline";
import { Fresh } from "@/components/tutorial";
import { capture } from "@/components/useKeyPointers";
import { audio, type Voice } from "@/lib/audio";
import { IS_BLACK, NOTE_NAMES } from "@/lib/music";

export default function Page() {
  return (
    <Fresh>
      <TonalCenter />
    </Fresh>
  );
}

const TONIC = 0; // C

type Box = "no" | "maybe" | "yes";
const BOXES: { id: Box; label: string; icon: string }[] = [
  { id: "no", label: "No", icon: "✕" },
  { id: "maybe", label: "Maybe", icon: "?" },
  { id: "yes", label: "Yes", icon: "✓" },
];

type Point = { x: number; y: number };

const START: Feedback = {
  kind: "hint",
  text: "Press play, then tap around on the piano. Which note sounds like home?",
};

/** A gentle nudge for each wrong guess, tailored to how that note behaves. */
function nudge(pc: number): string {
  const name = NOTE_NAMES[pc];
  switch (pc) {
    case 2:
      return "Not quite! D fits in the song, but it’s leaning — it wants to step to a neighbor. Follow it and see where it settles.";
    case 4:
      return "Ooh, close! E blends in beautifully because it’s great friends with the home note. But listen for where the melody comes to rest — it’s a bit lower.";
    case 5:
      return "Not quite! F belongs in this song, but it feels like it wants to fall. Home is somewhere more settled.";
    case 7:
      return "Great ear! G sounds strong because it’s the home note’s best buddy. But hum the note where the tune feels finished… is it really G?";
    case 9:
      return "Nice try! A turns up a lot in this song, but it sounds wistful and unfinished. Keep hunting for the note that says “The End”.";
    case 11:
      return "So close you can taste it! B is itching to climb one tiny step up. Try the note it’s reaching for.";
    default:
      return `Hmm, ${name} rubs against the song a bit — hear the clash? I’ve popped it in “No”. Try the notes that blend in more smoothly.`;
  }
}

/** Animate an element from a point on screen to wherever it now sits. */
function flyFrom(el: HTMLElement, from: Point, scale = 1) {
  const rect = el.getBoundingClientRect();
  const dx = from.x - (rect.left + rect.width / 2);
  const dy = from.y - (rect.top + rect.height / 2);
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, zIndex: 30 },
      { transform: "translate(0, 0) scale(1)", zIndex: 30 },
    ],
    { duration: 430, easing: "cubic-bezier(0.2, 0.85, 0.3, 1.12)" },
  );
}

function TonalCenter() {
  const [placed, setPlaced] = useState<{ pc: number; box: Box }[]>([]);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(START);
  const [held, setHeld] = useState<number[]>([]);
  const [hover, setHover] = useState<Box | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);

  const chipEls = useRef(new Map<number, HTMLButtonElement>());
  const boxEls = useRef<Partial<Record<Box, HTMLDivElement | null>>>({});
  /** Chips that should fly in from somewhere after the next render. */
  const flights = useRef(new Map<number, { from: Point; scale: number }>());
  const drags = useRef(
    new Map<number, { pc: number; voice: Voice; x0: number; y0: number; el: HTMLButtonElement }>(),
  );
  const timers = useRef<number[]>([]);
  const feedbackId = useRef(0);

  const say = (kind: Feedback["kind"], text: string) =>
    setFeedback({ kind, text, id: ++feedbackId.current });

  useLayoutEffect(() => {
    flights.current.forEach(({ from, scale }, pc) => {
      const el = chipEls.current.get(pc);
      if (el) flyFrom(el, from, scale);
    });
    flights.current.clear();
  });

  useEffect(() => {
    const active = drags.current;
    const pending = timers.current;
    return () => {
      active.forEach((d) => d.voice.release());
      active.clear();
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const boxOf = (pc: number) => placed.find((p) => p.pc === pc)?.box;
  const isLocked = (pc: number) => solved && pc === TONIC && boxOf(pc) === "yes";

  // -- Piano → a new bubble floats up into "Maybe" ---------------------------

  const onPianoPress = (pc: number, origin: Point) => {
    if (boxOf(pc)) {
      // Already sorted: just give its bubble a little bounce.
      chipEls.current
        .get(pc)
        ?.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
          { duration: 260, easing: "ease-out" },
        );
      return;
    }
    flights.current.set(pc, { from: origin, scale: 0.7 });
    setPlaced((p) => (p.some((x) => x.pc === pc) ? p : [...p, { pc, box: "maybe" }]));
  };

  // -- Dragging bubbles between boxes -----------------------------------------

  const boxAt = (x: number, y: number): Box | null => {
    for (const { id } of BOXES) {
      const rect = boxEls.current[id]?.getBoundingClientRect();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top - 8 && y <= rect.bottom + 8) {
        return id;
      }
    }
    return null;
  };

  const onChipDown = (e: PointerEvent<HTMLButtonElement>, pc: number) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    capture(e.currentTarget, e.pointerId);
    drags.current.set(e.pointerId, {
      pc,
      voice: audio.noteOn(pc),
      x0: e.clientX,
      y0: e.clientY,
      el: e.currentTarget,
    });
    setHeld((h) => [...h, pc]);
  };

  const onChipMove = (e: PointerEvent<HTMLButtonElement>) => {
    const drag = drags.current.get(e.pointerId);
    if (!drag || isLocked(drag.pc)) return;
    drag.el.style.transform = `translate(${e.clientX - drag.x0}px, ${e.clientY - drag.y0}px) scale(1.14)`;
    drag.el.style.zIndex = "30";
    setHover(boxAt(e.clientX, e.clientY));
  };

  const onChipUp = (e: PointerEvent<HTMLButtonElement>) => {
    const drag = drags.current.get(e.pointerId);
    if (!drag) return;
    const { pc, el } = drag;
    drags.current.delete(e.pointerId);
    drag.voice.release();
    setHeld((h) => {
      const i = h.indexOf(pc);
      return i < 0 ? h : [...h.slice(0, i), ...h.slice(i + 1)];
    });
    setHover(null);

    const rect = el.getBoundingClientRect();
    const from = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    el.style.transform = "";
    el.style.zIndex = "";

    const target = e.type === "pointercancel" ? null : boxAt(e.clientX, e.clientY);
    const accepts =
      target !== null && target !== boxOf(pc) && !isLocked(pc) && !(target === "yes" && solved);
    if (!accepts) {
      flyFrom(el, from, 1.14); // glide back to where it was
      return;
    }
    flights.current.set(pc, { from, scale: 1.14 });
    move(pc, target);
    if (target === "yes") submit(pc);
  };

  const move = (pc: number, box: Box) =>
    setPlaced((p) => [...p.filter((x) => x.pc !== pc), { pc, box }]);

  // -- Dropping a note in "Yes" is an answer ----------------------------------

  const submit = (pc: number) => {
    if (pc === TONIC) {
      setSolved(true);
      audio.sfx("correct");
      say(
        "good",
        "Yes! C is home. Hear how the song relaxes every time it lands there? That makes C the tonal center — the tonic — of this song.",
      );
      return;
    }
    audio.sfx("incorrect");
    say("oops", nudge(pc));
    setWrong(pc);
    // Let it wobble for a moment, then file it under "No".
    timers.current.push(
      window.setTimeout(() => {
        setWrong(null);
        if ([...drags.current.values()].some((d) => d.pc === pc)) return;
        const el = chipEls.current.get(pc);
        if (el) {
          const rect = el.getBoundingClientRect();
          flights.current.set(pc, {
            from: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            scale: 1,
          });
        }
        setPlaced((p) =>
          p.some((x) => x.pc === pc && x.box === "yes")
            ? [...p.filter((x) => x.pc !== pc), { pc, box: "no" }]
            : p,
        );
      }, 950),
    );
  };

  return (
    <StepShell
      step={0}
      title="Let’s find the song’s tonal center!"
      solved={solved}
      feedback={feedback}
    >
      <div className="prose">
        <p>
          Nearly every song has a <strong>tonal center</strong> (also called the{" "}
          <strong>tonic</strong>): the one note that feels like <em>home</em>. Melodies wander away
          from it and back again, and when they land on it the music sounds settled — like the end
          of a sentence.
        </p>
        <p>
          To find it, play the song and try notes on the piano along with it. Some will clash, some
          will blend in but feel restless, and one will sound like it could be the song’s very last
          note. Sort the notes as you go, then{" "}
          <strong>drag the one that feels like home into “Yes”.</strong>
        </p>
      </div>

      <Timeline />

      <div className="dm-area">
        {placed.length === 0 ? (
          <p className="dm-empty">
            <span aria-hidden="true">🎹</span> Tap a key to try a note
            <span className="dm-empty-arrow" aria-hidden="true">
              ↓
            </span>
          </p>
        ) : (
          <div className="dm fade-in" role="group" aria-label="Is this note the tonal center?">
            {BOXES.map((box) => {
              const chips = placed.filter((p) => p.box === box.id);
              return (
                <div
                  key={box.id}
                  ref={(el) => {
                    boxEls.current[box.id] = el;
                  }}
                  className="dm-box"
                  data-box={box.id}
                  data-hover={hover === box.id || undefined}
                >
                  <span className="dm-label">
                    <span className="dm-icon" aria-hidden="true">
                      {box.icon}
                    </span>
                    {box.label}
                  </span>
                  <div className="dm-chips">
                    {chips.map(({ pc }) => (
                      <button
                        key={pc}
                        type="button"
                        ref={(el) => {
                          if (el) chipEls.current.set(pc, el);
                          else chipEls.current.delete(pc);
                        }}
                        className="note-chip"
                        data-black={IS_BLACK[pc] || undefined}
                        data-held={held.includes(pc) || undefined}
                        data-wrong={wrong === pc || undefined}
                        data-locked={isLocked(pc) || undefined}
                        aria-label={`${NOTE_NAMES[pc]} — press to hear, drag to sort`}
                        onPointerDown={(e) => onChipDown(e, pc)}
                        onPointerMove={onChipMove}
                        onPointerUp={onChipUp}
                        onPointerCancel={onChipUp}
                      >
                        {NOTE_NAMES[pc]}
                      </button>
                    ))}
                    {box.id === "yes" && chips.length === 0 && (
                      <span className="dm-drop-hint">Drag the home note here</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="piano-area">
        <PianoKeyboard onPress={onPianoPress} lit={held} />
      </div>
    </StepShell>
  );
}
