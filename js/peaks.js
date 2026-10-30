/* RingtoneLab — waveform peak computation. Pure: no DOM, no audio APIs. */

/**
 * Downsample audio to `bucketCount` peak values in [0, 1] for drawing.
 * Takes an array of channels and keeps the loudest absolute sample per
 * bucket across all channels, so stereo content never looks quieter
 * than it is. Empty input yields all-zero buckets, never a throw.
 */
export function computePeaks(channels, bucketCount) {
  const count = Math.max(1, Math.floor(bucketCount) || 1);
  const peaks = new Float32Array(count);
  const usable = (channels || []).filter((ch) => ch && ch.length > 0);
  if (usable.length === 0) return peaks;
  const maxLength = Math.max(...usable.map((ch) => ch.length));
  const perBucket = maxLength / count;
  for (let b = 0; b < count; b += 1) {
    const from = Math.floor(b * perBucket);
    const to = Math.max(from + 1, Math.floor((b + 1) * perBucket));
    let peak = 0;
    for (const ch of usable) {
      for (let i = from; i < to && i < ch.length; i += 1) {
        const v = Math.abs(ch[i]);
        if (v > peak) peak = v;
      }
    }
    peaks[b] = Math.min(1, peak);
  }
  return peaks;
}
