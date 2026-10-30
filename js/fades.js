/* RingtoneLab — fade maths and sample-level fade application. Pure. */

/**
 * Linear fade gain at time `t` inside a selection [start, end].
 * fadeIn/fadeOut are seconds; 0 means no fade on that side. Outside the
 * selection the gain is 0. Fades longer than the selection are capped
 * at the selection length so the two ramps can never invert each other.
 * At the exact midpoint of overlapping ramps the smaller gain wins,
 * which keeps the curve continuous and never above 1.
 */
export function fadeGainAt(t, start, end, fadeIn, fadeOut) {
  if (!Number.isFinite(t) || t < start || t > end) return 0;
  const dur = end - start;
  if (dur <= 0) return 0;
  const fi = Math.min(Math.max(fadeIn || 0, 0), dur);
  const fo = Math.min(Math.max(fadeOut || 0, 0), dur);
  let gain = 1;
  if (fi > 0 && t - start < fi) gain = Math.min(gain, (t - start) / fi);
  if (fo > 0 && end - t < fo) gain = Math.min(gain, (end - t) / fo);
  return gain;
}

/**
 * Slice one channel of audio to [start, end) seconds and apply the fade
 * envelope sample by sample. Returns a new Float32Array. Clipping is
 * not applied here: fades only ever reduce gain, so samples stay in
 * range, and the WAV encoder clamps on write.
 */
export function applyFades(channelData, sampleRate, start, end, fadeIn, fadeOut) {
  const sr = sampleRate > 0 ? sampleRate : 44100;
  const startSample = Math.max(0, Math.floor(start * sr));
  const endSample = Math.min(channelData.length, Math.ceil(end * sr));
  const length = Math.max(0, endSample - startSample);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = start + i / sr;
    out[i] = channelData[startSample + i] * fadeGainAt(t, start, end, fadeIn, fadeOut);
  }
  return out;
}
