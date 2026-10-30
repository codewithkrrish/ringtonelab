/* RingtoneLab — selection maths. Pure: no DOM, no audio APIs. */

export const MIN_SELECTION_SECONDS = 0.1;
export const RINGTONE_SECONDS = 30;

/**
 * Clamp a selection into [0, duration] with start < end and at least
 * MIN_SELECTION_SECONDS long. Non-finite inputs fall back to the full file.
 * Returns { start, end } in seconds.
 */
export function clampSelection(start, end, duration, minDuration = MIN_SELECTION_SECONDS) {
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (dur === 0) return { start: 0, end: 0 };
  const min = Math.min(Math.max(minDuration, 0.01), dur);
  let s = Number.isFinite(start) ? start : 0;
  let e = Number.isFinite(end) ? end : dur;
  s = Math.min(Math.max(s, 0), dur - min);
  e = Math.min(Math.max(e, s + min), dur);
  // If clamping the end pushed past the duration, pull the start back.
  if (e - s < min) s = Math.max(0, e - min);
  return { start: s, end: e };
}

/** Duration of a selection in seconds (never negative). */
export function selectionDuration(start, end) {
  return Math.max(0, (end || 0) - (start || 0));
}

/**
 * A window of `length` seconds starting at `anchor`, shifted back so it
 * fits inside the file. Used by the 30s ringtone preset: it keeps the
 * user's current position and only moves when the window would overrun.
 */
export function windowFrom(anchor, length, duration) {
  if (!(duration > 0)) return { start: 0, end: 0 };
  if (duration <= length) return { start: 0, end: duration };
  const start = Math.min(Math.max(anchor, 0), duration - length);
  return { start, end: start + length };
}

/** The 30s ringtone preset, anchored at the current selection start. */
export function ringtonePreset(anchor, duration) {
  return windowFrom(anchor, RINGTONE_SECONDS, duration);
}

/** First 30 seconds of the file (or the whole file if shorter). */
export function first30(duration) {
  return { start: 0, end: Math.min(RINGTONE_SECONDS, duration) };
}

/** Last 30 seconds of the file (or the whole file if shorter). */
export function last30(duration) {
  return { start: Math.max(0, duration - RINGTONE_SECONDS), end: duration };
}

/** The whole file. */
export function fullFile(duration) {
  return { start: 0, end: duration };
}
