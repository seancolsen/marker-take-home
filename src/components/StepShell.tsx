"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CHORDS, STEPS, type ChordId } from "@/lib/music";
import { StartOverLink } from "./tutorial";

export type Feedback = {
  kind: "hint" | "good" | "oops";
  text: ReactNode;
  /** Bump to replay the pop animation, even when the text repeats. */
  id?: number;
};

const FACES: Record<Feedback["kind"], string> = { hint: "🎧", good: "🎉", oops: "🤔" };

/** A small chip for an answer. Chords get their own colour. */
export function AnswerChip({ label, chord = false }: { label: string; chord?: boolean }) {
  const color = chord ? CHORDS[label as ChordId]?.color : undefined;
  return (
    <span
      className="answer-chip"
      style={color ? ({ "--chord": color } as CSSProperties) : undefined}
    >
      {label}
    </span>
  );
}

/**
 * The frame around every step: the lesson on the left, and on the right the
 * persistent column showing where you are, what you've worked out so far,
 * the coach's feedback, and the way forward.
 */
export function StepShell({
  step,
  title,
  solved,
  feedback,
  children,
}: {
  /** 0-based index into STEPS. */
  step: number;
  title: string;
  solved: boolean;
  feedback: Feedback;
  children: ReactNode;
}) {
  const next = STEPS[step + 1];
  const isLast = !next;

  return (
    <div className="step-page">
      <main className="step-main">
        <h1 className="step-title">{title}</h1>
        {children}
      </main>

      <aside className="step-side">
        <p className="side-brand">
          <span aria-hidden="true">🎵</span> How to analyze a song’s chord progression
        </p>

        <nav aria-label="Tutorial steps">
          <ol className="steps">
            {STEPS.map((s, i) => {
              const state = i < step ? "done" : i === step ? "current" : "todo";
              const showAnswer = i < step || (i === step && solved);
              const name = <span className="step-name">{s.name}</span>;
              return (
                <li
                  key={s.slug}
                  className="step-item"
                  data-state={state}
                  data-solved={showAnswer || undefined}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  <span className="step-dot" aria-hidden="true">
                    {showAnswer ? "✓" : i + 1}
                  </span>
                  <div className="step-text">
                    {state === "done" ? <Link href={s.slug}>{name}</Link> : name}
                    {showAnswer && (
                      <span className="step-answer" key="answer">
                        <span className="sr-only">Answer: </span>
                        {s.answer.map((a, j) => (
                          <AnswerChip key={j} label={a} chord={i >= 2} />
                        ))}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="side-bottom">
          <div className="coach" data-kind={feedback.kind} aria-live="polite">
            <span className="coach-face" aria-hidden="true" key={`f${feedback.id ?? 0}${feedback.kind}`}>
              {FACES[feedback.kind]}
            </span>
            <p className="coach-bubble" key={`b${feedback.id ?? 0}${feedback.kind}`}>
              {feedback.text}
            </p>
          </div>

          {!isLast &&
            (solved ? (
              <Link href={next.slug} className="btn btn-primary btn-next" data-ready>
                Next <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <span className="btn btn-primary btn-next" aria-disabled="true" role="link">
                Next <span aria-hidden="true">→</span>
              </span>
            ))}

          <StartOverLink />
        </div>
      </aside>
    </div>
  );
}
