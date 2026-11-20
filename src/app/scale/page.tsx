"use client";

import { useRef, useState } from "react";
import { NoteCircle, polar, useTween } from "@/components/NoteCircle";
import { StepShell, type Feedback } from "@/components/StepShell";
import { Timeline } from "@/components/Timeline";
import { Fresh } from "@/components/tutorial";
import { audio } from "@/lib/audio";
import { SCALES, type Quality } from "@/lib/music";

export default function Page() {
  return (
    <Fresh>
      <Scale />
    </Fresh>
  );
}

const RING = 108;
const KEY_RADIUS = 22;
/** The polygon's corners sit just inside the keys. */
const POLYGON_RADIUS = RING - KEY_RADIUS - 6;

const ALL_NOTES = Array<boolean>(12).fill(true);

const START: Feedback = {
  kind: "hint",
  text: "Try each scale on for size. Play its third along with the song — which one fits?",
};

function Scale() {
  const [trying, setTrying] = useState<Quality | null>(null);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(START);
  const feedbackId = useRef(0);

  const scale = trying ? SCALES[trying] : null;
  const enabled = scale ? ALL_NOTES.map((_, pc) => scale.includes(pc)) : ALL_NOTES;
  // Both scales have seven notes, so one polygon can morph into the other.
  const angles = useTween(scale ? scale.map((pc) => pc * 30) : null);

  const choose = () => {
    const id = ++feedbackId.current;
    if (trying === "major") {
      setSolved(true);
      audio.sfx("correct");
      setFeedback({
        kind: "good",
        id,
        text: (
          <>
            Yes the scale is major! With the tonal center of “C” and the scale of “major”, now we
            can say that this song is in the <strong>key</strong> of <strong>C major</strong>.
          </>
        ),
      });
    } else {
      audio.sfx("incorrect");
      setFeedback({
        kind: "oops",
        id,
        text: "Not quite! Hold E♭ — the minor third — while the song plays. Hear it rub against the tune? Now switch to major and try its third, E.",
      });
    }
  };

  const chosen = solved && trying === "major";

  return (
    <StepShell
      step={1}
      title="Let’s figure out what scale this song is in!"
      solved={solved}
      feedback={feedback}
    >
      <div className="prose">
        <p>
          A scale is a way of narrowing down the twelve possible notes to a smaller set — usually
          seven — which are featured in the song. Each scale is defined by its pattern of
          “intervals” (i.e. the number of steps between consecutive notes in the scale). We can
          visualize a scale as a polygon within the circle of all notes.
        </p>
        <p>
          There are hundreds of different musical scales, but we’ll look at the two most common:
          “major” and “minor”. Try each of these scales out, to see which notes it enables. With
          each scale, try playing the thirds while listening to the song. Does it sound like this
          song has a minor third (E♭) or a major third (E)?{" "}
          <strong>Choose this scale that fits the song.</strong>
        </p>
      </div>

      <Timeline />

      <div className="picker">
        <NoteCircle
          enabled={enabled}
          ring={RING}
          keyRadius={KEY_RADIUS}
          showIntervals
          label="Circular keyboard: all twelve notes, with C at the top"
          under={
            angles && (
              <g className="poly-pop">
                <polygon
                  className="scale-poly"
                  points={angles.map((a) => polar(a, POLYGON_RADIUS).join(",")).join(" ")}
                />
              </g>
            )
          }
        >
          {trying && (
            <button
              type="button"
              key={trying}
              className="choose-btn pop-in"
              data-chosen={chosen || undefined}
              onClick={choose}
            >
              {chosen ? "✓ Major" : `Choose ${trying}`}
            </button>
          )}
        </NoteCircle>

        <div className="seg" role="group" aria-label="Scale to try">
          {(["minor", "major"] as const).map((quality) => (
            <button
              key={quality}
              type="button"
              className="seg-btn"
              aria-pressed={trying === quality}
              onClick={() => setTrying(quality)}
            >
              Try {quality}
            </button>
          ))}
        </div>
      </div>
    </StepShell>
  );
}
