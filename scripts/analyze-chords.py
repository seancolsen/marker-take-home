#!/usr/bin/env python3
"""Find where the chords change in public/audio/count-on-me.wav.

This is how REGION_BOUNDS in src/lib/music.ts was worked out. The idea: the
bass guitar plays the root of each chord, so we follow the strongest low note
through the recording and report the moments it changes.

  1. Tempo. The clip is a seamless loop, so it holds a whole number of beats;
     we pick the beat count whose pulse shows up most strongly in the onset
     envelope.
  2. Bass note per frame. Fold the low end of a spectrogram (55-140 Hz) into
     twelve pitch classes and take the strongest.
  3. Beat grid. Slide the grid until each beat contains one clear bass note,
     then fine-tune it so the beats line up with the drum hits.
  4. Regions. Wherever the bass note changes from one beat to the next, a new
     chord starts.

Needs only numpy.   Usage: python3 scripts/analyze-chords.py
"""
import os
import wave

import numpy as np

NOTES = "C Db D Eb E F Gb G Ab A Bb B".split()
PATH = os.path.join(os.path.dirname(__file__), "..", "public", "audio", "count-on-me.wav")

with wave.open(PATH) as w:
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
duration = len(x) / sr
print(f"{len(x)} samples at {sr} Hz = {duration:.3f} s")


def spectrogram(size, hop):
    """Magnitudes of a Hann-windowed STFT; the audio is treated as a loop."""
    padded = np.concatenate([x[-size // 2:], x, x[: size // 2]])
    starts = np.arange(0, len(x), hop)
    frames = np.stack([padded[s : s + size] for s in starts]) * np.hanning(size)
    return np.abs(np.fft.rfft(frames, axis=1)), np.fft.rfftfreq(size, 1 / sr)


# -- 1. Tempo ----------------------------------------------------------------
mag, freq = spectrogram(2048, 220)
loud = np.log1p(100 * mag[:, (freq > 30) & (freq < 8000)])
onsets = np.maximum(loud - np.roll(loud, 1, axis=0), 0).sum(axis=1)
pulse = np.abs(np.fft.rfft(onsets - onsets.mean()))
# Score "k beats in the loop" by its pulse and the pulses at 2x and 4x.
beats = max(range(16, 49), key=lambda k: pulse[k] + pulse[2 * k] + pulse[4 * k])
beat = duration / beats
print(f"{beats} beats in the loop -> {60 / beat:.1f} BPM, {beats // 4} bars of 4/4")

# -- 2. Bass note per frame ----------------------------------------------------
HOP = 441  # 10 ms
mag, freq = spectrogram(16384, HOP)  # long window: 2.7 Hz resolution
low = (freq >= 55) & (freq < 140)  # the bass guitar's fundamentals
pitch_class = np.round(12 * np.log2(freq[low] / 261.626)).astype(int) % 12
chroma = np.zeros((len(mag), 12))
for pc in range(12):
    chroma[:, pc] = (mag[:, low][:, pitch_class == pc] ** 2).sum(axis=1)
chroma /= chroma.sum(axis=1, keepdims=True) + 1e-12


def beat_chroma(offset):
    """Average bass chroma inside each beat, for a grid starting at `offset`."""
    edges = np.round((offset + beat * np.arange(beats + 1)) / (HOP / sr)).astype(int)
    idx = np.arange(len(chroma))
    return np.stack([chroma[np.take(idx, range(a, b), mode="wrap")].mean(axis=0)
                     for a, b in zip(edges, edges[1:])])


# -- 3. Beat grid --------------------------------------------------------------
# Roughly: the right phase is the one where beats don't straddle two bass
# notes. Precisely: the long window above blurs time, so fine-tune the phase
# against the onset envelope — drum hits land exactly on the beat.
offsets = np.arange(0, beat, 0.01)
rough = max(offsets, key=lambda o: beat_chroma(o).max(axis=1).sum())


def onset_strength(o):
    frames = np.round((o + beat * np.arange(beats)) / (220 / sr)).astype(int)
    return np.take(onsets, frames, mode="wrap").sum()


offset = max(np.arange(rough - beat / 4, rough + beat / 4, 0.002), key=onset_strength)
roots = beat_chroma(rough).argmax(axis=1)
print(f"beat grid starts at {offset:.3f} s")
print("bass note on each beat:", " ".join(NOTES[r] for r in roots))

# -- 4. Regions ----------------------------------------------------------------
print("\nchord regions (bass note, start, length):")
changes = [i for i in range(beats) if roots[i] != roots[i - 1]]
for n, i in enumerate(changes):
    j = changes[(n + 1) % len(changes)]
    length = (j - i) % beats or beats
    start = (offset + i * beat) % duration
    print(f"  {NOTES[roots[i]]:2s}  {start:7.3f} s  {length} beat{'s' if length != 1 else ''}")
