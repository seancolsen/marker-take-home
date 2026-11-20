"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  Fragment,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { audio } from "@/lib/audio";

const TutorialContext = createContext<{ epoch: number; startOver: () => void }>({
  epoch: 0,
  startOver: () => {},
});

/**
 * Tracks one number: how many times the learner has started over. Every page
 * keys its state on it, so bumping it wipes the whole tutorial clean.
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const [epoch, setEpoch] = useState(0);
  const startOver = useCallback(() => {
    audio.pause();
    audio.seek(0);
    setEpoch((n) => n + 1);
  }, []);
  const value = useMemo(() => ({ epoch, startOver }), [epoch, startOver]);
  return <TutorialContext value={value}>{children}</TutorialContext>;
}

/**
 * Steps don't share state, and every visit to a step begins fresh. Wrapping
 * a page in <Fresh> keys its state on the "start over" count, so Start over
 * resets it even when it's the page already on screen, and on `bfcacheId`,
 * which changes on each forward navigation — so the reset would still hold
 * if Next were configured to keep visited routes mounted.
 */
export function Fresh({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  const { epoch } = use(TutorialContext);
  return <Fragment key={`${epoch}:${bfcacheId}`}>{children}</Fragment>;
}

export function StartOverLink({ className = "" }: { className?: string }) {
  const { startOver } = use(TutorialContext);
  return (
    <Link href="/" onClick={startOver} className={`start-over ${className}`}>
      <span aria-hidden="true">↺</span> Start over
    </Link>
  );
}
