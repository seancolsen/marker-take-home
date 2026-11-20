// A tiny Web Audio engine shared by the whole app. It owns one AudioContext,
// every decoded sample, and the looping song transport.
//
// Everything is fetched and decoded up front (see <AudioGate>), so by the time
// any page renders, playing a sound is synchronous.

import {
  BASS_SAMPLES,
  NOTE_SAMPLES,
  SONG,
  triadNotes,
  type Quality,
} from "./music";

export type Sfx = "correct" | "incorrect" | "celebrate";

/** A sounding note (or chord). Call release() to let it ring out briefly. */
export type Voice = { release: () => void };

const PIANO_FILES = [...NOTE_SAMPLES, ...Object.values(BASS_SAMPLES)];
const SFX_FILES: Sfx[] = ["correct", "incorrect", "celebrate"];

// The song is mastered loud; pull it back so the piano can sit on top of it.
const SONG_GAIN = 0.5;
const NOTE_GAIN = 0.95;
const SFX_GAIN: Record<Sfx, number> = {
  correct: 0.55,
  incorrect: 0.6,
  celebrate: 0.9,
};

/** How quickly a released key dies away (time constant, seconds). */
const RELEASE = 0.07;

const WAVEFORM_BARS = 160;

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  /** Seconds of (near) silence to skip at the head of each piano sample. */
  private onsets = new Map<string, number>();
  private loading: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  // Song transport
  private songSource: AudioBufferSourceNode | null = null;
  private songGain: GainNode | null = null;
  private songOffset = 0;
  private songStartedAt = 0;
  private lastScrub = 0;
  private pendingScrub: number | null = null;

  playing = false;
  duration = 0;
  /** Normalised peak per bar, for drawing the waveform. */
  peaks: number[] = [];

  // -- Loading --------------------------------------------------------------

  load(onProgress?: (fraction: number) => void): Promise<void> {
    if (!this.loading) {
      this.loading = this.loadAll(onProgress).catch((err) => {
        this.loading = null; // allow a retry
        throw err;
      });
    }
    return this.loading;
  }

  private async loadAll(onProgress?: (fraction: number) => void) {
    // Decode with an offline context so nothing has to wait for (or warn
    // about) a user gesture. Decoding at the song's own sample rate also
    // keeps its loop points exact.
    const decoder = new OfflineAudioContext(1, 1, 44100);
    const files: [string, string][] = [
      ["song", SONG.url],
      ...PIANO_FILES.map((n): [string, string] => [n, `/audio/piano/${n}.mp3`]),
      ...SFX_FILES.map((n): [string, string] => [n, `/audio/sfx/${n}.mp3`]),
    ];
    let done = 0;
    await Promise.all(
      files.map(async ([key, url]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
        const buffer = await decoder.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(key, buffer);
        done += 1;
        onProgress?.(done / files.length);
      }),
    );

    const song = this.buffers.get("song")!;
    this.duration = song.duration;
    this.peaks = computePeaks(song, WAVEFORM_BARS);
    for (const name of PIANO_FILES) {
      this.onsets.set(name, findOnset(this.buffers.get(name)!));
    }

    // Browsers only let audio start from a user gesture — and a touch only
    // counts once the finger lifts — so listen for all of them.
    const unlock = () => this.unlock();
    for (const type of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    }
  }

  /** The live AudioContext, created the first time something needs it. */
  private get ctx(): AudioContext {
    if (this.context) return this.context;
    const ctx = new AudioContext({ latencyHint: "interactive" });
    // A gentle safety limiter: only kicks in when a chord lands on a loud bar.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    this.master = ctx.createGain();
    this.master.connect(limiter).connect(ctx.destination);
    this.context = ctx;
    return ctx;
  }

  unlock() {
    if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
  }

  // -- Subscriptions (play/pause state) --------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    for (const l of this.listeners) l();
  }

  // -- Song transport ---------------------------------------------------------

  /** Current playhead position in seconds. */
  position(): number {
    if (!this.playing || !this.duration) return this.songOffset;
    const t = this.songOffset + (this.ctx.currentTime - this.songStartedAt);
    return t % this.duration;
  }

  play() {
    if (this.playing || !this.duration) return;
    this.unlock();
    this.startSong(this.songOffset);
    this.playing = true;
    this.emit();
  }

  pause() {
    if (!this.playing) return;
    this.songOffset = this.position();
    this.stopSong();
    this.playing = false;
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(seconds: number) {
    if (!this.duration) return;
    const t = ((seconds % this.duration) + this.duration) % this.duration;
    this.pendingScrub = null;
    if (this.playing) {
      this.stopSong();
      this.startSong(t);
    } else {
      this.songOffset = t;
    }
  }

  /**
   * Seek while dragging. Rate-limited so a fast drag doesn't restart the
   * source on every pointer event; when paused, a short grain of audio is
   * played so scrubbing is still audible.
   */
  scrub(seconds: number) {
    const now = performance.now();
    if (now - this.lastScrub < 70) {
      this.pendingScrub = seconds;
      if (!this.playing) this.songOffset = seconds;
      return;
    }
    this.lastScrub = now;
    this.seek(seconds);
    if (!this.playing) this.playGrain(seconds);
  }

  endScrub() {
    if (this.pendingScrub !== null) this.seek(this.pendingScrub);
  }

  private startSong(offset: number) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.buffers.get("song")!;
    source.loop = true; // sample-accurate, gapless looping
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(SONG_GAIN, now + 0.012);
    source.connect(gain).connect(this.master!);
    source.start(0, offset);
    this.songSource = source;
    this.songGain = gain;
    this.songOffset = offset;
    this.songStartedAt = now;
  }

  private stopSong() {
    const ctx = this.ctx;
    const source = this.songSource;
    const gain = this.songGain;
    if (!source || !gain) return;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.015);
    source.stop(now + 0.02);
    this.songSource = null;
    this.songGain = null;
  }

  private playGrain(offset: number) {
    const ctx = this.ctx;
    this.unlock();
    const source = ctx.createBufferSource();
    source.buffer = this.buffers.get("song")!;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(SONG_GAIN, now + 0.01);
    gain.gain.setValueAtTime(SONG_GAIN, now + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + 0.16);
    source.connect(gain).connect(this.master!);
    source.start(0, offset, 0.17);
  }

  // -- Piano ------------------------------------------------------------------

  /** Start one sample. `rate` 0.5 plays it an octave lower. */
  private startSample(name: string, gain: number, delay = 0, rate = 1): Voice {
    const buffer = this.buffers.get(name);
    if (!buffer) return { release() {} };
    const ctx = this.ctx;
    this.unlock();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(amp).connect(this.master!);
    source.start(ctx.currentTime + delay, this.onsets.get(name) ?? 0);
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        // Like a damper falling back onto the string: a quick exponential
        // fade rather than an abrupt cut.
        const now = ctx.currentTime;
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(amp.gain.value, now);
        amp.gain.setTargetAtTime(0, now, RELEASE);
        source.stop(now + RELEASE * 8);
      },
    };
  }

  /** Play a single note (pitch class 0–11) in the octave above middle C. */
  noteOn(pitchClass: number): Voice {
    return this.startSample(NOTE_SAMPLES[pitchClass], NOTE_GAIN);
  }

  /** Play a triad: the root down in the bass, the three notes above it. */
  chordOn(root: number, quality: Quality): Voice {
    const bass = BASS_SAMPLES[root];
    const voices = [
      bass
        ? this.startSample(bass, 0.7)
        : this.startSample(NOTE_SAMPLES[root], 0.7, 0, 0.5),
      // A very slight roll makes it sound played rather than triggered.
      ...triadNotes(root, quality).map((pc, i) =>
        this.startSample(NOTE_SAMPLES[pc], 0.5, 0.012 * (i + 1)),
      ),
    ];
    return { release: () => voices.forEach((v) => v.release()) };
  }

  /** Play a chord briefly — for taps and "click into place" previews. */
  chordTap(root: number, quality: Quality, seconds = 0.9) {
    const voice = this.chordOn(root, quality);
    window.setTimeout(voice.release, seconds * 1000);
  }

  // -- Feedback sounds --------------------------------------------------------

  sfx(name: Sfx) {
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const ctx = this.ctx;
    this.unlock();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = SFX_GAIN[name];
    source.connect(gain).connect(this.master!);
    source.start();
  }
}

function computePeaks(buffer: AudioBuffer, bars: number): number[] {
  const data = buffer.getChannelData(0);
  const size = Math.floor(data.length / bars);
  const peaks: number[] = [];
  let max = 0;
  for (let b = 0; b < bars; b++) {
    // RMS reads as "how loud" better than the raw peak does.
    let sum = 0;
    for (let i = b * size; i < (b + 1) * size; i += 8) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / (size / 8));
    peaks.push(rms);
    if (rms > max) max = rms;
  }
  return peaks.map((p) => (max ? p / max : 0));
}

/** MP3 decoders may leave a few ms of padding; find where the note starts. */
function findOnset(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.25));
  for (let i = 0; i < limit; i++) {
    if (Math.abs(data[i]) > 0.01) {
      return Math.max(0, i / buffer.sampleRate - 0.002);
    }
  }
  return 0;
}

/** The one shared engine. Only touch it from the browser. */
export const audio = new AudioEngine();
