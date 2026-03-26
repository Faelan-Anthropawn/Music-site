let meAudioFile = null;
let meAudioBuffer = null;
let meAudioContext = null;
let meSourceNode = null;
let meIsPlaying = false;
let mePlayStartTime = 0;
let mePlayOffset = 0;
let meAnimationFrameId = null;

let meWindowStart = 0;
let meWindowDuration = 2;
let meSelStart = 0;
let meSelEnd = 0;
let meDraggingHandle = null;
let meMicroEdits = [];

let meWaveformData = null;
let meWaveformSamples = 2000;

const meDropZone = document.getElementById('me-drop-zone');
const meFileInput = document.getElementById('me-file-input');
const meBrowseBtn = document.getElementById('me-browse-btn');
const meFileName = document.getElementById('me-file-name');
const meEditor = document.getElementById('me-editor');
const meWaveformCanvas = document.getElementById('me-waveform');
const meWaveformContainer = document.getElementById('me-waveform-container');
const meSelectionDiv = document.getElementById('me-selection');
const meHandleStart = document.getElementById('me-handle-start');
const meHandleEnd = document.getElementById('me-handle-end');
const mePlayhead = document.getElementById('me-playhead');

const meTimestampInput = document.getElementById('me-timestamp');
const meWindowDurInput = document.getElementById('me-window-dur');
const meWindowDurDisplay = document.getElementById('me-window-dur-display');
const meZoomBtn = document.getElementById('me-zoom-btn');
const meWindowInfo = document.getElementById('me-window-info');

const meSelStartDisplay = document.getElementById('me-sel-start-display');
const meSelEndDisplay = document.getElementById('me-sel-end-display');
const meVolumeInput = document.getElementById('me-volume-input');
const meSmoothInput = document.getElementById('me-smooth-input');
const meSmoothDisplay = document.getElementById('me-smooth-display');
const meAddEditBtn = document.getElementById('me-add-edit-btn');
const meEditsListDiv = document.getElementById('me-edits-list');

const mePlayBtn = document.getElementById('me-play-btn');
const meCurrentTimeDisplay = document.getElementById('me-current-time');
const meDurationDisplay = document.getElementById('me-duration');
const meProgressBarContainer = document.getElementById('me-progress-bar-container');
const meProgressBar = document.getElementById('me-progress-bar');
const meProgressThumb = document.getElementById('me-progress-thumb');
const meZoomSelectionBtn = document.getElementById('me-zoom-selection-btn');
const meSpeedSelect = document.getElementById('me-speed-select');
const meOutputFormat = document.getElementById('me-output-format');
const meOutputName = document.getElementById('me-output-name');
const meApplyBtn = document.getElementById('me-apply-btn');
const meStatusMsg = document.getElementById('me-status-message');
const meConsoleBox = document.getElementById('me-console-box');

function meGetTimestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function meLog(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.className = 'console-entry';
    const ts = document.createElement('span');
    ts.className = 'console-timestamp';
    ts.textContent = `[${meGetTimestamp()}]`;
    const text = document.createElement('span');
    text.textContent = msg;
    if (type === 'error') text.style.color = '#ef4444';
    else if (type === 'success') text.style.color = '#22c55e';
    else if (type === 'info') text.style.color = '#3b82f6';
    entry.appendChild(ts);
    entry.appendChild(text);
    meConsoleBox.appendChild(entry);
    const entries = meConsoleBox.querySelectorAll('.console-entry');
    if (entries.length > 30) entries[0].remove();
    meConsoleBox.scrollTop = meConsoleBox.scrollHeight;
}

function meShowStatus(msg, type = 'info') {
    meStatusMsg.textContent = msg;
    meStatusMsg.className = 'status-badge ' + type;
}

function meFmtMs(sec) {
    return (sec * 1000).toFixed(1) + ' ms';
}

function meFmtSec(sec) {
    return sec.toFixed(4) + 's';
}

function meFmtSimple(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function meParseTimestamp(str) {
    str = str.trim();
    if (str.includes(':')) {
        const parts = str.split(':');
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(str) || 0;
}

async function meHandleFile(file) {
    if (!file) return;
    if (!file.name.match(/\.(mp3|wav)$/i)) {
        meShowStatus('Please select an MP3 or WAV file.', 'error');
        return;
    }
    meAudioFile = file;
    meFileName.textContent = file.name;
    meShowStatus('Loading audio...', 'info');
    meLog('Loading: ' + file.name, 'info');

    try {
        const ab = await file.arrayBuffer();
        meAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        meAudioBuffer = await meAudioContext.decodeAudioData(ab);

        if (!meOutputName.value) {
            meOutputName.value = file.name.replace(/\.(mp3|wav)$/i, '') + '_micro';
        }

        meWindowStart = 0;
        meWindowDuration = Math.min(2, meAudioBuffer.duration);
        meSelStart = 0;
        meSelEnd = meWindowDuration;
        meMicroEdits = [];

        meTimestampInput.value = '0';
        meWindowDurInput.value = meWindowDuration;
        meWindowDurDisplay.textContent = meWindowDuration.toFixed(1) + 's';

        meGenerateWaveform();
        meDrawWaveform();
        meUpdateHandles();
        meUpdateSelDisplays();
        meRenderEditsList();

        meDurationDisplay.textContent = meFmtSimple(meAudioBuffer.duration);
        meEditor.classList.remove('hidden');
        meShowStatus('Loaded: ' + meFmtSimple(meAudioBuffer.duration), 'success');
        meLog('Loaded. Duration: ' + meFmtSimple(meAudioBuffer.duration) + ', Channels: ' + meAudioBuffer.numberOfChannels + ', Rate: ' + meAudioBuffer.sampleRate + 'Hz', 'info');
    } catch (err) {
        meShowStatus('Error: ' + err.message, 'error');
        meLog('Error: ' + err.message, 'error');
    }
}

function meGenerateWaveform() {
    if (!meAudioBuffer) return;
    const ch = meAudioBuffer.getChannelData(0);
    const sr = meAudioBuffer.sampleRate;
    const startSample = Math.floor(meWindowStart * sr);
    const endSample = Math.min(Math.floor((meWindowStart + meWindowDuration) * sr), ch.length);
    const len = endSample - startSample;
    if (len <= 0) return;

    meWaveformData = new Float32Array(meWaveformSamples);
    const blockSize = Math.max(1, Math.floor(len / meWaveformSamples));

    for (let i = 0; i < meWaveformSamples; i++) {
        let sum = 0;
        const base = startSample + i * blockSize;
        for (let j = 0; j < blockSize && base + j < endSample; j++) {
            sum += Math.abs(ch[base + j]);
        }
        meWaveformData[i] = sum / blockSize;
    }
}

function meDrawWaveform() {
    if (!meWaveformData || !meWaveformCanvas) return;

    const container = meWaveformContainer;
    const rect = container.getBoundingClientRect();
    const width = rect.width || container.clientWidth || 600;
    const height = rect.height || container.clientHeight || 160;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    meWaveformCanvas.width = width * dpr;
    meWaveformCanvas.height = height * dpr;
    meWaveformCanvas.style.width = width + 'px';
    meWaveformCanvas.style.height = height + 'px';

    const ctx = meWaveformCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    const centerY = height / 2;
    const samplesPerPixel = meWaveformData.length / width;

    ctx.fillStyle = '#1a4a4a';
    for (let x = 0; x < width; x++) {
        const s0 = Math.floor(x * samplesPerPixel);
        const s1 = Math.floor((x + 1) * samplesPerPixel);
        let peak = 0;
        for (let i = s0; i < s1 && i < meWaveformData.length; i++) {
            if (meWaveformData[i] > peak) peak = meWaveformData[i];
        }
        const bh = peak * height * 0.85;
        ctx.fillRect(x, centerY - bh / 2, 1, bh);
    }

    ctx.fillStyle = '#64748b';
    for (let x = 0; x < width; x++) {
        const s0 = Math.floor(x * samplesPerPixel);
        const s1 = Math.floor((x + 1) * samplesPerPixel);
        let peak = 0;
        for (let i = s0; i < s1 && i < meWaveformData.length; i++) {
            if (meWaveformData[i] > peak) peak = meWaveformData[i];
        }
        const bh = peak * height * 0.85;
        ctx.fillRect(x, centerY - bh / 2, 1, bh * 0.6);
    }

    if (meMicroEdits.length > 0) {
        ctx.globalAlpha = 0.35;
        for (const edit of meMicroEdits) {
            const relStart = edit.start - meWindowStart;
            const relEnd = edit.end - meWindowStart;
            if (relEnd < 0 || relStart > meWindowDuration) continue;
            const x1 = (Math.max(0, relStart) / meWindowDuration) * width;
            const x2 = (Math.min(meWindowDuration, relEnd) / meWindowDuration) * width;
            if (edit.smoothing > 0) {
                ctx.fillStyle = '#c4622a';
            } else {
                ctx.fillStyle = edit.volume >= 0 ? '#22c55e' : '#ef4444';
            }
            ctx.fillRect(x1, 0, x2 - x1, height);
        }
        ctx.globalAlpha = 1;
    }

    meDrawTimeRuler(ctx, width, height);
}

function meDrawTimeRuler(ctx, width, height) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, height - 18, width, 18);

    ctx.fillStyle = '#4a6a6a';
    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';

    const numTicks = 10;
    for (let i = 0; i <= numTicks; i++) {
        const t = meWindowStart + (i / numTicks) * meWindowDuration;
        const x = (i / numTicks) * width;
        ctx.fillStyle = '#2a4a4a';
        ctx.fillRect(x, height - 18, 1, 18);
        ctx.fillStyle = '#6a8a8a';
        const label = t.toFixed(2) + 's';
        if (i < numTicks) ctx.fillText(label, x + 3, height - 9);
    }
}

function meUpdateHandles() {
    if (!meAudioBuffer) return;
    const width = meWaveformContainer.clientWidth;

    const relStart = meSelStart - meWindowStart;
    const relEnd = meSelEnd - meWindowStart;

    const x1 = (relStart / meWindowDuration) * width;
    const x2 = (relEnd / meWindowDuration) * width;

    meHandleStart.style.left = (x1 - 8) + 'px';
    meHandleEnd.style.left = (x2 - 8) + 'px';

    meSelectionDiv.style.left = x1 + 'px';
    meSelectionDiv.style.width = (x2 - x1) + 'px';

    meUpdateSelDisplays();
}

function meUpdateSelDisplays() {
    const durSec = meSelEnd - meSelStart;
    meSelStartDisplay.textContent = meFmtSec(meSelStart);
    meSelEndDisplay.textContent = meFmtSec(meSelEnd);
    document.getElementById('me-sel-duration').textContent = meFmtMs(durSec);
}

function meRenderEditsList() {
    meEditsListDiv.innerHTML = '';
    if (meMicroEdits.length === 0) {
        meEditsListDiv.innerHTML = '<p class="text-sm text-slate-500">No micro edits queued.</p>';
        return;
    }
    meMicroEdits.forEach((edit, idx) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-surface-800 rounded-lg border border-slate-700/40';
        const volStr = edit.volume === 0 ? '' : ` | Vol: <span class="${edit.volume >= 0 ? 'text-green-400' : 'text-red-400'}">${edit.volume >= 0 ? '+' : ''}${edit.volume}%</span>`;
        const smoothStr = edit.smoothing > 0 ? ` | Smooth: <span class="text-amber-400">${edit.smoothing}%</span>` : '';
        div.innerHTML = `
            <span class="text-sm text-slate-300 font-mono">
                ${meFmtSec(edit.start)} → ${meFmtSec(edit.end)}
                <span class="text-slate-500 ml-1">(${meFmtMs(edit.end - edit.start)})</span>
                ${volStr}${smoothStr}
            </span>
            <button class="text-slate-400 hover:text-red-400 transition-colors ml-4" data-idx="${idx}">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        `;
        div.querySelector('button').addEventListener('click', () => {
            meMicroEdits.splice(idx, 1);
            meRenderEditsList();
            meDrawWaveform();
            meLog(`Removed micro edit #${idx + 1}`, 'info');
        });
        meEditsListDiv.appendChild(div);
    });
}

function meHandleDragStart(e, handle) {
    e.preventDefault();
    meDraggingHandle = handle;
}

function meHandleMouseMove(e) {
    if (!meDraggingHandle || !meAudioBuffer) return;
    const rect = meWaveformContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const absTime = meWindowStart + ratio * meWindowDuration;

    if (meDraggingHandle === 'start') {
        meSelStart = Math.max(meWindowStart, Math.min(absTime, meSelEnd - 0.001));
    } else {
        meSelEnd = Math.min(meWindowStart + meWindowDuration, Math.max(absTime, meSelStart + 0.001));
    }

    meUpdateHandles();
}

function meHandleMouseUp() {
    meDraggingHandle = null;
}

function meStopPlayback() {
    if (meSourceNode) {
        try { meSourceNode.stop(); } catch (e) {}
        meSourceNode = null;
    }
    if (meAnimationFrameId) {
        cancelAnimationFrame(meAnimationFrameId);
        meAnimationFrameId = null;
    }
    meIsPlaying = false;
    mePlayBtn.innerHTML = '<span class="material-symbols-outlined text-xl text-white">play_arrow</span>';
    if (meProgressBar) meProgressBar.style.width = '0%';
    if (meProgressThumb) meProgressThumb.style.left = '0%';
    const width = meWaveformContainer ? meWaveformContainer.clientWidth : 0;
    const relStart = meSelStart - meWindowStart;
    if (mePlayhead) mePlayhead.style.left = ((relStart / meWindowDuration) * width) + 'px';
}

function meUpdateProgressBar(ct) {
    if (!meAudioBuffer || !meProgressBar) return;
    const selDur = meSelEnd - meSelStart;
    const pct = selDur > 0
        ? Math.min(100, Math.max(0, ((ct - meSelStart) / selDur) * 100))
        : 0;
    meProgressBar.style.width = pct + '%';
    if (meProgressThumb) meProgressThumb.style.left = pct + '%';
}

function meUpdatePlayhead() {
    if (!meAudioBuffer || !meIsPlaying) return;
    const speed = meSpeedSelect ? parseFloat(meSpeedSelect.value) || 1 : 1;
    const ct = mePlayOffset + (meAudioContext.currentTime - mePlayStartTime) * speed;
    const relTime = ct - meWindowStart;
    const ratio = relTime / meWindowDuration;
    const width = meWaveformContainer.clientWidth;
    mePlayhead.style.left = (ratio * width) + 'px';
    meCurrentTimeDisplay.textContent = meFmtSimple(ct);
    meUpdateProgressBar(ct);

    if (ct < meSelEnd) {
        meAnimationFrameId = requestAnimationFrame(meUpdatePlayhead);
    } else {
        meUpdateProgressBar(meSelEnd);
        meStopPlayback();
    }
}

function meBuildPreviewBuffer() {
    const sr = meAudioBuffer.sampleRate;
    const nc = meAudioBuffer.numberOfChannels;
    const preview = meAudioContext.createBuffer(nc, meAudioBuffer.length, sr);
    for (let ch = 0; ch < nc; ch++) {
        preview.copyToChannel(meAudioBuffer.getChannelData(ch).slice(), ch);
    }
    meApplyEditsToBuffer(preview);
    return preview;
}

function meApplyEditsToBuffer(buffer) {
    const sr = buffer.sampleRate;
    for (const edit of meMicroEdits) {
        const s0 = Math.floor(edit.start * sr);
        const s1 = Math.min(Math.floor(edit.end * sr), buffer.length);
        const len = s1 - s0;
        if (len <= 0) continue;

        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);

            if (edit.volume !== 0) {
                const gain = 1 + (edit.volume / 100);
                for (let i = s0; i < s1; i++) {
                    data[i] = Math.max(-1, Math.min(1, data[i] * gain));
                }
            }

            if (edit.smoothing > 0) {
                const smoothRatio = edit.smoothing / 100;
                const fadeSamples = Math.floor(len * smoothRatio * 0.5);

                for (let i = 0; i < fadeSamples; i++) {
                    const t = i / fadeSamples;
                    const envGain = t * t * (3 - 2 * t);
                    if (s0 + i < s1) data[s0 + i] *= envGain;
                }

                for (let i = 0; i < fadeSamples; i++) {
                    const t = i / fadeSamples;
                    const envGain = t * t * (3 - 2 * t);
                    const idx = s1 - 1 - i;
                    if (idx >= s0) data[idx] *= envGain;
                }
            }
        }
    }
}

function meStartPlayback(startTime = null) {
    if (!meAudioBuffer) return;
    meStopPlayback();

    const from = startTime !== null ? startTime : meSelStart;
    const clampedFrom = Math.max(meSelStart, Math.min(meSelEnd, from));
    const playDuration = (meSelEnd - clampedFrom);
    if (playDuration <= 0) return;

    const speed = meSpeedSelect ? parseFloat(meSpeedSelect.value) || 1 : 1;
    const preview = meBuildPreviewBuffer();

    meSourceNode = meAudioContext.createBufferSource();
    meSourceNode.buffer = preview;
    meSourceNode.playbackRate.value = speed;
    meSourceNode.connect(meAudioContext.destination);
    meSourceNode.start(0, clampedFrom, playDuration);
    meSourceNode.onended = () => { if (meIsPlaying) meStopPlayback(); };

    mePlayStartTime = meAudioContext.currentTime;
    mePlayOffset = clampedFrom;
    meIsPlaying = true;
    mePlayBtn.innerHTML = '<span class="material-symbols-outlined text-xl text-white">pause</span>';
    meAnimationFrameId = requestAnimationFrame(meUpdatePlayhead);
}

async function meCopyBuffer(buffer) {
    const copy = meAudioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        copy.copyToChannel(buffer.getChannelData(ch).slice(), ch);
    }
    return copy;
}

async function meBufferToWav(buffer) {
    const nc = buffer.numberOfChannels;
    const sr = buffer.sampleRate;
    const data = [];
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < nc; ch++) {
            const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
            const v = s < 0 ? s * 0x8000 : s * 0x7FFF;
            data.push(v & 0xFF);
            data.push((v >> 8) & 0xFF);
        }
    }
    const headerSize = 44;
    const dataSize = data.length;
    const ab = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(ab);
    const ws = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    ws(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    ws(8, 'WAVE');
    ws(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, nc, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * nc * 2, true);
    view.setUint16(32, nc * 2, true);
    view.setUint16(34, 16, true);
    ws(36, 'data');
    view.setUint32(40, dataSize, true);
    const u8 = new Uint8Array(ab);
    for (let i = 0; i < data.length; i++) u8[headerSize + i] = data[i];
    return new Blob([ab], { type: 'audio/wav' });
}

async function meBufferToMp3(buffer) {
    const nc = buffer.numberOfChannels;
    const sr = buffer.sampleRate;
    const encoder = new lamejs.Mp3Encoder(nc, sr, 320);
    const mp3Data = [];
    const blockSize = 1152;
    const len = buffer.length;
    const left = buffer.getChannelData(0);
    const right = nc > 1 ? buffer.getChannelData(1) : left;
    const li = new Int16Array(len);
    const ri = new Int16Array(len);
    for (let i = 0; i < len; i++) {
        li[i] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
        ri[i] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
    }
    for (let i = 0; i < len; i += blockSize) {
        const lc = li.subarray(i, i + blockSize);
        const rc = ri.subarray(i, i + blockSize);
        const chunk = nc === 1 ? encoder.encodeBuffer(lc) : encoder.encodeBuffer(lc, rc);
        if (chunk.length > 0) mp3Data.push(chunk);
    }
    const end = encoder.flush();
    if (end.length > 0) mp3Data.push(end);
    return new Blob(mp3Data, { type: 'audio/mp3' });
}

function meDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

if (meDropZone) {
    meDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        meDropZone.classList.add('drag-over');
    });
    meDropZone.addEventListener('dragleave', () => meDropZone.classList.remove('drag-over'));
    meDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        meDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) meHandleFile(e.dataTransfer.files[0]);
    });
    meDropZone.addEventListener('click', () => meFileInput.click());
}

if (meFileInput) {
    meFileInput.addEventListener('change', () => {
        if (meFileInput.files[0]) meHandleFile(meFileInput.files[0]);
    });
}
if (meBrowseBtn) {
    meBrowseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        meFileInput.click();
    });
}

if (meWindowDurInput) {
    meWindowDurInput.addEventListener('input', () => {
        const v = parseFloat(meWindowDurInput.value);
        meWindowDurDisplay.textContent = v < 1 ? (v * 1000).toFixed(0) + 'ms' : v.toFixed(2) + 's';
    });
}

if (meZoomBtn) {
    meZoomBtn.addEventListener('click', () => {
        if (!meAudioBuffer) return;
        const ts = meParseTimestamp(meTimestampInput.value);
        const dur = parseFloat(meWindowDurInput.value) || 2;

        meWindowStart = Math.max(0, Math.min(ts, meAudioBuffer.duration - dur));
        meWindowDuration = Math.min(dur, meAudioBuffer.duration - meWindowStart);
        meSelStart = meWindowStart;
        meSelEnd = meWindowStart + meWindowDuration;

        meWindowInfo.textContent = `Showing ${meFmtSec(meWindowStart)} → ${meFmtSec(meWindowStart + meWindowDuration)}`;

        meGenerateWaveform();
        meDrawWaveform();
        meUpdateHandles();
        meUpdateSelDisplays();
        meLog(`Zoomed to window: ${meFmtSec(meWindowStart)} → ${meFmtSec(meWindowStart + meWindowDuration)}`, 'info');
    });
}

if (meHandleStart) {
    meHandleStart.addEventListener('mousedown', (e) => meHandleDragStart(e, 'start'));
    meHandleStart.addEventListener('touchstart', (e) => meHandleDragStart(e, 'start'), { passive: false });
}
if (meHandleEnd) {
    meHandleEnd.addEventListener('mousedown', (e) => meHandleDragStart(e, 'end'));
    meHandleEnd.addEventListener('touchstart', (e) => meHandleDragStart(e, 'end'), { passive: false });
}

document.addEventListener('mousemove', meHandleMouseMove);
document.addEventListener('touchmove', meHandleMouseMove, { passive: false });
document.addEventListener('mouseup', meHandleMouseUp);
document.addEventListener('touchend', meHandleMouseUp);

const meVolumeNumber = document.getElementById('me-volume-number');

if (meVolumeInput && meVolumeNumber) {
    meVolumeInput.addEventListener('input', () => {
        meVolumeNumber.value = meVolumeInput.value;
    });
    meVolumeNumber.addEventListener('input', () => {
        meVolumeInput.value = meVolumeNumber.value;
    });
}

if (meSmoothInput) {
    meSmoothInput.addEventListener('input', () => {
        meSmoothDisplay.textContent = meSmoothInput.value + '%';
    });
}

if (meAddEditBtn) {
    meAddEditBtn.addEventListener('click', () => {
        if (!meAudioBuffer) return;
        const vol = parseInt(meVolumeInput.value) || 0;
        const smooth = parseInt(meSmoothInput.value) || 0;
        if (vol === 0 && smooth === 0) {
            meShowStatus('Set a volume change or smoothing before adding.', 'error');
            meLog('No edit parameters set.', 'error');
            return;
        }
        const edit = { start: meSelStart, end: meSelEnd, volume: vol, smoothing: smooth };
        meMicroEdits.push(edit);
        meRenderEditsList();
        meDrawWaveform();
        const selDur = meSelEnd - meSelStart;
        meLog(`Added edit: ${meFmtSec(meSelStart)}→${meFmtSec(meSelEnd)} (${meFmtMs(selDur)}) | Vol: ${vol >= 0 ? '+' : ''}${vol}% | Smooth: ${smooth}%`, 'success');
        meShowStatus('Micro edit added.', 'success');
    });
}

if (mePlayBtn) {
    mePlayBtn.addEventListener('click', () => {
        if (!meAudioBuffer) return;
        if (meIsPlaying) {
            meStopPlayback();
        } else {
            meStartPlayback(meWindowStart);
        }
    });
}

if (meApplyBtn) {
    meApplyBtn.addEventListener('click', async () => {
        if (!meAudioBuffer) return;
        meStopPlayback();
        meShowStatus('Applying micro edits...', 'info');
        meLog('Building output buffer...', 'info');

        try {
            const output = await meCopyBuffer(meAudioBuffer);
            meApplyEditsToBuffer(output);

            const fmt = meOutputFormat.value;
            const name = (meOutputName.value || 'micro_edit') + '.' + fmt;

            meLog(`Encoding as ${fmt.toUpperCase()}...`, 'info');
            const blob = fmt === 'mp3' ? await meBufferToMp3(output) : await meBufferToWav(output);
            meDownload(blob, name);
            meShowStatus('Downloaded: ' + name, 'success');
            meLog('Done! Saved: ' + name, 'success');
        } catch (err) {
            meShowStatus('Error: ' + err.message, 'error');
            meLog('Error: ' + err.message, 'error');
        }
    });
}

if (meProgressBarContainer) {
    function meSeekFromProgressEvent(e) {
        if (!meAudioBuffer) return;
        const rect = meProgressBarContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const seekTime = meSelStart + ratio * (meSelEnd - meSelStart);
        meUpdateProgressBar(seekTime);
        meCurrentTimeDisplay.textContent = meFmtSimple(seekTime);
        if (meIsPlaying) {
            meStartPlayback(seekTime);
        } else {
            mePlayOffset = seekTime;
            const relTime = seekTime - meWindowStart;
            const posRatio = relTime / meWindowDuration;
            mePlayhead.style.left = (posRatio * meWaveformContainer.clientWidth) + 'px';
        }
    }
    let meProgressDragging = false;
    meProgressBarContainer.addEventListener('mousedown', (e) => {
        meProgressDragging = true;
        meSeekFromProgressEvent(e);
    });
    meProgressBarContainer.addEventListener('touchstart', (e) => {
        meProgressDragging = true;
        meSeekFromProgressEvent(e);
    }, { passive: true });
    document.addEventListener('mousemove', (e) => {
        if (meProgressDragging) meSeekFromProgressEvent(e);
    });
    document.addEventListener('touchmove', (e) => {
        if (meProgressDragging) meSeekFromProgressEvent(e);
    }, { passive: true });
    document.addEventListener('mouseup', () => { meProgressDragging = false; });
    document.addEventListener('touchend', () => { meProgressDragging = false; });
}

if (meSpeedSelect) {
    meSpeedSelect.addEventListener('change', () => {
        const speed = parseFloat(meSpeedSelect.value) || 1;
        meLog(`Playback speed: ${speed}×`, 'info');
        if (meIsPlaying) {
            const ct = mePlayOffset + (meAudioContext.currentTime - mePlayStartTime) * speed;
            meStartPlayback(Math.max(0, ct));
        }
    });
}

if (meZoomSelectionBtn) {
    meZoomSelectionBtn.addEventListener('click', () => {
        if (!meAudioBuffer) return;
        const selDur = meSelEnd - meSelStart;
        if (selDur < 0.001) {
            meShowStatus('Selection too small to zoom into.', 'error');
            return;
        }
        const padding = selDur * 0.05;
        const prevSelStart = meSelStart;
        const prevSelEnd = meSelEnd;

        meWindowStart = Math.max(0, prevSelStart - padding);
        const windowEnd = Math.min(meAudioBuffer.duration, prevSelEnd + padding);
        meWindowDuration = windowEnd - meWindowStart;

        meSelStart = meWindowStart;
        meSelEnd = meWindowStart + meWindowDuration;

        meWindowDurInput.value = meWindowDuration;
        meWindowDurDisplay.textContent = meWindowDuration < 1
            ? (meWindowDuration * 1000).toFixed(0) + 'ms'
            : meWindowDuration.toFixed(2) + 's';
        meTimestampInput.value = meWindowStart.toFixed(4);
        meWindowInfo.textContent = `Showing ${meFmtSec(meWindowStart)} → ${meFmtSec(windowEnd)}`;

        meGenerateWaveform();
        meDrawWaveform();
        meUpdateHandles();
        meUpdateSelDisplays();
        meLog(`Zoomed to selection: ${meFmtSec(prevSelStart)} → ${meFmtSec(prevSelEnd)} (${meFmtMs(selDur)})`, 'info');
    });
}

window.addEventListener('resize', () => {
    if (meAudioBuffer) {
        meDrawWaveform();
        meUpdateHandles();
    }
});

window.meReceiveFile = function(file) {
    meHandleFile(file);
};
