let volumeAudioFile = null;
let volumeAudioBuffer = null;
let volumeOriginalBuffer = null;
let volumeAudioContext = null;
let volumeSourceNode = null;
let volumeGainNode = null;
let isVolumePlaying = false;
let volumePlayStartTime = 0;
let volumePlayOffset = 0;
let volumeAnimationFrameId = null;
let volumeWaveformData = null;
let volumeSelectionStart = 0;
let volumeSelectionEnd = 0;
let volumeDraggingHandle = null;
let volumeEdits = [];

const TARGET_LUFS = -14;

const dropZone = document.getElementById('volume-drop-zone');
const fileInput = document.getElementById('volume-file-input');
const browseButton = document.getElementById('volume-browse-button');
const fileNameDisplay = document.getElementById('volume-file-name');
const editorSection = document.getElementById('volume-editor');
const waveformCanvas = document.getElementById('volume-waveform');
const waveformContainer = document.getElementById('volume-waveform-container');
const selectionDiv = document.getElementById('volume-selection');
const handleStart = document.getElementById('volume-handle-start');
const handleEnd = document.getElementById('volume-handle-end');
const playheadDiv = document.getElementById('volume-playhead');
const timeStartDisplay = document.getElementById('volume-time-start');
const timeEndDisplay = document.getElementById('volume-time-end');
const playBtn = document.getElementById('volume-play-btn');
const currentTimeDisplay = document.getElementById('volume-current-time');
const durationDisplay = document.getElementById('volume-duration');
const selStartInput = document.getElementById('volume-sel-start');
const selEndInput = document.getElementById('volume-sel-end');
const volumeLevelInput = document.getElementById('volume-level');
const volumeUpBtn = document.getElementById('volume-up-btn');
const volumeDownBtn = document.getElementById('volume-down-btn');
const normalizeBtn = document.getElementById('volume-normalize-btn');
const trimStartToggle = document.getElementById('volume-trim-start');
const trimEndToggle = document.getElementById('volume-trim-end');
const advancedToggle = document.getElementById('volume-advanced-toggle');
const advancedSection = document.getElementById('volume-advanced-section');
const sectionLevelInput = document.getElementById('volume-section-level');
const addEditBtn = document.getElementById('volume-add-edit-btn');
const editsListDiv = document.getElementById('volume-edits-list');
const outputFormatSelect = document.getElementById('volume-output-format');
const outputNameInput = document.getElementById('volume-output-name');
const applyBtn = document.getElementById('volume-apply-btn');
const statusMessage = document.getElementById('volume-status-message');
const consoleBox = document.getElementById('volume-console-box');
const helpButton = document.getElementById('volume-help-button');

function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
}

function logToConsole(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = 'console-entry';
    
    const timestamp = document.createElement('span');
    timestamp.className = 'console-timestamp';
    timestamp.textContent = `[${getTimestamp()}]`;
    
    const text = document.createElement('span');
    text.textContent = message;
    
    if (type === 'error') text.style.color = '#ef4444';
    else if (type === 'success') text.style.color = '#22c55e';
    else if (type === 'info') text.style.color = '#3b82f6';
    
    entry.appendChild(timestamp);
    entry.appendChild(text);
    consoleBox.appendChild(entry);
    const _entries = consoleBox.querySelectorAll('.console-entry');
    if (_entries.length > 20) _entries[0].remove();
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

function clearConsole() {
    consoleBox.innerHTML = '';
}

function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-badge ' + type;
}

function formatTimeSimple(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeDecimal(seconds) {
    return seconds.toFixed(2);
}

function parseTimeDecimal(timeStr) {
    const val = parseFloat(timeStr);
    return isNaN(val) ? 0 : Math.max(0, val);
}

function calculateRMS(buffer) {
    let sumSquares = 0;
    let totalSamples = 0;
    const SILENCE_THRESHOLD = 0.001; 
    
    
    let maxAmp = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
            const absVal = Math.abs(data[i]);
            if (absVal > maxAmp) maxAmp = absVal;
        }
    }
    
    
    const PEAK_IGNORE_THRESHOLD = maxAmp * 0.98;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
            const absVal = Math.abs(data[i]);
            
            if (absVal > SILENCE_THRESHOLD && absVal < PEAK_IGNORE_THRESHOLD) {
                sumSquares += data[i] * data[i];
                totalSamples++;
            }
        }
    }
    
    
    if (totalSamples === 0) {
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                sumSquares += data[i] * data[i];
                totalSamples++;
            }
        }
    }
    
    return Math.sqrt(sumSquares / totalSamples);
}

function rmsToLUFS(rms) {
    if (rms === 0) return -Infinity;
    return 20 * Math.log10(rms) - 0.691;
}

function calculateNormalizationGain(buffer) {
    const rms = calculateRMS(buffer);
    const currentLUFS = rmsToLUFS(rms);
    const gainDB = TARGET_LUFS - currentLUFS;
    return Math.pow(10, gainDB / 20);
}

function updateNormalizeInfo() {
    if (!volumeAudioBuffer) return;
    const rms = calculateRMS(volumeAudioBuffer);
    const currentLUFS = rmsToLUFS(rms);
    const gainDB = TARGET_LUFS - currentLUFS;
    logToConsole(`Current level: ${currentLUFS.toFixed(1)} LUFS, Target: ${TARGET_LUFS} LUFS, Gain needed: ${gainDB.toFixed(1)} dB`, 'info');
}

async function handleFileSelect(file) {
    if (!file) return;
    
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.mp3') && !ext.endsWith('.wav')) {
        showStatus('Please select a valid audio file (.mp3 or .wav)', 'error');
        return;
    }
    
    volumeAudioFile = file;
    fileNameDisplay.textContent = file.name;
    
    if (!outputNameInput.value) {
        const baseName = file.name.replace(/\.(mp3|wav)$/i, '');
        outputNameInput.value = baseName + '_adjusted';
    }
    
    showStatus('Loading audio file...', 'info');
    logToConsole('Loading: ' + file.name, 'info');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        volumeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        volumeAudioBuffer = await volumeAudioContext.decodeAudioData(arrayBuffer);
        volumeOriginalBuffer = copyAudioBuffer(volumeAudioBuffer);
        
        volumeSelectionStart = 0;
        volumeSelectionEnd = volumeAudioBuffer.duration;
        volumeEdits = [];
        
        generateWaveformData();
        drawWaveform();
        updateHandles();
        updateTimeDisplays();
        updateNormalizeInfo();
        renderEditsList();
        
        editorSection.classList.remove('hidden');
        showStatus('Audio loaded: ' + formatTimeSimple(volumeAudioBuffer.duration), 'success');
        logToConsole('Loaded successfully. Duration: ' + formatTimeSimple(volumeAudioBuffer.duration), 'success');
        logToConsole('Channels: ' + volumeAudioBuffer.numberOfChannels + ', Sample Rate: ' + volumeAudioBuffer.sampleRate + ' Hz', 'info');
    } catch (error) {
        showStatus('Error loading audio: ' + error.message, 'error');
        logToConsole('Error: ' + error.message, 'error');
    }
}

function copyAudioBuffer(buffer) {
    const copy = volumeAudioContext.createBuffer(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate
    );
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        copy.copyToChannel(buffer.getChannelData(ch).slice(), ch);
    }
    return copy;
}

function generateWaveformData() {
    if (!volumeAudioBuffer) return;
    
    const channelData = volumeAudioBuffer.getChannelData(0);
    const samples = 2000;
    const blockSize = Math.floor(channelData.length / samples);
    volumeWaveformData = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
        }
        volumeWaveformData[i] = sum / blockSize;
    }
}

function drawWaveform() {
    if (!volumeWaveformData || !waveformCanvas) return;
    
    const ctx = waveformCanvas.getContext('2d');
    const rect = waveformContainer.getBoundingClientRect();
    const width = rect.width || waveformContainer.clientWidth;
    const height = rect.height || waveformContainer.clientHeight;
    
    if (width <= 0 || height <= 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    waveformCanvas.width = width * dpr;
    waveformCanvas.height = height * dpr;
    waveformCanvas.style.width = width + 'px';
    waveformCanvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);
    
    const samplesPerPixel = volumeWaveformData.length / width;
    const centerY = height / 2;
    
    ctx.fillStyle = '#64748b';
    
    for (let x = 0; x < width; x++) {
        const startSample = Math.floor(x * samplesPerPixel);
        const endSample = Math.floor((x + 1) * samplesPerPixel);
        
        let max = 0;
        for (let i = startSample; i < endSample && i < volumeWaveformData.length; i++) {
            if (volumeWaveformData[i] > max) max = volumeWaveformData[i];
        }
        
        const barHeight = max * height * 0.85;
        ctx.fillRect(x, centerY - barHeight / 2, 1, barHeight);
    }
    
    if (volumeEdits.length > 0 && volumeAudioBuffer) {
        ctx.globalAlpha = 0.3;
        for (const edit of volumeEdits) {
            const startX = (edit.start / volumeAudioBuffer.duration) * width;
            const endX = (edit.end / volumeAudioBuffer.duration) * width;
            ctx.fillStyle = edit.volume >= 0 ? '#22c55e' : '#ef4444';
            ctx.fillRect(startX, 0, endX - startX, height);
        }
        ctx.globalAlpha = 1;
    }
}

function updateTimeDisplays() {
    if (!volumeAudioBuffer) return;
    
    timeStartDisplay.textContent = formatTimeSimple(0);
    timeEndDisplay.textContent = formatTimeSimple(volumeAudioBuffer.duration);
    durationDisplay.textContent = formatTimeSimple(volumeAudioBuffer.duration);
    selStartInput.value = formatTimeDecimal(volumeSelectionStart);
    selEndInput.value = formatTimeDecimal(volumeSelectionEnd);
}

function updateHandles() {
    if (!volumeAudioBuffer || !waveformContainer) return;
    
    const width = waveformContainer.clientWidth;
    const duration = volumeAudioBuffer.duration;
    
    const startX = (volumeSelectionStart / duration) * width;
    const endX = (volumeSelectionEnd / duration) * width;
    
    handleStart.style.left = (startX - 8) + 'px';
    handleEnd.style.left = (endX - 8) + 'px';
    
    selectionDiv.style.left = startX + 'px';
    selectionDiv.style.width = (endX - startX) + 'px';
    
    selStartInput.value = formatTimeDecimal(volumeSelectionStart);
    selEndInput.value = formatTimeDecimal(volumeSelectionEnd);
}

function updatePlayhead() {
    if (!volumeAudioBuffer || !isVolumePlaying) return;
    
    const currentTime = volumePlayOffset + (volumeAudioContext.currentTime - volumePlayStartTime);
    const width = waveformContainer.clientWidth;
    const x = (currentTime / volumeAudioBuffer.duration) * width;
    
    playheadDiv.style.left = x + 'px';
    currentTimeDisplay.textContent = formatTimeSimple(currentTime);
    
    if (currentTime < volumeAudioBuffer.duration) {
        volumeAnimationFrameId = requestAnimationFrame(updatePlayhead);
    } else {
        stopPlayback();
    }
}

function findSilenceStart(buffer, threshold = 0.01) {
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > threshold) {
            return i;
        }
    }
    return 0;
}

function findSilenceEnd(buffer, threshold = 0.01) {
    const data = buffer.getChannelData(0);
    for (let i = data.length - 1; i >= 0; i--) {
        if (Math.abs(data[i]) > threshold) {
            return i + 1;
        }
    }
    return data.length;
}

function trimBuffer(buffer, startSample, endSample) {
    const newLength = endSample - startSample;
    if (newLength <= 0) return buffer;
    
    const trimmedBuffer = volumeAudioContext.createBuffer(
        buffer.numberOfChannels,
        newLength,
        buffer.sampleRate
    );
    
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const sourceData = buffer.getChannelData(ch);
        const destData = trimmedBuffer.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
            destData[i] = sourceData[startSample + i];
        }
    }
    
    return trimmedBuffer;
}

function applyVolumeToBuffer(buffer, volumePercent, startTime = 0, endTime = null) {
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = endTime ? Math.floor(endTime * sampleRate) : buffer.length;
    const gain = 1 + (volumePercent / 100);
    
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = startSample; i < endSample && i < data.length; i++) {
            data[i] = Math.max(-1, Math.min(1, data[i] * gain));
        }
    }
}

function normalizeBuffer(buffer) {
    const gain = calculateNormalizationGain(buffer);
    
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.max(-1, Math.min(1, data[i] * gain));
        }
    }
    
    return gain;
}

function createPreviewBufferWithEdits() {
    let previewBuffer = copyAudioBuffer(volumeAudioBuffer);
    
    for (const edit of volumeEdits) {
        applyVolumeToBuffer(previewBuffer, edit.volume, edit.start, edit.end);
    }
    
    return previewBuffer;
}

function updateLiveGain() {
    if (volumeGainNode) {
        const globalVolume = parseInt(volumeLevelInput.value) || 0;
        const gain = 1 + (globalVolume / 100);
        volumeGainNode.gain.setValueAtTime(gain, volumeAudioContext.currentTime);
    }
}

function startPlayback(startTime = 0) {
    if (!volumeAudioBuffer) return;
    
    stopPlayback();
    
    const previewBuffer = createPreviewBufferWithEdits();
    
    volumeSourceNode = volumeAudioContext.createBufferSource();
    volumeSourceNode.buffer = previewBuffer;
    
    const globalVolume = parseInt(volumeLevelInput.value) || 0;
    const gain = 1 + (globalVolume / 100);
    
    volumeGainNode = volumeAudioContext.createGain();
    volumeGainNode.gain.setValueAtTime(gain, volumeAudioContext.currentTime);
    
    volumeSourceNode.connect(volumeGainNode);
    volumeGainNode.connect(volumeAudioContext.destination);
    
    volumeSourceNode.start(0, startTime);
    volumeSourceNode.onended = () => {
        if (isVolumePlaying) stopPlayback();
    };
    
    volumePlayStartTime = volumeAudioContext.currentTime;
    volumePlayOffset = startTime;
    isVolumePlaying = true;
    
    playBtn.innerHTML = '<span class="material-symbols-outlined text-2xl text-white">pause</span>';
    volumeAnimationFrameId = requestAnimationFrame(updatePlayhead);
}

function stopPlayback() {
    if (volumeSourceNode) {
        try {
            volumeSourceNode.stop();
        } catch (e) {}
        volumeSourceNode = null;
    }
    
    if (volumeAnimationFrameId) {
        cancelAnimationFrame(volumeAnimationFrameId);
        volumeAnimationFrameId = null;
    }
    
    isVolumePlaying = false;
    playBtn.innerHTML = '<span class="material-symbols-outlined text-2xl text-white">play_arrow</span>';
}

async function bufferToWav(buffer, progressCallback) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const data = [];
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            data.push(intSample & 0xFF);
            data.push((intSample >> 8) & 0xFF);
        }
        if (progressCallback && i % 100000 === 0) {
            await progressCallback(`Converting to WAV: ${Math.round((i/buffer.length)*100)}%`);
        }
    }
    
    const dataSize = data.length;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    
    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);
    
    function writeString(offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    const uint8View = new Uint8Array(arrayBuffer);
    for (let i = 0; i < data.length; i++) {
        uint8View[headerSize + i] = data[i];
        if (progressCallback && i % 500000 === 0) {
            await progressCallback(`Writing data: ${Math.round((i/data.length)*100)}%`);
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function bufferToMp3(buffer, progressCallback) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 320);
    
    const mp3Data = [];
    const sampleBlockSize = 1152;
    const samples = buffer.length;
    
    const left = buffer.getChannelData(0);
    const right = numChannels > 1 ? buffer.getChannelData(1) : left;
    
    const leftInt16 = new Int16Array(samples);
    const rightInt16 = new Int16Array(samples);
    
    for (let i = 0; i < samples; i++) {
        leftInt16[i] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
        rightInt16[i] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
        if (progressCallback && i % 100000 === 0) {
            await progressCallback(`Preparing: ${Math.round((i/samples)*100)}%`);
        }
    }
    
    for (let i = 0; i < samples; i += sampleBlockSize) {
        const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
        const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
        
        let mp3buf;
        if (numChannels === 1) {
            mp3buf = mp3encoder.encodeBuffer(leftChunk);
        } else {
            mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        }
        
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
        if (progressCallback && i % (sampleBlockSize * 10) === 0) {
            await progressCallback(`Encoding: ${Math.round((i/samples)*100)}%`);
        }
    }
    
    const end = mp3encoder.flush();
    if (end.length > 0) {
        mp3Data.push(end);
    }
    
    return new Blob(mp3Data, { type: 'audio/mp3' });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function renderEditsList() {
    editsListDiv.innerHTML = '';
    
    if (volumeEdits.length === 0) {
        editsListDiv.innerHTML = '<p class="text-sm text-slate-500">No section edits added yet.</p>';
        return;
    }
    
    volumeEdits.forEach((edit, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-surface-800 rounded-lg';
        div.innerHTML = `
            <span class="text-sm text-slate-300">
                ${formatTimeDecimal(edit.start)}s - ${formatTimeDecimal(edit.end)}s: 
                <span class="${edit.volume >= 0 ? 'text-green-400' : 'text-red-400'}">${edit.volume >= 0 ? '+' : ''}${edit.volume}%</span>
            </span>
            <button class="text-slate-400 hover:text-red-400" data-index="${index}">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        `;
        
        div.querySelector('button').addEventListener('click', () => {
            stopPlayback();
            volumeEdits.splice(index, 1);
            renderEditsList();
            drawWaveform();
            logToConsole(`Removed volume edit #${index + 1}`, 'info');
        });
        
        editsListDiv.appendChild(div);
    });
}

if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
    
    dropZone.addEventListener('click', () => fileInput.click());
}

if (browseButton) {
    browseButton.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

function handleDragStart(e, handle) {
    e.preventDefault();
    volumeDraggingHandle = handle;
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove);
    document.addEventListener('touchend', handleDragEnd);
}

function handleDragMove(e) {
    if (!volumeDraggingHandle || !volumeAudioBuffer) return;
    
    const rect = waveformContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const time = (x / rect.width) * volumeAudioBuffer.duration;
    
    if (volumeDraggingHandle === 'start') {
        volumeSelectionStart = Math.min(time, volumeSelectionEnd - 0.1);
    } else if (volumeDraggingHandle === 'end') {
        volumeSelectionEnd = Math.max(time, volumeSelectionStart + 0.1);
    }
    
    updateHandles();
}

function handleDragEnd() {
    volumeDraggingHandle = null;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
}

if (handleStart) {
    handleStart.addEventListener('mousedown', (e) => handleDragStart(e, 'start'));
    handleStart.addEventListener('passive', (e) => handleDragStart(e, 'start'));
}

if (handleEnd) {
    handleEnd.addEventListener('mousedown', (e) => handleDragStart(e, 'end'));
    handleEnd.addEventListener('passive', (e) => handleDragStart(e, 'end'));
}

if (waveformContainer) {
    waveformContainer.addEventListener('click', (e) => {
        if (volumeDraggingHandle) return;
        if (e.target.closest('.volume-handle')) return;
        if (!volumeAudioBuffer) return;
        
        const rect = waveformContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickTime = (x / rect.width) * volumeAudioBuffer.duration;
        
        if (isVolumePlaying) {
            stopPlayback();
        }
        startPlayback(clickTime);
        logToConsole('Playing from ' + formatTimeSimple(clickTime), 'info');
    });
}

if (playBtn) {
    playBtn.addEventListener('click', () => {
        if (isVolumePlaying) {
            stopPlayback();
        } else {
            startPlayback(0);
        }
    });
}

if (volumeUpBtn) {
    volumeUpBtn.addEventListener('click', () => {
        const current = parseInt(volumeLevelInput.value) || 0;
        volumeLevelInput.value = Math.min(200, current + 10);
        updateLiveGain();
    });
}

if (volumeDownBtn) {
    volumeDownBtn.addEventListener('click', () => {
        const current = parseInt(volumeLevelInput.value) || 0;
        volumeLevelInput.value = Math.max(-100, current - 10);
        updateLiveGain();
    });
}

if (volumeLevelInput) {
    volumeLevelInput.addEventListener('input', updateLiveGain);
    volumeLevelInput.addEventListener('change', updateLiveGain);
}

if (normalizeBtn) {
    normalizeBtn.addEventListener('click', async () => {
        if (!volumeAudioBuffer) return;
        
        const liveBox = document.querySelector('.live-anim-box');
        if (liveBox) liveBox.classList.add('active');
        
        await new Promise(r => setTimeout(r, 50));

        try {
            stopPlayback();
            
            volumeAudioBuffer = copyAudioBuffer(volumeOriginalBuffer);
            const gain = normalizeBuffer(volumeAudioBuffer);
            const gainDB = 20 * Math.log10(gain);
            
            volumeLevelInput.value = 0;
            volumeEdits = [];
            
            generateWaveformData();
            drawWaveform();
            updateNormalizeInfo();
            renderEditsList();
            
            logToConsole(`Normalized audio (gain: ${gainDB.toFixed(1)} dB)`, 'success');
            showStatus('Audio normalized to standard level', 'success');
        } finally {
            if (liveBox) liveBox.classList.remove('active');
        }
    });
}

if (advancedToggle) {
    advancedToggle.addEventListener('click', () => {
        const isHidden = advancedSection.classList.contains('hidden');
        advancedSection.classList.toggle('hidden');
        advancedToggle.innerHTML = isHidden 
            ? '<span class="material-symbols-outlined text-lg">expand_less</span> Hide Advanced'
            : '<span class="material-symbols-outlined text-lg">expand_more</span> Show Advanced';
        
        if (isHidden && volumeAudioBuffer) {
            setTimeout(() => {
                drawWaveform();
                updateHandles();
            }, 50);
        }
    });
}

if (addEditBtn) {
    addEditBtn.addEventListener('click', () => {
        if (!volumeAudioBuffer) return;
        
        const volumeChange = parseInt(sectionLevelInput.value) || 0;
        
        if (volumeChange === 0) {
            showStatus('Please set a non-zero volume change', 'error');
            return;
        }
        
        stopPlayback();
        
        volumeEdits.push({
            start: volumeSelectionStart,
            end: volumeSelectionEnd,
            volume: volumeChange
        });
        
        renderEditsList();
        drawWaveform();
        logToConsole(`Added volume edit: ${formatTimeDecimal(volumeSelectionStart)}s - ${formatTimeDecimal(volumeSelectionEnd)}s (${volumeChange >= 0 ? '+' : ''}${volumeChange}%)`, 'success');
    });
}

if (selStartInput) {
    selStartInput.addEventListener('change', () => {
        if (!volumeAudioBuffer) return;
        const val = parseTimeDecimal(selStartInput.value);
        volumeSelectionStart = Math.max(0, Math.min(volumeSelectionEnd - 0.1, val));
        updateHandles();
    });
}

if (selEndInput) {
    selEndInput.addEventListener('change', () => {
        if (!volumeAudioBuffer) return;
        const val = parseTimeDecimal(selEndInput.value);
        volumeSelectionEnd = Math.min(volumeAudioBuffer.duration, Math.max(volumeSelectionStart + 0.1, val));
        updateHandles();
    });
}

if (trimStartToggle) {
    trimStartToggle.addEventListener('change', stopPlayback);
}

if (trimEndToggle) {
    trimEndToggle.addEventListener('change', stopPlayback);
}

if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
        if (!volumeAudioBuffer) {
            showStatus('Please load an audio file first', 'error');
            return;
        }
        
        const liveBox = document.querySelector('.live-anim-box');
        if (liveBox) liveBox.classList.add('active');
        
        await new Promise(r => setTimeout(r, 50));
        clearConsole();
        logToConsole('=== Applying Volume Changes ===', 'info');
        showStatus('Processing...', 'info');
        
        try {
            let resultBuffer = copyAudioBuffer(volumeOriginalBuffer);
            
            const globalVolume = parseInt(volumeLevelInput.value) || 0;
            if (globalVolume !== 0) {
                applyVolumeToBuffer(resultBuffer, globalVolume);
            }
            
            for (let i = 0; i < volumeEdits.length; i++) {
                applyVolumeToBuffer(resultBuffer, volumeEdits[i].volume, volumeEdits[i].start, volumeEdits[i].end);
            }
            
            const trimStart = trimStartToggle && trimStartToggle.checked;
            const trimEnd = trimEndToggle && trimEndToggle.checked;
            
            if (trimStart || trimEnd) {
                let startSample = 0;
                let endSample = resultBuffer.length;
                if (trimStart) startSample = findSilenceStart(resultBuffer);
                if (trimEnd) endSample = findSilenceEnd(resultBuffer);
                if (startSample > 0 || endSample < resultBuffer.length) {
                    resultBuffer = trimBuffer(resultBuffer, startSample, endSample);
                }
            }
            
            const outputFormat = outputFormatSelect.value;
            const outputName = outputNameInput.value || 'audio_adjusted';
            
            logToConsole(`Converting to ${outputFormat.toUpperCase()}...`, 'info');
            
            const encodeProgress = async (msg) => {
                showStatus(msg, 'info');
                await new Promise(r => setTimeout(r, 0));
            };

            let blob;
            if (outputFormat === 'mp3') {
                blob = await bufferToMp3(resultBuffer, encodeProgress);
            } else {
                blob = await bufferToWav(resultBuffer, encodeProgress);
            }

            window._volumeLastBlob = blob;
            window._volumeLastFilename = `${outputName}.${outputFormat}`;

            if (window._volumePendingSendDest) {
                const dest = window._volumePendingSendDest;
                window._volumePendingSendDest = null;
                if (window.audioSendToTool) window.audioSendToTool(blob, `${outputName}.${outputFormat}`, dest);
                showStatus('Sent!', 'success');
                logToConsole(`Sent to ${dest === 'metadata-editor' ? 'Metadata Editor' : 'Cropper'}: ${outputName}.${outputFormat}`, 'success');
            } else {
                downloadBlob(blob, `${outputName}.${outputFormat}`);
                showStatus('Volume adjustment complete!', 'success');
                logToConsole(`Downloaded: ${outputName}.${outputFormat}`, 'success');
            }
            logToConsole('=== Processing Complete ===', 'success');
            
        } catch (error) {
            showStatus('Error: ' + error.message, 'error');
            logToConsole('Error: ' + error.message, 'error');
        } finally {
            document.querySelector('.live-anim-box').classList.remove('active');
        }
    });
}

function openVolumeHelpModal() {
    const modal = document.getElementById('help-modal');
    const content = document.getElementById('help-modal-content');
    
    content.innerHTML = `
        <h3 class="text-xl font-bold text-white mb-2">Volume Controls Help</h3>
        <ul class="list-disc list-inside mb-4 leading-tight">
            <li><strong class="text-white">Volume +/-</strong> - Adjust the overall volume of the entire file by percentage</li>
            <li><strong class="text-white">Normalize to Standard</strong> - Automatically adjusts volume to -14 LUFS (streaming standard)</li>
            <li><strong class="text-white">Trim Start/End Silence</strong> - Removes silent portions from the beginning or end of the audio</li>
            <li><strong class="text-white">Advanced Section Editor</strong> - Select specific sections of audio to apply different volume levels</li>
            <li><strong class="text-white">Click Waveform</strong> - Click anywhere on the waveform to preview from that position</li>
            <li><strong class="text-white">Drag Handles</strong> - Drag the blue handles to select a section for volume editing</li>
        </ul>
        <p class="leading-snug">All processing is done in your browser - no data is uploaded.</p>
    `;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

if (helpButton) {
    helpButton.addEventListener('click', openVolumeHelpModal);
}

window.volumeReceiveFile = handleFileSelect;

const volumeSendToBtn = document.getElementById('volume-send-to-btn');
if (volumeSendToBtn) {
    volumeSendToBtn.addEventListener('click', () => {
        const blob = window._volumeLastBlob;
        const filename = window._volumeLastFilename;
        const dest = document.getElementById('volume-send-to-select').value;
        if (blob && filename) {
            if (window.audioSendToTool) window.audioSendToTool(blob, filename, dest);
        } else {
            window._volumePendingSendDest = dest;
            if (applyBtn) applyBtn.click();
        }
    });
}

window.addEventListener('resize', () => {
    if (volumeAudioBuffer) {
        drawWaveform();
        updateHandles();
    }
});

if (waveformContainer) {
    const resizeObserver = new ResizeObserver(() => {
        if (volumeAudioBuffer && waveformContainer.clientWidth > 0) {
            drawWaveform();
            updateHandles();
        }
    });
    resizeObserver.observe(waveformContainer);
}
