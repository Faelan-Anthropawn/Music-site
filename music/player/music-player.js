const tracks = [
    { name: "Another Actor", url: "./music/player/anotheractor.mp3", duration: "03:12" },
    { name: "Lonely Reign",  url: "./music/player/lonelyreign.mp3", duration: "02:45" },
    { name: "Static Vein",   url: "./music/player/staticvein.mp3", duration: "03:30" },
    { name: "They Say",      url: "./music/player/theysay.mp3", duration: "02:58" }
];

let currentTrackIndex = 0;
let isPlaying = false;
let isMuted = false;

const getElements = () => ({
    audio: document.getElementById('myAudio'),
    playlistCtn: document.querySelector('.playlist-ctn'),
    titleDisplay: document.querySelector('.player-ctn .title'),
    timerDisplay: document.querySelector('.player-ctn .timer'),
    durationDisplay: document.querySelector('.player-ctn .duration'),
    progressBar: document.getElementById('myBar'),
    progressContainer: document.getElementById('myProgress'),
    playIcon: document.getElementById('icon-play'),
    pauseIcon: document.getElementById('icon-pause')
});

function initPlayer() {
    renderPlaylist();
    loadTrack(0);
}

function renderPlaylist() {
    const { playlistCtn } = getElements();
    if (!playlistCtn) return;
    playlistCtn.innerHTML = '';
    tracks.forEach((track, index) => {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'playlist-track-ctn' + (index === currentTrackIndex ? ' active-track' : '');
        trackDiv.onclick = () => {
            loadTrack(index);
            playAudio();
        };
        
        const durationHtml = track.duration ? `<div class="playlist-track-duration text-[10px] opacity-50 ml-auto">${track.duration}</div>` : '';
        
        trackDiv.innerHTML = `
            <div class="playlist-info-track flex items-center w-full">
                <div class="playlist-track-name font-display">${track.name}</div>
                ${durationHtml}
            </div>
        `;
        playlistCtn.appendChild(trackDiv);
    });
}

function loadTrack(index) {
    currentTrackIndex = index;
    const { audio, titleDisplay, durationDisplay } = getElements();
    const track = tracks[index];
    if (audio) {
        audio.src = track.url;
        audio.load();
        
        if (durationDisplay && track.duration) {
            durationDisplay.textContent = track.duration;
        }
        
        audio.onloadedmetadata = () => {
            if (durationDisplay && !track.duration) durationDisplay.textContent = formatTime(audio.duration);
        };
    }
    if (titleDisplay) titleDisplay.textContent = track.name;
    
    document.querySelectorAll('.playlist-track-ctn').forEach((el, i) => {
        el.classList.toggle('active-track', i === index);
    });
}

function toggleAudio() {
    if (isPlaying) pauseAudio();
    else playAudio();
}

function playAudio() {
    const { audio, playIcon, pauseIcon } = getElements();
    if (!audio) return;
    audio.play().catch(e => console.log("Playback prevented:", e));
    isPlaying = true;
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';
}

function pauseAudio() {
    const { audio, playIcon, pauseIcon } = getElements();
    if (!audio) return;
    audio.pause();
    isPlaying = false;
    if (playIcon) playIcon.style.display = 'block';
    if (pauseIcon) pauseIcon.style.display = 'none';
}

function next() {
    currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
    loadTrack(currentTrackIndex);
    if (isPlaying) playAudio();
}

function previous() {
    currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    loadTrack(currentTrackIndex);
    if (isPlaying) playAudio();
}

function rewind() {
    const { audio } = getElements();
    if (audio && isFinite(audio.duration)) {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
    }
}

function forward() {
    const { audio } = getElements();
    if (audio && isFinite(audio.duration)) {
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
    }
}

function toggleMute() {
    const { audio } = getElements();
    if (!audio) return;
    isMuted = !isMuted;
    audio.muted = isMuted;
}

function onTimeUpdate() {
    const { audio, progressBar, timerDisplay } = getElements();
    if (!audio) return;
    const progress = isFinite(audio.duration) ? (audio.currentTime / audio.duration) * 100 : 0;
    if (progressBar) progressBar.style.width = progress + '%';
    if (timerDisplay) timerDisplay.textContent = formatTime(audio.currentTime);
}

function formatTime(seconds) {
    if (!isFinite(seconds)) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return min.toString().padStart(2, '0') + ':' + sec.toString().padStart(2, '0');
}

window.onTimeUpdate = onTimeUpdate;
window.toggleAudio = toggleAudio;
window.next = next;
window.previous = previous;
window.rewind = rewind;
window.forward = forward;
window.toggleMute = toggleMute;

const setupClickHandlers = () => {
    const { progressContainer, audio } = getElements();
    if (progressContainer) {
        progressContainer.onclick = (e) => {
            if (!audio || !isFinite(audio.duration)) return;
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            audio.currentTime = pos * audio.duration;
        };
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupClickHandlers();
        initPlayer();
    });
} else {
    setupClickHandlers();
    initPlayer();
}

window.musicTabCleanup = () => {
    pauseAudio();
};
