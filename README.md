
# Song analyzer

A five-page interactive lesson (a home page plus four steps) that walks a learner through working out a song's chords by ear: find the tonal center, pick the scale, find the chords that fit the scale, then place them on the song's timeline.

## Live deployment

https://song-analyzer-six.vercel.app/

## Setup

- Dev

    ```bash
    npm ci
    npm run dev
    ```

- Prod

    ```bash
    npm run lint
    npm run build
    npx serve out
    ```

## My process

1. I picked a song and created a loop of it in Audacity.
1. I wrote these [specs](./specs/initial-push/spec.md) and fed them into Fable via bbcd404187a41f23c00ebcd8501a9866b1df554e.
1. I did a very small amount of QA polish with Opus via c6a68ff31753bd7c8db6fd31917935d50b34e632 (You can see my prompt in the commit message.)

## Time spent

I'm counting my time, as in efforts spent — not as in wall clock time, because Claude spent a while on it too!

- ~3 hours for planning, audio prep, design, and writing specs (mostly via voice dictation)
- ~1 hour for QA, polish, summarization, and deployment.

## Tools or libraries used

- I used Claude Fable to build it, almost entirely in one shot
- I didn't use any additional third party libraries
- While not exactly a library or tool, I did rely on prior work of mine in building https://octavecompass.com/ both for design inspiration and as an aid in generating mockups for the initial spec.

## Process notes

- I noticed that the repo contains an earlier commit that checks in `node_modules` folder. (GitHub complained to me about large files when I pushed to my repo.) In a real project, I'd fix this by altering the commit history, but I left it as-is for this.

## Corners cut

- **Messy code**: I didn't prioritize code cleanliness and project structure at all. Lots of things are hard coded. I didn't set up any formatting. I didn't look at the lint rules. I didn't even think about type checking. These are all things that I would place a high priority on in a production application!

- **Poor load time and bandwidth usage**: The audio content is in wav format which is not great for bandwidth but was the simplest way to build it.

- **No adaptive Layout**: The page layout is optimized for landscape orientation only.

- **No cross browser testing**: I've not done any rigorous QA across different browsers and platforms and devices. I tested this to work well on Chrome on Linux.

- **No tests**: I didn't add any tests.

- **Coarse commits**: I didn't prioritize keeping commit history clean and readable.

## What I'd improve with more time

- More songs that feature other scales and other types of chords!
- Step four is admittedly the hardest step. It would be nice to find ways of guiding the user through this a bit better. One idea is to match the timbre of the chord playback with the timbre of the song's instrumentation. That would help in illuminating the harmonies and dissonance.
- Theoretically, it would be possible to make this app function with a song that the user chooses. That would be especially neat!!
- It would be cool to explain more about scale degrees and the roles that the chords at different scale degrees play in musical composition.

## Project structure

_(notes written by Fable)_

| Path | What it is |
| --- | --- |
| `src/app/` | One route per page: `/`, `/tonal-center`, `/scale`, `/available-chords`, `/chord-progression` |
| `src/components/` | The timeline, piano, circular keyboard, step frame, and the audio preloader |
| `src/lib/audio.ts` | The Web Audio engine: preloading, gapless song loop, piano voices, feedback sounds |
| `src/lib/music.ts` | Notes, scales, chords, the answer key, and the chord-region timings |
| `public/audio/` | The song excerpt, piano samples, and feedback sounds |
| `scripts/` | How the piano samples and chord-region timings were produced |

## Audio credits

_(notes written by Fable)_

- **Song excerpt** — "Count on Me" by Bruno Mars (`public/audio/count-on-me.wav`), edited to loop.
- **Piano** — [Salamander Grand Piano V3](https://github.com/sfzinstruments/SalamanderGrandPiano) by Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), from the copies hosted by [Tone.js](https://github.com/Tonejs/audio). Salamander records every third semitone; `scripts/make-piano-samples.sh` resamples the notes in between, trims each to five seconds, and normalises them.
- **Correct / incorrect sounds** — `confirmation_001` and `question_004` from [Kenney's Interface Sounds](https://kenney.nl/assets/interface-sounds), CC0.
- **Celebration jingle** — the vibraphone version of [Win Jingle](https://opengameart.org/content/win-jingle) by Fupi, CC0, transposed up a whole tone so that it ends on C.

## How the chord regions were found

_(notes written by Fable)_

`python3 scripts/analyze-chords.py` (numpy only) prints the timings used in `src/lib/music.ts`. It estimates the tempo from the onset envelope (89 BPM; the loop is exactly eight bars), tracks the strongest bass note on each beat, and reports the beats where that note changes.
