# Frontend Take-Home: Teach Me

Build a small interactive tutorial that teaches us something you know well. Choose a topic you have unique or extensive knowledge of. It can be professional, personal, serious, or fun.

For example, if you’re an experienced horseback rider, you might teach the steps involved in approaching a jump. If you’re a chef, you might teach someone how to chop an onion. Choose something that lets you demonstrate how you think about teaching and interaction, rather than simply displaying an article.

## Time Limit

Spend **no more than 4 hours total**, including planning, building, and documenting your work. You don’t need to use all four hours. We’d rather see a focused, polished experience than a broad, unfinished one.

## Requirements

Your tutorial should:

- Guide a learner through a sequence of steps or concepts.
- Include at least one meaningful interaction beyond navigating between steps. For example, a learner might make a choice, practice a skill, answer a question, or receive feedback based on an action.
- Make it clear where the learner is and what to do next.
- Work well on a recent desktop browser and a smaller screen.
- Be either hosted at a publicly accessible URL **or** straightforward to run locally with documented setup instructions.

A backend, database, authentication, and production infrastructure are **not required**. It’s fine to use mock or local data.

## Starter Project

The provided starter is a Next.js app using TypeScript, App Router, Tailwind CSS, and ESLint. You may add libraries or adapt the starter as needed.

### Local Development

Use Node.js 22 LTS or newer. From the `teach-me-candidate` directory, run:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You can start editing `src/app/page.tsx`; the shared layout and styles are in `src/app/layout.tsx` and `src/app/globals.css`.

No environment variables are required for the starter. Its `next/font/google` configuration for Geist requires network access during the build.

### Checks and Production Build

```bash
npm run lint
npm run build
npm start
```

### Optional Deployment to Vercel

1. Import your Git repository into [Vercel](https://vercel.com/new).
2. Set the **Root Directory** to `./`.
3. Use the automatically detected **Next.js** framework preset and default build settings.
4. Deploy.

Alternatively, run `npx vercel` from the starter directory and follow the prompts to create a preview deployment. Use `npx vercel --prod` for production. Hosting is optional if your app is easy to run locally.

## AI and Other Tools

You may use AI tools, documentation, and third-party libraries. Briefly tell us what you used and how. Be prepared to explain your implementation and the decisions you made.

## What to Submit

Please provide:

1. A link to your source code and, if hosted, the live app.
2. A short README with setup and run instructions, approximate time spent, and any significant tools or libraries used.
3. A few notes on the tradeoffs you made, what you would improve with more time, and any known limitations.

## What We’ll Look For

We’ll discuss your work with you. We’re interested in the quality of the learning experience and interaction, thoughtful frontend implementation, usability and accessibility, and how you prioritize and explain tradeoffs within a limited time. We’re not judging the topic you choose or expecting a production-ready application.

---

# The tutorial: How to analyze a song's chord progression

A five-page interactive lesson (a home page plus four steps) that walks a learner through working out a song's chords by ear: find the tonal center, pick the scale, find the chords that fit the scale, then place them on the song's timeline. The spec it was built from is in [`specs/initial-push/spec.md`](specs/initial-push/spec.md).

## Run it

```bash
npm ci
npm run dev        # http://localhost:3000
```

```bash
npm run lint
npm run build      # writes a fully static site to out/
npx serve out      # preview the static build
```

The app is a static export (`output: "export"` in `next.config.ts`): one HTML file per route, client-side navigation between them, no server.

## Deploy to Vercel

Import the repository at [vercel.com/new](https://vercel.com/new) (or run `npx vercel`) and accept the detected **Next.js** preset. Vercel recognises the static export and serves `out/`; no extra configuration is needed.

## Where things are

| Path | What it is |
| --- | --- |
| `src/app/` | One route per page: `/`, `/tonal-center`, `/scale`, `/available-chords`, `/chord-progression` |
| `src/components/` | The timeline, piano, circular keyboard, step frame, and the audio preloader |
| `src/lib/audio.ts` | The Web Audio engine: preloading, gapless song loop, piano voices, feedback sounds |
| `src/lib/music.ts` | Notes, scales, chords, the answer key, and the chord-region timings |
| `public/audio/` | The song excerpt, piano samples, and feedback sounds |
| `scripts/` | How the piano samples and chord-region timings were produced |

## Audio credits

- **Song excerpt** — "Count on Me" by Bruno Mars (`public/audio/count-on-me.wav`), edited to loop.
- **Piano** — [Salamander Grand Piano V3](https://github.com/sfzinstruments/SalamanderGrandPiano) by Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), from the copies hosted by [Tone.js](https://github.com/Tonejs/audio). Salamander records every third semitone; `scripts/make-piano-samples.sh` resamples the notes in between, trims each to five seconds, and normalises them.
- **Correct / incorrect sounds** — `confirmation_001` and `question_004` from [Kenney's Interface Sounds](https://kenney.nl/assets/interface-sounds), CC0.
- **Celebration jingle** — the vibraphone version of [Win Jingle](https://opengameart.org/content/win-jingle) by Fupi, CC0, transposed up a whole tone so that it ends on C.

## How the chord regions were found

`python3 scripts/analyze-chords.py` (numpy only) prints the timings used in `src/lib/music.ts`. It estimates the tempo from the onset envelope (89 BPM; the loop is exactly eight bars), tracks the strongest bass note on each beat, and reports the beats where that note changes.
