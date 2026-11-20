"use client";

import { useEffect, useState, type ReactNode } from "react";
import { audio } from "@/lib/audio";

/**
 * Holds back the whole app until every sound — the song, the piano and the
 * feedback effects — has been fetched and decoded.
 */
export function AudioGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    audio
      .load((fraction) => alive && setProgress(fraction))
      .then(
        () => alive && setStatus("ready"),
        () => alive && setStatus("error"),
      );
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (status === "ready") return children;

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      {status === "loading" ? (
        <>
          <div className="spinner" aria-hidden="true" />
          <p className="loading-text">Tuning up…</p>
          <div className="loading-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="sr-only">Loading audio</span>
        </>
      ) : (
        <>
          <p className="loading-text">Hmm, the audio didn’t load.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setStatus("loading");
              setProgress(0);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
