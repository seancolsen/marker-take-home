// Everything "musical" about the tutorial lives here: note names, the two
// scales we compare, the six chords of C major, and the answer key.

/** Pitch classes, 0 = C. Black notes are spelled with flats throughout. */
export const NOTE_NAMES = [
  "C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B",
] as const;

/** Sample file names for the octave starting at middle C. */
export const NOTE_SAMPLES = [
  "C4", "Db4", "D4", "Eb4", "E4", "F4", "Gb4", "G4", "Ab4", "A4", "Bb4", "B4",
] as const;

/** Bass roots (an octave below) used to anchor chords. B has no recording. */
export const BASS_SAMPLES: Record<number, string> = {
  0: "C3", 2: "D3", 4: "E3", 5: "F3", 7: "G3", 9: "A3",
};

export const IS_BLACK = [
  false, true, false, true, false, false, true, false, true, false, true, false,
];

export const INTERVAL_NAMES = [
  "tonal center", "minor 2nd", "major 2nd", "minor 3rd", "major 3rd",
  "perfect 4th", "tritone", "perfect 5th", "minor 6th", "major 6th",
  "minor 7th", "major 7th",
] as const;

export type Quality = "major" | "minor";

export const SCALES: Record<Quality, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

export const TRIADS: Record<Quality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
};

export const CHORD_IDS = ["C", "Dm", "Em", "F", "G", "Am"] as const;
export type ChordId = (typeof CHORD_IDS)[number];

export const CHORDS: Record<
  ChordId,
  { root: number; quality: Quality; color: string }
> = {
  C: { root: 0, quality: "major", color: "#ff7b7b" },
  Dm: { root: 2, quality: "minor", color: "#ffa552" },
  Em: { root: 4, quality: "minor", color: "#ffd24a" },
  F: { root: 5, quality: "major", color: "#4fd6a8" },
  G: { root: 7, quality: "major", color: "#56bdf5" },
  Am: { root: 9, quality: "minor", color: "#b29bff" },
};

export function triadNotes(root: number, quality: Quality): number[] {
  return TRIADS[quality].map((i) => (root + i) % 12);
}

export function chordLabel(root: number, quality: Quality): string {
  return NOTE_NAMES[root] + (quality === "minor" ? "m" : "");
}

/** The ChordId for a root + quality, if it is one of the six that fit. */
export function chordIdFor(root: number, quality: Quality): ChordId | null {
  return (
    CHORD_IDS.find(
      (id) => CHORDS[id].root === root && CHORDS[id].quality === quality,
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// The song
// ---------------------------------------------------------------------------

export const SONG = {
  title: "Count on Me",
  artist: "Bruno Mars",
  url: "/audio/count-on-me.wav",
};

/**
 * The chord progression of the excerpt — the tutorial's "final answer".
 * This is what the recording actually contains (see REGION_BOUNDS below).
 */
export const PROGRESSION: ChordId[] = [
  "C", "Em", "Am", "G", "F", "C", "Em", "Am", "G", "F",
];

/**
 * Where each chord starts in the excerpt, in seconds, plus the end of the
 * last one.
 *
 * Found by spectral analysis of the recording — run
 * `python3 scripts/analyze-chords.py` to reproduce these numbers. In short:
 * the tempo is a steady 89 BPM (the loop is exactly 8 bars), the bass guitar
 * plays the root of each chord, and these are the beats on which the bass
 * note changes. Every change lands on a bar line or a half bar.
 *
 * The excerpt opens with a one-beat pickup ("You can…") before the first
 * downbeat, so the first region doesn't start at zero. Because the audio
 * loops, that pickup is really the tail end of the final bar.
 */
export const REGION_BOUNDS: number[] = [
  0.756, 3.452, 6.149, 7.498, 8.846, 11.543, 14.239, 16.936, 18.285, 19.633,
  21.574,
];

// ---------------------------------------------------------------------------
// The steps
// ---------------------------------------------------------------------------

export const STEPS = [
  { slug: "/tonal-center", name: "Tonal center", answer: ["C"] },
  { slug: "/scale", name: "Scale", answer: ["Major"] },
  {
    slug: "/available-chords",
    name: "Available chords",
    answer: [...CHORD_IDS] as string[],
  },
  {
    slug: "/chord-progression",
    name: "Chord progression",
    answer: [...PROGRESSION] as string[],
  },
] as const;
