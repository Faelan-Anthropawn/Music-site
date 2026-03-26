let cropperAudioFile = null;
let cropperAudioBuffer = null;
let cropperAudioContext = null;
let cropperSourceNode = null;
let cropperGainNode = null;
let isPlaying = false;
let playStartTime = 0;
let playOffset = 0;
let animationFrameId = null;
let selectionStart = 0;
let selectionEnd = 0;
let waveformData = null;
let keepMode = true;
let draggingHandle = null;

const dropZone = document.getElementById('cropper-drop-zone');
const fileInput = document.getElementById('cropper-file-input');
const browseButton = document.getElementById('cropper-browse-button');
const fileNameDisplay = document.getElementById('cropper-file-name');
const editorSection = document.getElementById('cropper-editor');
const waveformCanvas = document.getElementById('cropper-waveform');
const waveformContainer = document.getElementById('cropper-waveform-container');
const selectionDiv = document.getElementById('cropper-selection');
const handleStart = document.getElementById('cropper-handle-start');
const handleEnd = document.getElementById('cropper-handle-end');
const playheadDiv = document.getElementById('cropper-playhead');
const timeStartDisplay = document.getElementById('cropper-time-start');
const timeEndDisplay = document.getElementById('cropper-time-end');
const playBtn = document.getElementById('cropper-play-btn');
const currentTimeDisplay = document.getElementById('cropper-current-time');
const durationDisplay = document.getElementById('cropper-duration');
const selStartInput = document.getElementById('cropper-sel-start');
const selEndInput = document.getElementById('cropper-sel-end');
const startDecBtn = document.getElementById('cropper-start-dec');
const startIncBtn = document.getElementById('cropper-start-inc');
const endDecBtn = document.getElementById('cropper-end-dec');
const endIncBtn = document.getElementById('cropper-end-inc');
const modeToggle = document.getElementById('cropper-mode-toggle');
const modeBtnText = document.getElementById('cropper-mode-btn-text');
const modeText = document.getElementById('cropper-mode-text');
const fadeInDuration = document.getElementById('cropper-fade-in-duration');
const fadeOutDuration = document.getElementById('cropper-fade-out-duration');
const outputNameInput = document.getElementById('cropper-output-name');
const outputFormatSelect = document.getElementById('cropper-output-format');
const cropBtn = document.getElementById('cropper-crop-btn');
const statusMessage = document.getElementById('cropper-status-message');
const consoleBox = document.getElementById('cropper-console-box');
const helpButton = document.getElementById('cropper-help-button');

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

async function handleFileSelect(file) {
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.mp3') && !ext.endsWith('.wav')) {
        showStatus('Please select a valid audio file (.mp3 or .wav)', 'error');
        return;
    }

    cropperAudioFile = file;
    fileNameDisplay.textContent = file.name;

    if (!outputNameInput.value) {
        const baseName = file.name.replace(/\.(mp3|wav)$/i, '');
        outputNameInput.value = baseName + '_cropped';
    }

    showStatus('Loading audio file...', 'info');
    logToConsole('Loading: ' + file.name, 'info');

    try {
        const arrayBuffer = await file.arrayBuffer();
        cropperAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        cropperAudioBuffer = await cropperAudioContext.decodeAudioData(arrayBuffer);

        selectionStart = 0;
        selectionEnd = cropperAudioBuffer.duration;

        generateWaveformData();
        drawWaveform();
        updateHandles();
        updateTimeDisplays();

        editorSection.classList.remove('hidden');
        showStatus('Audio loaded: ' + formatTimeSimple(cropperAudioBuffer.duration), 'success');
        logToConsole('Loaded successfully. Duration: ' + formatTimeSimple(cropperAudioBuffer.duration), 'success');
        logToConsole('Channels: ' + cropperAudioBuffer.numberOfChannels + ', Sample Rate: ' + cropperAudioBuffer.sampleRate + ' Hz', 'info');
    } catch (error) {
        showStatus('Error loading audio: ' + error.message, 'error');
        logToConsole('Error: ' + error.message, 'error');
    }
}

function generateWaveformData() {
    if (!cropperAudioBuffer) return;

    const channelData = cropperAudioBuffer.getChannelData(0);
    const samples = 2000;
    const blockSize = Math.floor(channelData.length / samples);
    waveformData = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
        }
        waveformData[i] = sum / blockSize;
    }
}

function drawWaveform() {
    if (!waveformData || !waveformCanvas) return;

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

    const samplesPerPixel = waveformData.length / width;
    const centerY = height / 2;

    ctx.fillStyle = '#64748b';

    for (let x = 0; x < width; x++) {
        const startSample = Math.floor(x * samplesPerPixel);
        const endSample = Math.floor((x + 1) * samplesPerPixel);

        let max = 0;
        for (let i = startSample; i < endSample && i < waveformData.length; i++) {
            if (waveformData[i] > max) max = waveformData[i];
        }

        const barHeight = max * height * 0.85;
        ctx.fillRect(x, centerY - barHeight / 2, 1, barHeight);
    }
}

function updateTimeDisplays() {
    if (!cropperAudioBuffer) return;

    timeStartDisplay.textContent = formatTimeSimple(0);
    timeEndDisplay.textContent = formatTimeSimple(cropperAudioBuffer.duration);
    durationDisplay.textContent = formatTimeSimple(cropperAudioBuffer.duration);
    selStartInput.value = formatTimeDecimal(selectionStart);
    selEndInput.value = formatTimeDecimal(selectionEnd);
}

function updateHandles() {
    if (!cropperAudioBuffer || !waveformContainer) return;

    const width = waveformContainer.clientWidth;
    const duration = cropperAudioBuffer.duration;

    const startX = (selectionStart / duration) * width;
    const endX = (selectionEnd / duration) * width;

    handleStart.style.left = (startX - 8) + 'px';
    handleEnd.style.left = (endX - 8) + 'px';

    selectionDiv.style.left = startX + 'px';
    selectionDiv.style.width = (endX - startX) + 'px';

    selStartInput.value = formatTimeDecimal(selectionStart);
    selEndInput.value = formatTimeDecimal(selectionEnd);
}

function updatePlayhead() {
    if (!cropperAudioBuffer || !isPlaying) return;

    const currentTime = playOffset + (cropperAudioContext.currentTime - playStartTime);
    const width = waveformContainer.clientWidth;
    const x = (currentTime / cropperAudioBuffer.duration) * width;

    playheadDiv.style.left = x + 'px';
    currentTimeDisplay.textContent = formatTimeSimple(currentTime);

    if (currentTime < cropperAudioBuffer.duration) {
        animationFrameId = requestAnimationFrame(updatePlayhead);
    } else {
        stopPlayback();
    }
}

function startPlayback(startTime = 0, endTime = null, fadeIn = 0, fadeOut = 0) {
    if (!cropperAudioBuffer) return;

    stopPlayback();

    const duration = endTime ? endTime - startTime : cropperAudioBuffer.duration - startTime;

    cropperSourceNode = cropperAudioContext.createBufferSource();
    cropperSourceNode.buffer = cropperAudioBuffer;

    cropperGainNode = cropperAudioContext.createGain();
    cropperSourceNode.connect(cropperGainNode);
    cropperGainNode.connect(cropperAudioContext.destination);

    if (fadeIn > 0) {
        cropperGainNode.gain.setValueAtTime(0, cropperAudioContext.currentTime);
        cropperGainNode.gain.linearRampToValueAtTime(1, cropperAudioContext.currentTime + fadeIn);
    }

    if (fadeOut > 0) {
        cropperGainNode.gain.setValueAtTime(1, cropperAudioContext.currentTime + duration - fadeOut);
        cropperGainNode.gain.linearRampToValueAtTime(0, cropperAudioContext.currentTime + duration);
    }

    cropperSourceNode.start(0, startTime, duration);
    cropperSourceNode.onended = () => {
        if (isPlaying) stopPlayback();
    };

    playStartTime = cropperAudioContext.currentTime;
    playOffset = startTime;
    isPlaying = true;

    playBtn.innerHTML = '<span class="material-symbols-outlined text-3xl text-white">pause</span>';
    animationFrameId = requestAnimationFrame(updatePlayhead);
}

function stopPlayback() {
    if (cropperSourceNode) {
        try {
            cropperSourceNode.stop();
        } catch (e) {}
        cropperSourceNode = null;
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    isPlaying = false;
    playBtn.innerHTML = '<span class="material-symbols-outlined text-3xl text-white">play_arrow</span>';
}

function extractSelection(keepSelection) {
    if (!cropperAudioBuffer) return null;

    const sampleRate = cropperAudioBuffer.sampleRate;
    const channels = cropperAudioBuffer.numberOfChannels;
    const startSample = Math.floor(selectionStart * sampleRate);
    const endSample = Math.floor(selectionEnd * sampleRate);

    let newLength, newBuffer;

    if (keepSelection) {
        newLength = endSample - startSample;
        newBuffer = cropperAudioContext.createBuffer(channels, newLength, sampleRate);

        for (let ch = 0; ch < channels; ch++) {
            const sourceData = cropperAudioBuffer.getChannelData(ch);
            const destData = newBuffer.getChannelData(ch);
            for (let i = 0; i < newLength; i++) {
                destData[i] = sourceData[startSample + i];
            }
        }
    } else {
        const beforeLength = startSample;
        const afterLength = cropperAudioBuffer.length - endSample;
        newLength = beforeLength + afterLength;

        if (newLength <= 0) return null;

        newBuffer = cropperAudioContext.createBuffer(channels, newLength, sampleRate);

        for (let ch = 0; ch < channels; ch++) {
            const sourceData = cropperAudioBuffer.getChannelData(ch);
            const destData = newBuffer.getChannelData(ch);

            for (let i = 0; i < beforeLength; i++) {
                destData[i] = sourceData[i];
            }
            for (let i = 0; i < afterLength; i++) {
                destData[beforeLength + i] = sourceData[endSample + i];
            }
        }
    }

    return newBuffer;
}

function applyFades(buffer, fadeInSecs, fadeOutSecs) {
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;
    const fadeInSamples = Math.floor(fadeInSecs * sampleRate);
    const fadeOutSamples = Math.floor(fadeOutSecs * sampleRate);

    for (let ch = 0; ch < channels; ch++) {
        const data = buffer.getChannelData(ch);

        for (let i = 0; i < fadeInSamples && i < data.length; i++) {
            data[i] *= i / fadeInSamples;
        }

        for (let i = 0; i < fadeOutSamples && i < data.length; i++) {
            const idx = data.length - 1 - i;
            data[idx] *= i / fadeOutSamples;
        }
    }

    return buffer;
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
        if (progressCallback && i % 1000000 === 0) {
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
        if (progressCallback && i % 5000000 === 0) {
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
        if (progressCallback && i % 1000000 === 0) {
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
        if (progressCallback && i % (sampleBlockSize * 100) === 0) {
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
browseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function getPositionFromEvent(e) {
    const rect = waveformContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(rect.width, clientX - rect.left));
}

function handleDragStart(e, handle) {
    e.preventDefault();
    draggingHandle = handle;
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove);
    document.addEventListener('touchend', handleDragEnd);
}

function handleDragMove(e) {
    if (!draggingHandle || !cropperAudioBuffer) return;

    const rect = waveformContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const time = (x / rect.width) * cropperAudioBuffer.duration;

    if (draggingHandle === 'start') {
        selectionStart = Math.min(time, selectionEnd - 0.1);
    } else if (draggingHandle === 'end') {
        selectionEnd = Math.max(time, selectionStart + 0.1);
    }

    updateHandles();
}

function handleDragEnd() {
    draggingHandle = null;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
}

handleStart.addEventListener('mousedown', (e) => handleDragStart(e, 'start'));
handleStart.addEventListener('passive', (e) => handleDragStart(e, 'start'));
handleEnd.addEventListener('mousedown', (e) => handleDragStart(e, 'end'));
handleEnd.addEventListener('passive', (e) => handleDragStart(e, 'end'));

waveformContainer.addEventListener('click', (e) => {
    if (draggingHandle) return;
    if (e.target.closest('.cropper-handle')) return;
    if (!cropperAudioBuffer) return;

    const rect = waveformContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / rect.width) * cropperAudioBuffer.duration;

    if (isPlaying) {
        stopPlayback();
    }
    startPlayback(clickTime);
    logToConsole('Playing from ' + formatTimeSimple(clickTime), 'info');
});

playBtn.addEventListener('click', () => {
    if (isPlaying) {
        stopPlayback();
    } else {
        const fadeIn = parseFloat(fadeInDuration.value) || 0;
        const fadeOut = parseFloat(fadeOutDuration.value) || 0;
        startPlayback(selectionStart, selectionEnd, fadeIn, fadeOut);
    }
});

modeToggle.addEventListener('click', () => {
    keepMode = !keepMode;
    if (keepMode) {
        modeBtnText.textContent = 'KEEP';
        modeText.textContent = 'keep';
        modeToggle.classList.remove('remove-mode');
        selectionDiv.classList.remove('bg-red-500/40');
        selectionDiv.classList.add('bg-green-500/40');
    } else {
        modeBtnText.textContent = 'REMOVE';
        modeText.textContent = 'remove';
        modeToggle.classList.add('remove-mode');
        selectionDiv.classList.remove('bg-green-500/40');
        selectionDiv.classList.add('bg-red-500/40');
    }
});

startDecBtn.addEventListener('click', () => {
    if (!cropperAudioBuffer) return;
    selectionStart = Math.max(0, selectionStart - 0.1);
    updateHandles();
});

startIncBtn.addEventListener('click', () => {
    if (!cropperAudioBuffer) return;
    selectionStart = Math.min(selectionEnd - 0.1, selectionStart + 0.1);
    updateHandles();
});

endDecBtn.addEventListener('click', () => {
    if (!cropperAudioBuffer) return;
    selectionEnd = Math.max(selectionStart + 0.1, selectionEnd - 0.1);
    updateHandles();
});

endIncBtn.addEventListener('click', () => {
    if (!cropperAudioBuffer) return;
    selectionEnd = Math.min(cropperAudioBuffer.duration, selectionEnd + 0.1);
    updateHandles();
});

selStartInput.addEventListener('change', () => {
    if (!cropperAudioBuffer) return;
    const val = parseTimeDecimal(selStartInput.value);
    selectionStart = Math.max(0, Math.min(selectionEnd - 0.1, val));
    updateHandles();
});

selEndInput.addEventListener('change', () => {
    if (!cropperAudioBuffer) return;
    const val = parseTimeDecimal(selEndInput.value);
    selectionEnd = Math.min(cropperAudioBuffer.duration, Math.max(selectionStart + 0.1, val));
    updateHandles();
});

cropBtn.addEventListener('click', async () => {
    if (!cropperAudioBuffer || selectionStart >= selectionEnd) {
        showStatus('Please select a portion of the audio first', 'error');
        return;
    }

    clearConsole();
    logToConsole('=== Starting Crop ===', 'info');
    logToConsole(`Mode: ${keepMode ? 'Keep' : 'Remove'} selection`, 'info');
    logToConsole(`Selection: ${formatTimeDecimal(selectionStart)}s - ${formatTimeDecimal(selectionEnd)}s`, 'info');

    const liveBox = document.querySelector('.live-anim-box');
    if (liveBox) liveBox.classList.add('active');
    
    await new Promise(r => setTimeout(r, 10));
    try {
        let resultBuffer = extractSelection(keepMode);

        if (!resultBuffer) {
            showStatus('Error: Could not process audio', 'error');
            logToConsole('Error: Could not process audio', 'error');
            return;
        }

        const fadeInSecs = parseFloat(fadeInDuration.value) || 0;
        const fadeOutSecs = parseFloat(fadeOutDuration.value) || 0;

        if (fadeInSecs > 0 || fadeOutSecs > 0) {
            logToConsole(`Applying fades: In=${fadeInSecs}s, Out=${fadeOutSecs}s`, 'info');
            resultBuffer = applyFades(resultBuffer, fadeInSecs, fadeOutSecs);
        }

        const outputFormat = outputFormatSelect.value;
        const outputName = outputNameInput.value || 'audio_cropped';

        logToConsole(`Converting to ${outputFormat.toUpperCase()}...`, 'info');

        const encodeProgress = async (msg) => {
            showStatus(msg, 'info');
            logToConsole(msg, 'info');
            await new Promise(r => setTimeout(r, 0));
        };

        let blob;
        if (outputFormat === 'mp3') {
            blob = await bufferToMp3(resultBuffer, encodeProgress);
        } else {
            blob = await bufferToWav(resultBuffer, encodeProgress);
        }

        window._cropperLastBlob = blob;
        window._cropperLastFilename = `${outputName}.${outputFormat}`;

        if (window._cropperPendingSendDest) {
            const dest = window._cropperPendingSendDest;
            window._cropperPendingSendDest = null;
            if (window.audioSendToTool) window.audioSendToTool(blob, `${outputName}.${outputFormat}`, dest);
            showStatus('Sent!', 'success');
            logToConsole(`Sent to ${dest === 'metadata-editor' ? 'Metadata Editor' : 'Volume Controls'}: ${outputName}.${outputFormat}`, 'success');
        } else {
            downloadBlob(blob, `${outputName}.${outputFormat}`);
            showStatus('Crop complete!', 'success');
            logToConsole(`Downloaded: ${outputName}.${outputFormat}`, 'success');
        }
        logToConsole('=== Crop Complete ===', 'success');

    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
        logToConsole('Error: ' + error.message, 'error');
    } finally {
        if (liveBox) liveBox.classList.remove('active');
    }
});

function openCropperHelpModal() {
    const modal = document.getElementById('help-modal');
    const content = document.getElementById('help-modal-content');

    content.innerHTML = `
        <h3 class="text-xl font-bold text-white mb-2">Audio Cropper Help</h3>
        <ul class="list-disc list-inside mb-4 leading-tight">
            <li><strong class="text-white">Drag Handles</strong> - Drag the green triangular handles on the waveform to select the audio region</li>
            <li><strong class="text-white">Click to Play</strong> - Click anywhere on the waveform (outside the handles) to play from that position</li>
            <li><strong class="text-white">KEEP/REMOVE Mode</strong> - Toggle between keeping the selected region or removing it</li>
            <li><strong class="text-white">Fade In/Fade</strong> - Enable fade effects and set their duration</li>
            <li><strong class="text-white">Start/End Inputs</strong> - Fine-tune selection with the +/- buttons or type exact values</li>
        </ul>
        <p class="leading-snug">All processing is done in your browser - no data is uploaded.</p>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

if (helpButton) {
    helpButton.addEventListener('click', openCropperHelpModal);
}

window.cropperReceiveFile = handleFileSelect;

const cropperSendToBtn = document.getElementById('cropper-send-to-btn');
if (cropperSendToBtn) {
    cropperSendToBtn.addEventListener('click', () => {
        const blob = window._cropperLastBlob;
        const filename = window._cropperLastFilename;
        const dest = document.getElementById('cropper-send-to-select').value;
        if (blob && filename) {
            if (window.audioSendToTool) window.audioSendToTool(blob, filename, dest);
        } else {
            window._cropperPendingSendDest = dest;
            cropBtn.click();
        }
    });
}

window.addEventListener('resize', () => {
    if (cropperAudioBuffer) {
        drawWaveform();
        updateHandles();
    }
});

const resizeObserver = new ResizeObserver(() => {
    if (cropperAudioBuffer && waveformContainer.clientWidth > 0) {
        drawWaveform();
        updateHandles();
    }
});
resizeObserver.observe(waveformContainer);

window.audioTabCleanup = function() {
  if (isPlaying) {
    playBtn.click();
  }
  cropperAudioFile = null;
  cropperAudioBuffer = null;
  if (cropperAudioContext && cropperAudioContext.state !== 'closed') {
    cropperAudioContext.close();
  }
  cropperAudioContext = null;
  cropperSourceNode = null;
  cropperGainNode = null;
  waveformData = null;
  selectionStart = 0;
  selectionEnd = 0;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  fileNameDisplay.textContent = '';
  fileInput.value = '';
  waveformCanvas.getContext('2d').clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  logToConsole('Audio resources cleared', 'info');
};
