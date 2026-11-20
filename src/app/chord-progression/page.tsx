"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Confetti } from "@/components/Confetti";
import { StepShell, type Feedback } from "@/components/StepShell";
import { Timeline } from "@/components/Timeline";
import { Fresh, StartOverLink } from "@/components/tutorial";
import { capture } from "@/components/useKeyPointers";
import { audio, type Voice } from "@/lib/audio";
import { CHORD_IDS, CHORDS, PROGRESSION, triadNotes, type ChordId } from "@/lib/music";

export default function Page() {
  return (
    <Fresh>
      <ChordProgression />
    </Fresh>
  );
}

const START: Feedback = {
  kind: "hint",
  text: "Play the song and hold down chord bubbles along with it. When one matches a segment, drag it up there!",
};

const CHEERS = ["Yes!", "Nailed it!", "Spot on!", "You got it!", "Bingo!", "Lovely!"];

function sharedNotes(a: ChordId, b: ChordId) {
  const notes = triadNotes(CHORDS[b].root, CHORDS[b].quality);
  return triadNotes(CHORDS[a].root, CHORDS[a].quality).filter((pc) => notes.includes(pc)).length;
}

function ChordProgression() {
  const [filled, setFilled] = useState<(ChordId | null)[]>(() => PROGRESSION.map(() => null));
  const [hot, setHot] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [ghost, setGhost] = useState<ChordId | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(START);

  const slotEls = useRef<(HTMLDivElement | null)[]>([]);
  const ghostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    chord: ChordId;
    voice: Voice;
    el: HTMLButtonElement;
    x: number;
    y: number;
  } | null>(null);
  const timers = useRef<number[]>([]);
  const feedbackId = useRef(0);
  const misses = useRef(0);

  const solved = filled.every(Boolean);

  const say = (kind: Feedback["kind"], text: string) =>
    setFeedback({ kind, text, id: ++feedbackId.current });

  useEffect(() => {
    const pending = timers.current;
    return () => {
      drag.current?.voice.release();
      drag.current = null;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // -- Dragging a copy of a chord bubble --------------------------------------

  const placeGhost = (x: number, y: number) => {
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1.08)`;
    }
  };

  // The ghost mounts a render after the press; put it under the pointer.
  useLayoutEffect(() => {
    if (ghost && drag.current) placeGhost(drag.current.x, drag.current.y);
  }, [ghost]);

  const slotAt = (x: number, y: number): number | null => {
    for (let i = 0; i < PROGRESSION.length; i++) {
      const rect = slotEls.current[i]?.getBoundingClientRect();
      if (!rect) continue;
      // Generous vertically: anywhere on the timeline above the slot counts.
      if (x >= rect.left && x < rect.right && y >= rect.top - rect.height * 1.3 && y <= rect.bottom + 14) {
        return i;
      }
    }
    return null;
  };

  /** Under a finger the bubble would be hidden, so float it just above. */
  const lift = (e: PointerEvent) => (e.pointerType === "mouse" ? 0 : -34);

  const onBubbleDown = (e: PointerEvent<HTMLButtonElement>, chord: ChordId) => {
    if (drag.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    capture(e.currentTarget, e.pointerId);
    drag.current = {
      id: e.pointerId,
      chord,
      voice: audio.chordOn(CHORDS[chord].root, CHORDS[chord].quality),
      el: e.currentTarget,
      x: e.clientX,
      y: e.clientY + lift(e),
    };
    setGhost(chord);
  };

  const onBubbleMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.x = e.clientX;
    d.y = e.clientY + lift(e);
    placeGhost(d.x, d.y);
    const slot = slotAt(d.x, d.y);
    setHot(slot !== null && !filled[slot] ? slot : null);
  };

  const onBubbleUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    d.voice.release();
    setHot(null);

    const slot = e.type === "pointercancel" ? null : slotAt(d.x, d.y);
    if (slot !== null && !filled[slot] && PROGRESSION[slot] === d.chord) {
      setGhost(null);
      drop(slot, d.chord);
      return;
    }
    if (slot !== null && !filled[slot]) miss(slot, d.chord);

    // Send the ghost home to its bubble.
    const home = d.el.getBoundingClientRect();
    const x = home.left + home.width / 2;
    const y = home.top + home.height / 2;
    const el = ghostRef.current;
    if (!el) return setGhost(null);
    const flight = el.animate(
      [
        { transform: el.style.transform },
        { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1)`, opacity: 0.5 },
      ],
      { duration: 240, easing: "cubic-bezier(0.3, 0, 0.3, 1)" },
    );
    flight.onfinish = flight.oncancel = () => setGhost(null);
  };

  // -- Answers ------------------------------------------------------------------

  const drop = (slot: number, chord: ChordId) => {
    const next = filled.map((c, i) => (i === slot ? chord : c));
    setFilled(next);
    const left = next.filter((c) => !c).length;
    if (left === 0) {
      audio.sfx("celebrate");
      say(
        "good",
        "You did it — that’s the whole chord progression! Press play and listen to the chords go by.",
      );
      return;
    }
    audio.sfx("correct");
    const cheer = CHEERS[(next.length - left - 1) % CHEERS.length];
    say("good", `${cheer} Segment ${slot + 1} is ${chord}. ${left === 1 ? "Just one more to go!" : `${left} to go.`}`);
  };

  const miss = (slot: number, chord: ChordId) => {
    audio.sfx("incorrect");
    setWrong(slot);
    timers.current.push(window.setTimeout(() => setWrong(null), 600));
    const n = slot + 1;
    if (sharedNotes(chord, PROGRESSION[slot]) === 2) {
      say(
        "oops",
        `Ooh, so close! ${chord} shares two of its three notes with the chord in segment ${n}, so they’re easy to mix up. Listen for the lowest note there.`,
      );
      return;
    }
    const nudges = [
      `Not quite — segment ${n} isn’t ${chord}. Loop that bit and hold each chord over it; the right one will melt right in.`,
      `Not ${chord} this time! Try humming the lowest note you hear in segment ${n}, then find the chord named after it.`,
      `Good guess, but ${chord} doesn’t quite sit in segment ${n}. Trust your ears — which bubble disappears into the song there?`,
    ];
    say("oops", nudges[misses.current++ % nudges.length]);
  };

  return (
    <StepShell
      step={3}
      title="Let’s work out the chord progression!"
      solved={solved}
      feedback={feedback}
    >
      <div className="prose">
        <p>
          We know which six chords this song has to choose from, so all that’s left is to hear
          where each one goes. The timeline below is split into ten segments, one for each chord
          change. Press and hold a chord bubble to hear it over the song and, when it matches,{" "}
          <strong>drag it into its segment.</strong> Tip: listen to the lowest notes — the bass
          usually plays the note the chord is named after.
        </p>
      </div>

      <Timeline
        slots={filled.map((chord, i) => ({ chord, hot: hot === i, wrong: wrong === i }))}
        slotRef={(i, el) => {
          slotEls.current[i] = el;
        }}
      />

      <div className="bubbles-area">
        <div className="bubbles" role="group" aria-label="Chords to drag into the timeline">
          {CHORD_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="chord-bubble"
              style={{ "--chord": CHORDS[id].color } as CSSProperties}
              data-held={ghost === id || undefined}
              aria-label={`${id} chord — hold to hear, drag to a segment`}
              onPointerDown={(e) => onBubbleDown(e, id)}
              onPointerMove={onBubbleMove}
              onPointerUp={onBubbleUp}
              onPointerCancel={onBubbleUp}
            >
              {id}
            </button>
          ))}
        </div>

        {solved && (
          <div className="celebrate pop-in">
            <span className="celebrate-emoji" aria-hidden="true">
              🎉
            </span>
            <div>
              <h2>You analyzed a song by ear!</h2>
              <p>
                Tonal center, scale, chords, progression — that’s exactly how musicians figure
                songs out. Try it on a song you love next.
              </p>
            </div>
            <StartOverLink className="btn btn-primary" />
          </div>
        )}
      </div>

      {ghost && (
        <div
          ref={ghostRef}
          className="chord-bubble chord-ghost"
          style={{ "--chord": CHORDS[ghost].color } as CSSProperties}
          aria-hidden="true"
        >
          {ghost}
        </div>
      )}
      {solved && <Confetti />}
    </StepShell>
  );
}
