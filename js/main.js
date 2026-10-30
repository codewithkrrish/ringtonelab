/* RingtoneLab — DOM wiring. All maths lives in the pure modules;
   this file only moves files, settings and results around the page. */
import { formatTime, formatBytes, ringtoneFilename } from './format.js';
import {
  clampSelection, selectionDuration, ringtonePreset, first30, last30,
  fullFile, MIN_SELECTION_SECONDS,
} from './selection.js';
import { applyFades } from './fades.js';
import { encodeWav, estimateWavBytes } from './wav.js';
import { computePeaks } from './peaks.js';

const $ = (id) => document.getElementById(id);
const dropZone = $('dropZone');
const fileInput = $('fileInput');
const demoToneBtn = $('demoToneBtn');
const clearBtn = $('clearBtn');
const fileNameText = $('fileNameText');
const fileMetaText = $('fileMetaText');
const statusText = $('statusText');
const waveWrap = $('waveWrap');
const waveInner = $('waveInner');
const waveCanvas = $('waveCanvas');
const handleStart = $('handleStart');
const handleEnd = $('handleEnd');
const playheadEl = $('playheadEl');
const zoomRange = $('zoomRange');
const zoomValue = $('zoomValue');
const fitBtn = $('fitBtn');
const startInput = $('startInput');
const endInput = $('endInput');
const selectionText = $('selectionText');
const preset30Btn = $('preset30Btn');
const first30Btn = $('first30Btn');
const last30Btn = $('last30Btn');
const fullBtn = $('fullBtn');
const playSelBtn = $('playSelBtn');
const playFromBtn = $('playFromBtn');
const stopBtn = $('stopBtn');
const loopCheck = $('loopCheck');
const volumeRange = $('volumeRange');
const volumeText = $('volumeText');
const fadeInRange = $('fadeInRange');
const fadeInText = $('fadeInText');
const fadeOutRange = $('fadeOutRange');
const fadeOutText = $('fadeOutText');
const exportBtn = $('exportBtn');
const exportNameText = $('exportNameText');
const estimateText = $('estimateText');
const resultWrap = $('resultWrap');
const downloadLink = $('downloadLink');
const resultText = $('resultText');

const state = {
  buffer: null,
  fileName: '',
  originalSize: null,
  selection: { start: 0, end: 0 },
  pxPerSec: 100,
  fitMode: true,
  playheadTime: 0,
  peaksCache: { width: 0, peaks: null },
};
let audioCtx = null;
let masterGain = null;
let source = null;
let playing = null;
let rafId = 0;

function raf(fn) {
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    return window.requestAnimationFrame(fn);
  }
  return setTimeout(fn, 16);
}
function cancelRaf(id) {
  if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
}

function setStatus(text) { statusText.textContent = text; }
function duration() { return state.buffer ? state.buffer.duration : 0; }

function ensureCtx() {
  if (audioCtx) return audioCtx;
  const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
  if (!AC) throw new Error('This browser does not expose the Web Audio API, so audio cannot be decoded here.');
  audioCtx = new AC();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = Number(volumeRange.value) / 100;
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

function setControlsEnabled(enabled) {
  const controls = [playSelBtn, playFromBtn, stopBtn, preset30Btn, first30Btn,
    last30Btn, fullBtn, exportBtn, startInput, endInput, zoomRange, fitBtn,
    fadeInRange, fadeOutRange, volumeRange, loopCheck, clearBtn];
  for (const el of controls) el.disabled = !enabled;
}

function updateEstimate() {
  if (!state.buffer) {
    estimateText.textContent = 'Load audio to see the estimated export size.';
    exportNameText.textContent = '';
    return;
  }
  const dur = selectionDuration(state.selection.start, state.selection.end);
  const est = estimateWavBytes(dur, state.buffer.sampleRate, state.buffer.numberOfChannels);
  exportNameText.textContent = `Export filename: ${ringtoneFilename(state.fileName)}`;
  if (state.originalSize) {
    const pct = Math.round((est / state.originalSize) * 100);
    estimateText.textContent = `Estimated WAV: ${formatBytes(est)} (${state.buffer.sampleRate} Hz, ${state.buffer.numberOfChannels} channel(s), 16-bit PCM) · Original file: ${formatBytes(state.originalSize)} · Export is about ${pct}% of the original.`;
  } else {
    estimateText.textContent = `Estimated WAV: ${formatBytes(est)} (${state.buffer.sampleRate} Hz, ${state.buffer.numberOfChannels} channel(s), 16-bit PCM) · Demo tone has no original file size.`;
  }
}

function drawWaveform() {
  const ctx = waveCanvas.getContext ? waveCanvas.getContext('2d') : null;
  if (!ctx || !state.buffer) return;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const totalWidth = Math.max(waveWrap.clientWidth || 600, Math.ceil(duration() * state.pxPerSec));
  waveInner.style.width = `${totalWidth}px`;
  waveCanvas.style.width = `${totalWidth}px`;
  waveCanvas.width = Math.round(totalWidth * dpr);
  waveCanvas.height = Math.round(160 * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, totalWidth, 160);
  ctx.strokeStyle = '#23232E';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 80);
  ctx.lineTo(totalWidth, 80);
  ctx.stroke();
  const channels = [];
  for (let c = 0; c < state.buffer.numberOfChannels; c += 1) channels.push(state.buffer.getChannelData(c));
  if (state.peaksCache.width !== totalWidth || !state.peaksCache.peaks) {
    state.peaksCache = { width: totalWidth, peaks: computePeaks(channels, totalWidth) };
  }
  const peaks = state.peaksCache.peaks;
  const sel = state.selection;
  for (let x = 0; x < totalWidth; x += 1) {
    const t = x / state.pxPerSec;
    const peak = peaks[x] || 0;
    const h = Math.max(1, peak * 150);
    ctx.fillStyle = (t >= sel.start && t <= sel.end) ? '#E5484D' : '#3F3F4D';
    ctx.fillRect(x, 80 - h / 2, 1, h);
  }
  // Fade shading: a dark overlay that thickens towards the clip edges.
  const fadeIn = Number(fadeInRange.value);
  const fadeOut = Number(fadeOutRange.value);
  for (const [from, to] of [[sel.start, sel.start + fadeIn], [sel.end - fadeOut, sel.end]]) {
    if (to <= from) continue;
    const x0 = Math.max(0, from * state.pxPerSec);
    const x1 = Math.min(totalWidth, to * state.pxPerSec);
    if (x1 <= x0) continue;
    const gradient = ctx.createLinearGradient ? ctx.createLinearGradient(x0, 0, x1, 0) : null;
    if (gradient) {
      const fadeInSide = from === sel.start;
      gradient.addColorStop(0, fadeInSide ? 'rgba(11,11,15,0.65)' : 'rgba(11,11,15,0)');
      gradient.addColorStop(1, fadeInSide ? 'rgba(11,11,15,0)' : 'rgba(11,11,15,0.65)');
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = 'rgba(11,11,15,0.4)';
    }
    ctx.fillRect(x0, 0, x1 - x0, 160);
  }
  // Playhead.
  const px = state.playheadTime * state.pxPerSec;
  ctx.fillStyle = '#F5F5F7';
  ctx.fillRect(px, 0, 2, 160);
  ctx.restore();
  handleStart.style.left = `${sel.start * state.pxPerSec}px`;
  handleEnd.style.left = `${sel.end * state.pxPerSec}px`;
  playheadEl.style.left = `${px}px`;
}

function setSelection(start, end) {
  state.selection = clampSelection(start, end, duration());
  startInput.value = state.selection.start.toFixed(1);
  endInput.value = state.selection.end.toFixed(1);
  selectionText.textContent = `Selection: ${selectionDuration(state.selection.start, state.selection.end).toFixed(1)}s (${formatTime(state.selection.start)} – ${formatTime(state.selection.end)})`;
  updateEstimate();
  drawWaveform();
}

function fitZoom() {
  const width = waveWrap.clientWidth || 600;
  state.pxPerSec = Math.max(20, Math.floor(width / Math.max(duration(), 1)));
  zoomRange.value = state.pxPerSec;
  zoomValue.textContent = `${state.pxPerSec} px/s (fit)`;
  state.fitMode = true;
  drawWaveform();
}

function setAudio(buffer, fileName, originalSize, label) {
  stopPlayback();
  state.buffer = buffer;
  state.fileName = fileName;
  state.originalSize = originalSize;
  state.peaksCache = { width: 0, peaks: null };
  state.playheadTime = 0;
  fileNameText.textContent = fileName;
  fileMetaText.textContent = `${label} · ${formatTime(buffer.duration)} · ${buffer.sampleRate} Hz · ${buffer.numberOfChannels} channel(s)`;
  setControlsEnabled(true);
  setSelection(0, buffer.duration);
  fitZoom();
  resultWrap.hidden = true;
  setStatus('Audio loaded. Drag on the waveform to select your ringtone, then play it or export it.');
}

function setNoAudio() {
  stopPlayback();
  state.buffer = null;
  state.fileName = '';
  state.originalSize = null;
  state.selection = { start: 0, end: 0 };
  fileNameText.textContent = 'No audio loaded yet.';
  fileMetaText.textContent = '';
  selectionText.textContent = 'Selection: 0.0s';
  estimateText.textContent = 'Load audio to see the estimated export size.';
  exportNameText.textContent = '';
  resultWrap.hidden = true;
  setControlsEnabled(false);
  const ctx = waveCanvas.getContext ? waveCanvas.getContext('2d') : null;
  if (ctx) ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
}

async function loadFile(file) {
  const okTypes = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'opus', 'aif', 'aiff'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (file.type && !file.type.startsWith('audio/') && !okTypes.includes(ext)) {
    setStatus(`"${file.name}" does not look like an audio file, so it was not loaded. Try MP3, WAV, M4A, OGG or FLAC.`);
    return;
  }
  try {
    setStatus(`Decoding "${file.name}"…`);
    const ctx = ensureCtx();
    if (ctx.resume) await ctx.resume();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    setAudio(buffer, file.name, file.size, file.type || 'audio file');
  } catch (err) {
    setStatus(`Could not decode "${file.name}". This browser cannot decode that format or the file is damaged. MP3 and WAV work almost everywhere; OGG and FLAC depend on your browser. (${err.message || err})`);
  }
}

function buildDemoTone() {
  const ctx = ensureCtx();
  const sr = ctx.sampleRate || 44100;
  const length = sr * 60;
  const buffer = ctx.createBuffer(2, length, sr);
  for (let c = 0; c < 2; c += 1) {
    const data = buffer.getChannelData(c);
    const from = c === 0 ? 220 : 330;
    const to = c === 0 ? 660 : 495;
    for (let i = 0; i < length; i += 1) {
      const progress = i / length;
      const freq = from + (to - from) * progress;
      data[i] = 0.4 * Math.sin((2 * Math.PI * freq * i) / sr);
    }
  }
  return buffer;
}

function tickPlayhead() {
  if (!playing) return;
  const elapsed = audioCtx.currentTime - playing.ctxStart;
  const span = playing.to - playing.from;
  let pos;
  if (playing.loop) {
    pos = playing.from + (span > 0 ? elapsed % span : 0);
  } else {
    pos = Math.min(playing.to, playing.from + elapsed);
  }
  state.playheadTime = pos;
  drawWaveform();
  if (playing) rafId = raf(tickPlayhead);
}

function playRange(from, to, loop) {
  if (!state.buffer) return;
  stopPlayback();
  const ctx = ensureCtx();
  if (ctx.resume) void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = state.buffer;
  src.connect(masterGain);
  if (loop) {
    src.loop = true;
    src.loopStart = from;
    src.loopEnd = to;
  }
  const startAt = ctx.currentTime;
  src.start(0, from);
  if (!loop) src.stop(startAt + Math.max(0.05, to - from));
  src.onended = () => {
    if (playing && playing.source === src && !playing.loop) {
      const endedTo = playing.to;
      stopPlayback();
      state.playheadTime = endedTo;
      drawWaveform();
    }
  };
  source = src;
  playing = { from, to, loop, ctxStart: startAt, source: src };
  state.playheadTime = from;
  setStatus(loop ? `Looping ${formatTime(from)} – ${formatTime(to)}. Press Stop or Space to stop.` : `Playing ${formatTime(from)} – ${formatTime(to)}.`);
  rafId = raf(tickPlayhead);
}

function stopPlayback() {
  if (source) {
    try { source.onended = null; source.stop(); } catch (err) { /* already stopped */ }
    try { source.disconnect(); } catch (err) { /* already disconnected */ }
  }
  source = null;
  playing = null;
  if (rafId) cancelRaf(rafId);
  rafId = 0;
}

function exportWav() {
  if (!state.buffer) return;
  try {
    const sel = state.selection;
    const fadeIn = Number(fadeInRange.value);
    const fadeOut = Number(fadeOutRange.value);
    const channels = [];
    for (let c = 0; c < state.buffer.numberOfChannels; c += 1) {
      channels.push(applyFades(state.buffer.getChannelData(c), state.buffer.sampleRate, sel.start, sel.end, fadeIn, fadeOut));
    }
    const wav = encodeWav(channels, state.buffer.sampleRate);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const filename = ringtoneFilename(state.fileName);
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.textContent = filename;
    resultWrap.hidden = false;
    resultText.textContent = `Exported ${formatTime(selectionDuration(sel.start, sel.end))} clip (${formatTime(sel.start)} – ${formatTime(sel.end)}, fade in ${fadeIn}s, fade out ${fadeOut}s) · ${formatBytes(blob.size)}.`;
    setStatus('Export ready — the download should start now. If it did not, click the filename below.');
    downloadLink.click();
  } catch (err) {
    setStatus(`Export failed: ${err.message || err}`);
  }
}

// --- Intake: picker, drag-drop, paste, demo tone ---
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) void loadFile(fileInput.files[0]);
  fileInput.value = '';
});
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (e) => {
  e.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) void loadFile(file);
});
document.addEventListener('paste', (e) => {
  const files = (e.clipboardData && e.clipboardData.files) || [];
  if (files.length > 0) void loadFile(files[0]);
});
demoToneBtn.addEventListener('click', () => {
  try {
    const buffer = buildDemoTone();
    setAudio(buffer, 'demo-tone.wav', null, 'Generated demo tone');
  } catch (err) {
    setStatus(`Demo tone failed: ${err.message || err}`);
  }
});
clearBtn.addEventListener('click', () => {
  setNoAudio();
  setStatus('Cleared. Add audio to get started.');
});

// --- Waveform interaction: drag-select, click to place playhead, handles ---
let drag = null;
function timeFromEvent(e) {
  const rect = waveInner.getBoundingClientRect();
  return Math.min(Math.max((e.clientX - rect.left) / state.pxPerSec, 0), duration());
}
waveCanvas.addEventListener('pointerdown', (e) => {
  if (!state.buffer) return;
  const anchor = timeFromEvent(e);
  drag = { anchor, moved: false };
  waveCanvas.setPointerCapture && waveCanvas.setPointerCapture(e.pointerId);
});
waveCanvas.addEventListener('pointermove', (e) => {
  if (!drag || !state.buffer) return;
  const t = timeFromEvent(e);
  if (Math.abs(t - drag.anchor) * state.pxPerSec > 3) drag.moved = true;
  if (drag.moved) {
    const s = Math.min(drag.anchor, t);
    const en = Math.max(drag.anchor, t);
    if (en - s >= MIN_SELECTION_SECONDS) setSelection(s, en);
  }
});
function endCanvasDrag(e) {
  if (!drag) return;
  if (!drag.moved && state.buffer) {
    state.playheadTime = timeFromEvent(e);
    drawWaveform();
  }
  drag = null;
}
waveCanvas.addEventListener('pointerup', endCanvasDrag);
waveCanvas.addEventListener('pointercancel', () => { drag = null; });

function makeHandleDrag(handle, isStart) {
  handle.addEventListener('pointerdown', (e) => {
    if (!state.buffer) return;
    e.stopPropagation();
    e.preventDefault();
    const move = (ev) => {
      const t = timeFromEvent(ev);
      const sel = state.selection;
      if (isStart) setSelection(t, sel.end);
      else setSelection(sel.start, t);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}
makeHandleDrag(handleStart, true);
makeHandleDrag(handleEnd, false);

// --- Controls ---
zoomRange.addEventListener('input', () => {
  state.pxPerSec = Number(zoomRange.value);
  zoomValue.textContent = `${state.pxPerSec} px/s`;
  state.fitMode = false;
  drawWaveform();
});
fitBtn.addEventListener('click', fitZoom);
startInput.addEventListener('change', () => setSelection(Number(startInput.value), state.selection.end));
endInput.addEventListener('change', () => setSelection(state.selection.start, Number(endInput.value)));
preset30Btn.addEventListener('click', () => setSelection(ringtonePreset(state.selection.start, duration()).start, ringtonePreset(state.selection.start, duration()).end));
first30Btn.addEventListener('click', () => { const p = first30(duration()); setSelection(p.start, p.end); });
last30Btn.addEventListener('click', () => { const p = last30(duration()); setSelection(p.start, p.end); });
fullBtn.addEventListener('click', () => { const p = fullFile(duration()); setSelection(p.start, p.end); });
playSelBtn.addEventListener('click', () => {
  if (playing) { stopPlayback(); setStatus('Stopped.'); return; }
  playRange(state.selection.start, state.selection.end, loopCheck.checked);
});
playFromBtn.addEventListener('click', () => {
  if (playing) { stopPlayback(); setStatus('Stopped.'); return; }
  playRange(state.playheadTime, duration(), loopCheck.checked);
});
stopBtn.addEventListener('click', () => {
  stopPlayback();
  state.playheadTime = state.selection.start;
  drawWaveform();
  setStatus('Stopped.');
});
volumeRange.addEventListener('input', () => {
  volumeText.textContent = `${volumeRange.value}%`;
  if (masterGain) masterGain.gain.value = Number(volumeRange.value) / 100;
});
fadeInRange.addEventListener('input', () => {
  fadeInText.textContent = `${Number(fadeInRange.value).toFixed(1)}s`;
  drawWaveform();
});
fadeOutRange.addEventListener('input', () => {
  fadeOutText.textContent = `${Number(fadeOutRange.value).toFixed(1)}s`;
  drawWaveform();
});
exportBtn.addEventListener('click', exportWav);
window.addEventListener('resize', () => { if (state.fitMode && state.buffer) fitZoom(); });
document.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
  if (e.code === 'Space' && state.buffer) {
    e.preventDefault();
    playSelBtn.click();
  } else if (e.key === 'l' || e.key === 'L') {
    if (state.buffer) loopCheck.checked = !loopCheck.checked;
  } else if (e.key === 'r' || e.key === 'R') {
    if (state.buffer) preset30Btn.click();
  }
});

// --- Init: nothing loaded yet, controls disabled until audio arrives. ---
setControlsEnabled(false);
volumeText.textContent = `${volumeRange.value}%`;
fadeInText.textContent = `${Number(fadeInRange.value).toFixed(1)}s`;
fadeOutText.textContent = `${Number(fadeOutRange.value).toFixed(1)}s`;
zoomValue.textContent = 'Fit on load';
setStatus('Add audio to get started.');
