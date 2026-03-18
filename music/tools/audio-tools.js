let currentAudioFile = null;
let currentAudioFileName = '';
let currentArtworkData = null;

const audioDropZone = document.getElementById('audio-drop-zone');
const audioFileInput = document.getElementById('audio-file-input');
const audioBrowseButton = document.getElementById('audio-browse-button');
const audioFileNameDisplay = document.getElementById('audio-file-name');
const audioConvertButton = document.getElementById('audio-convert-button');
const audioStatusMessage = document.getElementById('audio-status-message');
const audioOutputNameInput = document.getElementById('audio-output-name');
const audioOutputFormatSelect = document.getElementById('audio-output-format');
const audioBitrateSelect = document.getElementById('audio-bitrate');
const audioSampleRateSelect = document.getElementById('audio-sample-rate');
const audioChannelsSelect = document.getElementById('audio-channels');
const audioBitDepthSelect = document.getElementById('audio-bit-depth');
const audioConsoleBox = document.getElementById('audio-console-box');
const audioHelpButton = document.getElementById('audio-help-button');
const audioStripMetadata = document.getElementById('audio-strip-metadata');
const audioMetadataFields = document.getElementById('audio-metadata-fields');
const audioArtworkButton = document.getElementById('audio-artwork-button');
const audioArtworkInput = document.getElementById('audio-artwork-input');
const audioArtworkPreview = document.getElementById('audio-artwork-preview');
const audioArtworkClear = document.getElementById('audio-artwork-clear');

const audioMetaTitle = document.getElementById('audio-meta-title');
const audioMetaArtist = document.getElementById('audio-meta-artist');
const audioMetaAlbum = document.getElementById('audio-meta-album');
const audioMetaYear = document.getElementById('audio-meta-year');
const audioMetaGenre = document.getElementById('audio-meta-genre');
const audioMetaTrack = document.getElementById('audio-meta-track');
const audioMetaPublisher = document.getElementById('audio-meta-publisher');
const audioMetaComment = document.getElementById('audio-meta-comment');

window.pendingURLs = window.pendingURLs || [];

function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
}

function logToAudioConsole(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'console-entry';
  
  const timestamp = document.createElement('span');
  timestamp.className = 'console-timestamp';
  timestamp.textContent = `[${getTimestamp()}]`;
  
  const text = document.createElement('span');
  text.textContent = message;
  
  if (type === 'error') {
    text.style.color = '#ef4444';
  } else if (type === 'success') {
    text.style.color = '#22c55e';
  } else if (type === 'info') {
    text.style.color = '#3b82f6';
  }
  
  entry.appendChild(timestamp);
  entry.appendChild(text);
  audioConsoleBox.appendChild(entry);
  const _entries = audioConsoleBox.querySelectorAll('.console-entry');
  if (_entries.length > 20) _entries[0].remove();
  audioConsoleBox.scrollTop = audioConsoleBox.scrollHeight;
}

function clearAudioConsole() {
  audioConsoleBox.innerHTML = '';
}

function showAudioStatus(message, type = 'info') {
  audioStatusMessage.textContent = message;
  audioStatusMessage.className = 'status-badge ' + type;
}

function handleAudioFileSelect(file) {
  if (!file) return;

  const ext = file.name.toLowerCase();
  if (!ext.endsWith('.mp3') && !ext.endsWith('.wav')) {
    showAudioStatus('Please select a valid audio file (.mp3 or .wav)', 'error');
    return;
  }

  currentAudioFile = file;
  currentAudioFileName = file.name;
  audioFileNameDisplay.textContent = file.name;

  if (!audioOutputNameInput.value) {
    const baseName = file.name.replace(/\.(mp3|wav)$/i, '');
    audioOutputNameInput.value = baseName;
  }

  showAudioStatus('File loaded: ' + file.name, 'success');
  logToAudioConsole('File loaded: ' + file.name, 'success');
}

audioStripMetadata.addEventListener('change', () => {
  if (audioStripMetadata.checked) {
    audioMetadataFields.style.opacity = '0.5';
    audioMetadataFields.style.pointerEvents = 'none';
  } else {
    audioMetadataFields.style.opacity = '1';
    audioMetadataFields.style.pointerEvents = 'auto';
  }
});

audioArtworkButton.addEventListener('click', () => {
  audioArtworkInput.click();
});

audioArtworkInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      currentArtworkData = {
        data: new Uint8Array(event.target.result),
        type: file.type
      };
      
      const imgBlob = new Blob([currentArtworkData.data], { type: file.type });
      const imgUrl = URL.createObjectURL(imgBlob);
      if (window.pendingURLs) window.pendingURLs.push(imgUrl);
      audioArtworkPreview.innerHTML = `<img src="${imgUrl}" class="w-full h-full object-cover" alt="Album artwork"/>`;
      logToAudioConsole('Artwork loaded: ' + file.name, 'success');
    };
    reader.readAsArrayBuffer(file);
  }
});

audioArtworkClear.addEventListener('click', () => {
  currentArtworkData = null;
  audioArtworkPreview.innerHTML = '<span class="material-symbols-outlined text-3xl text-slate-600">image</span>';
  audioArtworkInput.value = '';
});

audioBrowseButton.addEventListener('click', () => {
  audioFileInput.click();
});

audioDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  audioDropZone.classList.add('drag-over');
});

audioDropZone.addEventListener('dragleave', () => {
  audioDropZone.classList.remove('drag-over');
});

audioDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  audioDropZone.classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleAudioFileSelect(files[0]);
  }
});

audioFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleAudioFileSelect(e.target.files[0]);
  }
});

function getMetadata() {
  return {
    title: audioMetaTitle.value.trim(),
    artist: audioMetaArtist.value.trim(),
    album: audioMetaAlbum.value.trim(),
    year: audioMetaYear.value.trim(),
    genre: audioMetaGenre.value.trim(),
    track: audioMetaTrack.value.trim(),
    publisher: audioMetaPublisher.value.trim(),
    comment: audioMetaComment.value.trim(),
    artwork: currentArtworkData
  };
}

function toSynchsafeInt(num) {
  return [
    (num >> 21) & 0x7F,
    (num >> 14) & 0x7F,
    (num >> 7) & 0x7F,
    num & 0x7F
  ];
}

function encodeUtf16LE(str) {
  const buf = new ArrayBuffer(str.length * 2 + 2);
  const view = new Uint8Array(buf);
  view[0] = 0xFF;
  view[1] = 0xFE;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    view[2 + i * 2] = code & 0xFF;
    view[2 + i * 2 + 1] = (code >> 8) & 0xFF;
  }
  return new Uint8Array(buf);
}

function createId3v2Frame(frameId, data) {
  const frameIdBytes = new TextEncoder().encode(frameId);
  const synchsafeSize = toSynchsafeInt(data.length);
  const header = new Uint8Array(10);
  header.set(frameIdBytes, 0);
  header[4] = synchsafeSize[0];
  header[5] = synchsafeSize[1];
  header[6] = synchsafeSize[2];
  header[7] = synchsafeSize[3];
  header[8] = 0;
  header[9] = 0;
  
  const frame = new Uint8Array(10 + data.length);
  frame.set(header, 0);
  frame.set(data, 10);
  return frame;
}

function createTextFrame(frameId, text) {
  if (!text) return null;
  const encoded = encodeUtf16LE(text);
  const nullTerm = new Uint8Array([0x00, 0x00]);
  const data = new Uint8Array(1 + encoded.length + nullTerm.length);
  data[0] = 1;
  data.set(encoded, 1);
  data.set(nullTerm, 1 + encoded.length);
  return createId3v2Frame(frameId, data);
}

function createCommFrame(text) {
  if (!text) return null;
  const encoding = 1;
  const language = new TextEncoder().encode('eng');
  const shortDesc = new Uint8Array([0xFF, 0xFE, 0x00, 0x00]);
  const encoded = encodeUtf16LE(text);
  const nullTerm = new Uint8Array([0x00, 0x00]);
  
  const dataSize = 1 + 3 + shortDesc.length + encoded.length + nullTerm.length;
  const data = new Uint8Array(dataSize);
  let offset = 0;
  
  data[offset++] = encoding;
  data.set(language, offset);
  offset += 3;
  data.set(shortDesc, offset);
  offset += shortDesc.length;
  data.set(encoded, offset);
  offset += encoded.length;
  data.set(nullTerm, offset);
  
  return createId3v2Frame('COMM', data);
}

function createApicFrame(artwork) {
  if (!artwork || !artwork.data) return null;
  
  const encoding = 0;
  const mimeType = artwork.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const mimeBytes = new TextEncoder().encode(mimeType);
  const pictureType = 3;
  const description = new Uint8Array([0x00]);
  
  const dataSize = 1 + mimeBytes.length + 1 + 1 + description.length + artwork.data.length;
  const data = new Uint8Array(dataSize);
  let offset = 0;
  
  data[offset++] = encoding;
  data.set(mimeBytes, offset);
  offset += mimeBytes.length;
  data[offset++] = 0;
  data[offset++] = pictureType;
  data.set(description, offset);
  offset += description.length;
  data.set(artwork.data, offset);
  
  return createId3v2Frame('APIC', data);
}

function createId3v2Tag(metadata) {
  const frames = [];
  
  const textFrames = [
    ['TIT2', metadata.title],
    ['TPE1', metadata.artist],
    ['TALB', metadata.album],
    ['TDRC', metadata.year],
    ['TCON', metadata.genre],
    ['TRCK', metadata.track],
    ['TPUB', metadata.publisher]
  ];
  
  for (const [frameId, value] of textFrames) {
    if (value) {
      const frame = createTextFrame(frameId, value);
      if (frame) frames.push(frame);
    }
  }
  
  if (metadata.comment) {
    const commFrame = createCommFrame(metadata.comment);
    if (commFrame) frames.push(commFrame);
  }
  
  if (metadata.artwork) {
    const apicFrame = createApicFrame(metadata.artwork);
    if (apicFrame) frames.push(apicFrame);
  }
  
  if (frames.length === 0) return new Uint8Array(0);
  
  let totalFrameSize = 0;
  for (const frame of frames) {
    totalFrameSize += frame.length;
  }
  
  const tagSize = totalFrameSize;
  const header = new Uint8Array(10);
  header[0] = 0x49; 
  header[1] = 0x44; 
  header[2] = 0x33; 
  header[3] = 4;    
  header[4] = 0;
  header[5] = 0;
  header[6] = (tagSize >> 21) & 0x7F;
  header[7] = (tagSize >> 14) & 0x7F;
  header[8] = (tagSize >> 7) & 0x7F;
  header[9] = tagSize & 0x7F;
  
  const tag = new Uint8Array(10 + totalFrameSize);
  tag.set(header, 0);
  let offset = 10;
  for (const frame of frames) {
    tag.set(frame, offset);
    offset += frame.length;
  }
  
  return tag;
}

function createWavInfoChunk(metadata) {
  const chunks = [];
  
  const infoMappings = [
    ['INAM', metadata.title],
    ['IART', metadata.artist],
    ['IPRD', metadata.album],
    ['ICRD', metadata.year],
    ['IGNR', metadata.genre],
    ['ITRK', metadata.track],
    ['IPUB', metadata.publisher],
    ['ICMT', metadata.comment]
  ];
  
  for (const [chunkId, value] of infoMappings) {
    if (value) {
      const encoded = new TextEncoder().encode(value + '\0');
      const paddedLength = encoded.length % 2 === 0 ? encoded.length : encoded.length + 1;
      const chunk = new Uint8Array(8 + paddedLength);
      
      for (let i = 0; i < 4; i++) {
        chunk[i] = chunkId.charCodeAt(i);
      }
      
      const size = encoded.length;
      chunk[4] = size & 0xFF;
      chunk[5] = (size >> 8) & 0xFF;
      chunk[6] = (size >> 16) & 0xFF;
      chunk[7] = (size >> 24) & 0xFF;
      
      chunk.set(encoded, 8);
      chunks.push(chunk);
    }
  }
  
  if (chunks.length === 0) return null;
  
  let totalSize = 4;
  for (const chunk of chunks) {
    totalSize += chunk.length;
  }
  
  const listChunk = new Uint8Array(8 + totalSize);
  listChunk[0] = 'L'.charCodeAt(0);
  listChunk[1] = 'I'.charCodeAt(0);
  listChunk[2] = 'S'.charCodeAt(0);
  listChunk[3] = 'T'.charCodeAt(0);
  
  listChunk[4] = totalSize & 0xFF;
  listChunk[5] = (totalSize >> 8) & 0xFF;
  listChunk[6] = (totalSize >> 16) & 0xFF;
  listChunk[7] = (totalSize >> 24) & 0xFF;
  
  listChunk[8] = 'I'.charCodeAt(0);
  listChunk[9] = 'N'.charCodeAt(0);
  listChunk[10] = 'F'.charCodeAt(0);
  listChunk[11] = 'O'.charCodeAt(0);
  
  let offset = 12;
  for (const chunk of chunks) {
    listChunk.set(chunk, offset);
    offset += chunk.length;
  }
  
  return listChunk;
}

const CHUNK_SIZE = 1024 * 1024;

async function* readFileInChunks(file) {
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();
    yield { data: new Uint8Array(buffer), offset, total: file.size };
    offset += CHUNK_SIZE;
  }
}

async function decodeAudioFileChunked(file, progressCallback) {
  progressCallback('Reading file...');
  const arrayBuffer = await file.arrayBuffer();

  progressCallback('Decoding audio...');
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();

  return audioBuffer;
}

async function resampleAudioBufferChunked(audioBuffer, targetSampleRate, targetChannels, progressCallback) {
  const sourceLength = audioBuffer.length;
  const ratio = audioBuffer.sampleRate / targetSampleRate;
  const targetLength = Math.round(sourceLength / ratio);
  
  progressCallback('Resampling audio...');
  
  const offlineContext = new OfflineAudioContext(targetChannels, targetLength, targetSampleRate);
  const bufferSource = offlineContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineContext.destination);
  bufferSource.start(0);
  
  return offlineContext.startRendering();
}

async function encodeToWavChunked(audioBuffer, bitDepth, metadata, stripMeta, progressCallback) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  
  let bytesPerSample;
  let formatCode;
  
  if (bitDepth === 32) {
    bytesPerSample = 4;
    formatCode = 3;
  } else if (bitDepth === 24) {
    bytesPerSample = 3;
    formatCode = 1;
  } else {
    bytesPerSample = 2;
    formatCode = 1;
  }
  
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  
  let infoChunk = null;
  if (!stripMeta) {
    infoChunk = createWavInfoChunk(metadata);
  }
  const infoSize = infoChunk ? infoChunk.length : 0;
  
  const totalSize = 44 + dataSize + infoSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);
  
  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  await progressCallback('Writing WAV header...');
  
  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, formatCode, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }
  
  await progressCallback('Encoding audio data...');
  
  let offset = 44;
  const chunkSamples = 65536;
  
  for (let i = 0; i < length; i += chunkSamples) {
    const end = Math.min(i + chunkSamples, length);
    
    for (let j = i; j < end; j++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][j]));
        
        if (bitDepth === 32) {
          view.setFloat32(offset, sample, true);
          offset += 4;
        } else if (bitDepth === 24) {
          const intSample = Math.round(sample * 8388607);
          view.setUint8(offset, intSample & 0xFF);
          view.setUint8(offset + 1, (intSample >> 8) & 0xFF);
          view.setUint8(offset + 2, (intSample >> 16) & 0xFF);
          offset += 3;
        } else {
          const intSample = Math.round(sample * 32767);
          view.setInt16(offset, intSample, true);
          offset += 2;
        }
      }
    }
    
    if (i % (chunkSamples * 5) === 0) {
      const progress = Math.round((i / length) * 100);
      await progressCallback(`Encoding: ${progress}%`);
    }
  }
  
  if (infoChunk) {
    await progressCallback('Writing metadata...');
    uint8View.set(infoChunk, offset);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

async function encodeToMp3Chunked(audioBuffer, bitrate, metadata, stripMeta, progressCallback) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  
  await progressCallback('Initializing MP3 encoder...');
  
  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
  
  const mp3Data = [];
  const sampleBlockSize = 1152;
  
  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;
  
  await progressCallback('Converting samples...');
  
  const leftInt16 = new Int16Array(samples);
  const rightInt16 = new Int16Array(samples);
  
  const conversionChunk = 65536;
  for (let i = 0; i < samples; i += conversionChunk) {
    const end = Math.min(i + conversionChunk, samples);
    for (let j = i; j < end; j++) {
      leftInt16[j] = Math.max(-32768, Math.min(32767, Math.round(left[j] * 32767)));
      rightInt16[j] = Math.max(-32768, Math.min(32767, Math.round(right[j] * 32767)));
    }
    if (i % (conversionChunk * 5) === 0) {
        await progressCallback(`Converting: ${Math.round((i/samples)*100)}%`);
    }
  }
  
  await progressCallback('Encoding MP3 frames...');
  
  let lastProgress = -10;
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
    
    const progress = Math.round((i / samples) * 100);
    if (progress - lastProgress >= 5) {
      await progressCallback(`Encoding: ${progress}%`);
      lastProgress = progress;
    }
  }
  
  await progressCallback('Flushing encoder...');
  const end = mp3encoder.flush();
  if (end.length > 0) {
    mp3Data.push(end);
  }
  
  if (!stripMeta) {
    await progressCallback('Adding metadata tags...');
    const id3Tag = createId3v2Tag(metadata);
    if (id3Tag.length > 0) {
      return new Blob([id3Tag, ...mp3Data], { type: 'audio/mp3' });
    }
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

audioConvertButton.addEventListener('click', async () => {
  if (!currentAudioFile) {
    showAudioStatus('Please select an audio file first', 'error');
    logToAudioConsole('Error: No audio file selected', 'error');
    return;
  }

  const outputName = audioOutputNameInput.value.trim() || 'output';
  const outputFormat = audioOutputFormatSelect.value;
  const bitrate = parseInt(audioBitrateSelect.value);
  const sampleRate = parseInt(audioSampleRateSelect.value);
  const channels = parseInt(audioChannelsSelect.value);
  const bitDepth = parseInt(audioBitDepthSelect.value);
  const stripMeta = audioStripMetadata.checked;
  const metadata = getMetadata();

  audioConvertButton.disabled = true;
  clearAudioConsole();
  logToAudioConsole('=== Starting Audio Conversion ===', 'info');
  logToAudioConsole(`Input file: ${currentAudioFileName}`, 'info');
  logToAudioConsole(`Output format: ${outputFormat.toUpperCase()}`, 'info');
  logToAudioConsole(`Sample rate: ${sampleRate} Hz`, 'info');
  logToAudioConsole(`Channels: ${channels === 1 ? 'Mono' : 'Stereo'}`, 'info');
  
  if (outputFormat === 'mp3') {
    logToAudioConsole(`Bitrate: ${bitrate} kbps`, 'info');
  } else {
    logToAudioConsole(`Bit depth: ${bitDepth}-bit`, 'info');
  }
  
  if (stripMeta) {
    logToAudioConsole('Metadata: Stripping all metadata', 'info');
  } else {
    const metaCount = Object.values(metadata).filter(v => v && (typeof v === 'string' ? v.length > 0 : true)).length;
    logToAudioConsole(`Metadata: ${metaCount} tags to write`, 'info');
  }

  const progressCallback = async (msg) => {
    showAudioStatus(msg, 'info');
    logToAudioConsole(msg, 'info');
    
    await new Promise(r => setTimeout(r, 0));
  };

  const liveBox = document.querySelector('.live-anim-box');
  if (liveBox) liveBox.classList.add('active');

  const pingInterval = setInterval(() => {
    if (liveBox && liveBox.classList.contains('active')) {
      const icon = liveBox.querySelector('.spiral-icon');
      if (icon) {
        icon.style.opacity = (parseFloat(icon.style.opacity) || 1) === 0.8 ? '1' : '0.8';
      }
    } else {
      clearInterval(pingInterval);
    }
  }, 500);

  setTimeout(async () => {
  try {
    const audioBuffer =
    await decodeAudioFileChunked(currentAudioFile, progressCallback);

    logToAudioConsole(
      `Decoded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate} Hz`,
      'success'
    );

    const resampledBuffer =
      await resampleAudioBufferChunked(audioBuffer, sampleRate, channels, progressCallback);

    logToAudioConsole(
      `Resampled to: ${sampleRate} Hz, ${channels} channel(s)`,
      'success'
    );

    let blob;
    let extension;

    if (outputFormat === 'mp3') {
      blob = await encodeToMp3Chunked(
        resampledBuffer,
        bitrate,
        metadata,
        stripMeta,
        progressCallback
      );
      extension = 'mp3';
      logToAudioConsole(`MP3 encoded at ${bitrate} kbps`, 'success');
    } else {
      blob = await encodeToWavChunked(
        resampledBuffer,
        bitDepth,
        metadata,
        stripMeta,
        progressCallback
      );
      extension = 'wav';
      logToAudioConsole(`WAV encoded at ${bitDepth}-bit`, 'success');
    }

    const filename = `${outputName}.${extension}`;

    window._audioToolLastBlob = blob;
    window._audioToolLastFilename = filename;

    if (window._audioToolPendingSendDest) {
      const dest = window._audioToolPendingSendDest;
      window._audioToolPendingSendDest = null;
      if (window.audioSendToTool) window.audioSendToTool(blob, filename, dest);
      showAudioStatus(`Sent to ${dest === 'cropper' ? 'Cropper' : 'Volume Controls'}`, 'success');
      logToAudioConsole(`Sent to ${dest === 'cropper' ? 'Cropper' : 'Volume Controls'}: ${filename}`, 'success');
    } else {
      downloadBlob(blob, filename);
      showAudioStatus(`Success! Downloaded ${filename}`, 'success');
      logToAudioConsole(`File downloaded: ${filename}`, 'success');
    }
    logToAudioConsole('=== Conversion Complete ===', 'success');

  } catch (error) {
    console.error('Audio conversion error:', error);
    showAudioStatus('Error: ' + error.message, 'error');
    logToAudioConsole('Error: ' + error.message, 'error');
    logToAudioConsole('=== Conversion Failed ===', 'error');

  } finally {
    audioConvertButton.disabled = false;
    const liveBox = document.querySelector('.live-anim-box');
    if (liveBox) liveBox.classList.remove('active');
  }})
});

function openAudioHelpModal() {
  const modal = document.getElementById('help-modal');
  const content = document.getElementById('help-modal-content');
  
  content.innerHTML = `
    <h3 class="text-xl font-bold text-white mb-2">Output Formats</h3>
    <ul class="list-disc list-inside mb-4 leading-tight">
      <li><strong class="text-white">MP3</strong> - Compressed audio with ID3v2 metadata support including album artwork.</li>
      <li><strong class="text-white">WAV</strong> - Uncompressed audio with RIFF INFO metadata chunks.</li>
    </ul>

    <h3 class="text-xl font-bold text-white mb-2">Audio Settings</h3>
    <ul class="list-disc list-inside mb-4 leading-tight">
      <li><strong class="text-white">Bitrate (MP3)</strong> - Higher = better quality, larger file. 320 kbps is near-lossless.</li>
      <li><strong class="text-white">Sample Rate</strong> - 44.1 kHz is CD quality. 48 kHz is common for video.</li>
      <li><strong class="text-white">Channels</strong> - Mono (1 channel) or Stereo (2 channels).</li>
      <li><strong class="text-white">Bit Depth (WAV)</strong> - 16-bit is CD quality. 24/32-bit for professional use.</li>
    </ul>

    <h3 class="text-xl font-bold text-white mb-2">Metadata Tags</h3>
    <ul class="list-disc list-inside mb-4 leading-tight">
      <li><strong class="text-white">Title, Artist, Album</strong> - Basic song information.</li>
      <li><strong class="text-white">Year, Genre, Track</strong> - Additional cataloging info.</li>
      <li><strong class="text-white">Publisher</strong> - Record label or publisher name.</li>
      <li><strong class="text-white">Album Artwork</strong> - JPEG or PNG image for cover art (MP3 only).</li>
      <li><strong class="text-white">Strip All Metadata</strong> - Removes all tags for minimal file size.</li>
    </ul>

    <h3 class="text-xl font-bold text-white mb-2">Default Settings</h3>
    <p class="leading-snug">320 kbps, 44.1 kHz, Stereo, 16-bit, MP3 output.</p>
    <p class="mt-1 leading-snug">All processing is done client-side in your browser using chunked processing for better memory efficiency.</p>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

audioHelpButton.addEventListener('click', openAudioHelpModal);

window.audioToolReceiveFile = handleAudioFileSelect;

const audioSendToBtn = document.getElementById('audio-send-to-btn');
if (audioSendToBtn) {
  audioSendToBtn.addEventListener('click', () => {
    const blob = window._audioToolLastBlob;
    const filename = window._audioToolLastFilename;
    const dest = document.getElementById('audio-send-to-select').value;
    if (blob && filename) {
      if (window.audioSendToTool) window.audioSendToTool(blob, filename, dest);
    } else {
      window._audioToolPendingSendDest = dest;
      audioConvertButton.click();
    }
  });
}

window.musicTabCleanup = function() {
  currentAudioFile = null;
  currentAudioFileName = '';
  currentArtworkData = null;
  audioFileNameDisplay.textContent = '';
  audioFileInput.value = '';
  audioArtworkInput.value = '';
  audioArtworkPreview.innerHTML = '';
  clearAudioConsole();
  document.querySelectorAll('.audio-meta-field').forEach(field => field.value = '');
};

  