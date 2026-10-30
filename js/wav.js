/* RingtoneLab — 16-bit PCM WAV encoding. Pure: no DOM, no audio APIs. */

/** Estimated WAV size in bytes for a clip (44-byte header + PCM). */
export function estimateWavBytes(durationSeconds, sampleRate, numChannels) {
  const samples = Math.max(0, Math.ceil(durationSeconds * sampleRate));
  return 44 + samples * numChannels * 2;
}

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

/**
 * Encode channels (array of equal-length Float32Arrays, values in [-1, 1])
 * as a 16-bit PCM WAV file. Returns an ArrayBuffer. Throws on empty or
 * mismatched input so a bad export fails loudly instead of silently
 * producing a corrupt file.
 */
export function encodeWav(channels, sampleRate) {
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new Error('encodeWav needs at least one channel');
  }
  const length = channels[0].length;
  for (const ch of channels) {
    if (ch.length !== length) throw new Error('encodeWav channels must all have the same length');
  }
  if (!(sampleRate > 0)) throw new Error('encodeWav needs a positive sample rate');
  const numChannels = channels.length;
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM subchunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, length * numChannels * 2, true);
  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}
