/* RingtoneLab — pure formatting helpers. No DOM, no audio APIs. */

/** Format seconds as m:ss.d, e.g. 65.25 -> "1:05.3". NaN guards to 0. */
export function formatTime(seconds) {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(s / 60);
  const secs = s - minutes * 60;
  const whole = Math.floor(secs);
  const tenths = Math.floor((secs - whole) * 10);
  return `${minutes}:${String(whole).padStart(2, '0')}.${tenths}`;
}

/** Format a byte count with a unit, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes) {
  const b = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  if (b < 1024) return `${b} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = b / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

/** Strip a filename's extension, e.g. "my song.mp3" -> "my song". */
export function baseName(filename) {
  const name = String(filename || 'audio');
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Export filename for a ringtone: original base + "-ringtone.wav". */
export function ringtoneFilename(filename) {
  return `${baseName(filename)}-ringtone.wav`;
}
