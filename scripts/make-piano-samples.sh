#!/usr/bin/env bash
# Rebuilds the piano samples in public/audio/piano from the Salamander Grand
# Piano recordings hosted by Tone.js (CC BY 3.0, Alexander Holm).
#
# Salamander only ships every third semitone, so the notes in between are made
# by resampling the nearest recording up or down one semitone — the same trick
# every sampler uses. Each note is trimmed to 5s, faded out, downmixed to mono
# and peak-normalised so all keys sit at the same level.
#
# Requires: curl, ffmpeg.  Usage: scripts/make-piano-samples.sh
set -euo pipefail

SRC_URL="https://tonejs.github.io/audio/salamander"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/audio/piano"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# output-name  source-recording  semitone-shift
NOTES="
C4  C4  0
Db4 C4  1
D4  Ds4 -1
Eb4 Ds4 0
E4  Ds4 1
F4  Fs4 -1
Gb4 Fs4 0
G4  Fs4 1
Ab4 A4  -1
A4  A4  0
Bb4 A4  1
B4  C5  -1
C3  C3  0
D3  Ds3 -1
E3  Ds3 1
F3  Fs3 -1
G3  Fs3 1
A3  A3  0
"

echo "$NOTES" | while read -r name src shift; do
  [ -z "$name" ] && continue
  [ -f "$TMP/$src.mp3" ] || curl -fsS -o "$TMP/$src.mp3" "$SRC_URL/$src.mp3"
  rate=$(awk -v s="$shift" 'BEGIN { printf "%.4f", 44100 * 2 ^ (s / 12) }')
  chain="silenceremove=start_periods=1:start_threshold=-55dB,asetrate=$rate,aresample=44100,atrim=0:5,afade=t=out:st=3.8:d=1.2"
  peak=$(ffmpeg -nostdin -hide_banner -i "$TMP/$src.mp3" -ac 1 -af "$chain,volumedetect" -f null - 2>&1 |
    sed -n 's/.*max_volume: \(-\{0,1\}[0-9.]*\) dB/\1/p')
  gain=$(awk -v p="$peak" 'BEGIN { printf "%.1f", -3 - p }')
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$TMP/$src.mp3" -ac 1 \
    -af "$chain,volume=${gain}dB" -map_metadata -1 -c:a libmp3lame -b:a 96k "$OUT/$name.mp3"
  echo "$name  (from $src, ${shift} st, ${gain} dB)"
done
