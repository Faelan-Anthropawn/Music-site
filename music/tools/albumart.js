let albumartImage = null;
let albumartOriginalWidth = 0;
let albumartOriginalHeight = 0;
let cropX = 0;
let cropY = 0;
let cropSize = 0;
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let dragStartX = 0;
let dragStartY = 0;
let cropStartX = 0;
let cropStartY = 0;
let cropStartSize = 0;

const dropZone = document.getElementById('albumart-drop-zone');
const fileInput = document.getElementById('albumart-file-input');
const browseButton = document.getElementById('albumart-browse-button');
const fileNameDisplay = document.getElementById('albumart-file-name');
const editorSection = document.getElementById('albumart-editor');
const previewImg = document.getElementById('albumart-preview');
const cropOverlay = document.getElementById('albumart-crop-overlay');
const cropContainer = document.getElementById('albumart-crop-container');
const cropInfo = document.getElementById('albumart-crop-info');
const outputSizeSelect = document.getElementById('albumart-output-size');
const customSizeContainer = document.getElementById('albumart-custom-size-container');
const customSizeInput = document.getElementById('albumart-custom-size');
const outputFormatSelect = document.getElementById('albumart-output-format');
const qualityContainer = document.getElementById('albumart-quality-container');
const qualitySelect = document.getElementById('albumart-quality');
const downloadBtn = document.getElementById('albumart-download-btn');
const statusMessage = document.getElementById('albumart-status-message');

function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-badge ' + type;
}

function handleFileSelect(file) {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showStatus('Please select a valid image file', 'error');
        return;
    }
    
    fileNameDisplay.textContent = file.name;
    showStatus('Loading image...', 'info');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        albumartImage = new Image();
        albumartImage.onload = () => {
            albumartOriginalWidth = albumartImage.naturalWidth;
            albumartOriginalHeight = albumartImage.naturalHeight;
            
            previewImg.src = e.target.result;
            editorSection.classList.remove('hidden');
            
            setTimeout(() => {
                initializeCropper();
            }, 100);
            
            showStatus('Image loaded: ' + albumartOriginalWidth + 'x' + albumartOriginalHeight, 'success');
        };
        albumartImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function initializeCropper() {
    const displayWidth = previewImg.offsetWidth;
    const displayHeight = previewImg.offsetHeight;
    
    if (albumartOriginalWidth === albumartOriginalHeight) {
        cropOverlay.style.display = 'none';
        cropInfo.textContent = 'Image is already square (' + albumartOriginalWidth + 'x' + albumartOriginalHeight + '). No cropping needed.';
        cropX = 0;
        cropY = 0;
        cropSize = displayWidth;
        return;
    }
    
    cropOverlay.style.display = 'block';
    
    const minDimension = Math.min(displayWidth, displayHeight);
    cropSize = minDimension * 0.8;
    cropX = (displayWidth - cropSize) / 2;
    cropY = (displayHeight - cropSize) / 2;
    
    updateCropOverlay();
    updateCropInfo();
}

function updateCropOverlay() {
    const imgRect = previewImg.getBoundingClientRect();
    const containerRect = cropContainer.getBoundingClientRect();
    
    const offsetX = imgRect.left - containerRect.left;
    const offsetY = imgRect.top - containerRect.top;
    
    cropOverlay.style.left = (offsetX + cropX) + 'px';
    cropOverlay.style.top = (offsetY + cropY) + 'px';
    cropOverlay.style.width = cropSize + 'px';
    cropOverlay.style.height = cropSize + 'px';
}

function updateCropInfo() {
    const displayWidth = previewImg.offsetWidth;    
    const scaleX = albumartOriginalWidth / displayWidth;
    const actualCropSize = Math.round(cropSize * scaleX);
    
    cropInfo.textContent = `Crop area: ${actualCropSize}x${actualCropSize} pixels (drag to move, corners to resize)`;
}

function constrainCrop() {
    const displayWidth = previewImg.offsetWidth;
    const displayHeight = previewImg.offsetHeight;
    
    const minSize = 50;
    cropSize = Math.max(minSize, Math.min(cropSize, displayWidth, displayHeight));
    
    cropX = Math.max(0, Math.min(cropX, displayWidth - cropSize));
    cropY = Math.max(0, Math.min(cropY, displayHeight - cropSize));
}

cropOverlay.addEventListener('mousedown', (e) => {
    if (e.target.id.includes('handle')) return;
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    cropStartX = cropX;
    cropStartY = cropY;
    e.preventDefault();
});

['tl', 'tr', 'bl', 'br'].forEach(corner => {
    const handle = document.getElementById('albumart-crop-handle-' + corner);
    if (handle) {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizeHandle = corner;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            cropStartX = cropX;
            cropStartY = cropY;
            cropStartSize = cropSize;
            e.preventDefault();
            e.stopPropagation();
        });
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        
        cropX = cropStartX + dx;
        cropY = cropStartY + dy;
        
        constrainCrop();
        updateCropOverlay();
        updateCropInfo();
    } else if (isResizing) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        
        const delta = Math.max(Math.abs(dx), Math.abs(dy)) * Math.sign(dx + dy);
        
        if (resizeHandle === 'br') {
            cropSize = cropStartSize + delta;
        } else if (resizeHandle === 'tl') {
            cropSize = cropStartSize - delta;
            cropX = cropStartX + delta;
            cropY = cropStartY + delta;
        } else if (resizeHandle === 'tr') {
            cropSize = cropStartSize + delta;
            cropY = cropStartY - (cropSize - cropStartSize);
        } else if (resizeHandle === 'bl') {
            cropSize = cropStartSize + delta;
            cropX = cropStartX - (cropSize - cropStartSize);
        }
        
        constrainCrop();
        updateCropOverlay();
        updateCropInfo();
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
});

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

dropZone.addEventListener('click', () => {
    fileInput.click();
});

browseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

outputSizeSelect.addEventListener('change', () => {
    if (outputSizeSelect.value === 'custom') {
        customSizeContainer.classList.remove('hidden');
    } else {
        customSizeContainer.classList.add('hidden');
    }
});

outputFormatSelect.addEventListener('change', () => {
    if (outputFormatSelect.value === 'jpeg') {
        qualityContainer.classList.remove('hidden');
    } else {
        qualityContainer.classList.add('hidden');
    }
});

downloadBtn.addEventListener('click', () => {
    if (!albumartImage) {
        showStatus('Please load an image first', 'error');
        return;
    }
    
    showStatus('Processing...', 'info');
    
    const displayWidth = previewImg.offsetWidth;
    const displayHeight = previewImg.offsetHeight;
    
    const scaleX = albumartOriginalWidth / displayWidth;
    const scaleY = albumartOriginalHeight / displayHeight;
    
    let srcX, srcY, srcSize;
    
    if (albumartOriginalWidth === albumartOriginalHeight) {
        srcX = 0;
        srcY = 0;
        srcSize = albumartOriginalWidth;
    } else {
        srcX = Math.round(cropX * scaleX);
        srcY = Math.round(cropY * scaleY);
        srcSize = Math.round(cropSize * scaleX);
    }
    
    let outputSize;
    if (outputSizeSelect.value === 'custom') {
        outputSize = parseInt(customSizeInput.value) || 1400;
    } else {
        outputSize = parseInt(outputSizeSelect.value);
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(
        albumartImage,
        srcX, srcY, srcSize, srcSize,
        0, 0, outputSize, outputSize
    );
    
    const format = outputFormatSelect.value;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpeg' ? parseFloat(qualitySelect.value) : undefined;
    const extension = format === 'jpeg' ? 'jpg' : 'png';
    
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `album_art_${outputSize}x${outputSize}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
        
        showStatus(`Downloaded ${outputSize}x${outputSize} ${extension.toUpperCase()}`, 'success');
    }, mimeType, quality);
});

window.addEventListener('resize', () => {
    if (albumartImage && cropOverlay.style.display !== 'none') {
        setTimeout(() => {
            updateCropOverlay();
        }, 100);
    }
});
