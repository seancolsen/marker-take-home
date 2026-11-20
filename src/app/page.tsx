"use client";

import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { Timeline } from "@/components/Timeline";
import { Fresh, StartOverLink } from "@/components/tutorial";
import { audio } from "@/lib/audio";
import { STEPS } from "@/lib/music";

export default function Page() {
  return (
    <Fresh>
      <Home />
    </Fresh>
  );
}

function Home() {
  const playing = useSyncExternalStore(audio.subscribe, () => audio.playing, () => false);
  // Once they've pressed play, the Begin button stays, even if they pause.
  const [heard, setHeard] = useState(false);
  if (playing && !heard) setHeard(true);

  return (
    <div className="home">
      <main className="home-card">
        <div className="home-notes" aria-hidden="true">
          <span>♪</span>
          <span>♫</span>
          <span>♩</span>
        </div>
        <h1 className="home-title">How to analyze a song’s chord progression</h1>
        <p className="home-intro">
          Ever wondered how musicians can hear a song and just <em>know</em> which chords to play?
          In four hands-on steps, you’ll use your ears to work out the chords behind this little
          clip.
        </p>

        <Timeline />

        <div className="home-cta">
          {heard ? (
            <Link href={STEPS[0].slug} className="btn btn-primary btn-big pop-in">
              Begin <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <p className="home-cue">
              <span className="home-cue-arrow" aria-hidden="true">
                ↑
              </span>
              First, press play and have a listen. Drag the marker to jump around.
            </p>
          )}
        </div>
      </main>
      <StartOverLink className="home-start-over" />
    </div>
  );
}
