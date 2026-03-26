document.addEventListener('DOMContentLoaded', () => {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const buildSubtabLinks = document.querySelectorAll('.build-subtab-link');
  const buildSubtabContents = document.querySelectorAll('.build-subtab-content');
  const audioSubtabLinks = document.querySelectorAll('.audio-subtab-link');
  const audioSubtabContents = document.querySelectorAll('.audio-subtab-content');
  const audioNavSubtabLinks = document.querySelectorAll('.audio-nav-subtab-link');
  const buildLinks = document.querySelectorAll('.build-link');

  const MAX_CONSOLE_ENTRIES = 50;

  function cleanupMemory(tabName) {
    if (tabName === 'builds') {
      window.buildTabCleanup?.();
    } else if (tabName === 'kit') {
      window.kitTabCleanup?.();
    } else if (tabName === 'music') {
      window.musicTabCleanup?.();
    } else if (tabName === 'audio') {
      window.audioTabCleanup?.();
    } else if (tabName === 'addons') {
      window.addonsTabCleanup?.();
    } else if (tabName === 'scoreboard') {
      window.scoreboardTabCleanup?.();
    }
    trimConsoleLogs();
    revokeUnusedObjectURLs();
  }

  function trimConsoleLogs() {
    const consolBoxes = document.querySelectorAll('.console-box');
    consolBoxes.forEach(box => {
      const entries = box.querySelectorAll('.console-entry');
      if (entries.length > MAX_CONSOLE_ENTRIES) {
        const toRemove = entries.length - MAX_CONSOLE_ENTRIES;
        for (let i = 0; i < toRemove; i++) {
          entries[i].remove();
        }
      }
    });
  }

  function revokeUnusedObjectURLs() {
    try {
      if (window.pendingURLs && window.pendingURLs.length > 0) {
        window.pendingURLs.forEach(url => {
          try { URL.revokeObjectURL(url); } catch(e) {}
        });
        window.pendingURLs = [];
      }
    } catch(e) {}
  }

  function switchTab(tabName) {
    cleanupMemory(tabName);
    
    tabLinks.forEach(link => {
      const linkTab = link.getAttribute('data-tab');
      if (linkTab === tabName) {
        link.classList.add('active');
        link.classList.remove('text-slate-400');
        link.classList.add('text-white');
      } else {
        link.classList.remove('active');
        link.classList.add('text-slate-400');
        link.classList.remove('text-white');
      }
    });

    if (tabName !== 'audio') {
      audioNavSubtabLinks.forEach(link => {
        link.classList.remove('active');
      });
    }

    tabContents.forEach(content => {
      if (content.id === `${tabName}-content`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  function switchBuildSubtab(subtabName) {
    buildSubtabLinks.forEach(link => {
      const linkSubtab = link.getAttribute('data-subtab');
      if (linkSubtab === subtabName) {
        link.classList.add('active');
        link.classList.remove('text-slate-400');
      } else {
        link.classList.remove('active');
        link.classList.add('text-slate-400');
      }
    });

    buildSubtabContents.forEach(content => {
      if (content.id === `${subtabName}-content`) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });
  }

  function switchAudioSubtab(subtabName) {
    audioSubtabLinks.forEach(link => {
      const linkSubtab = link.getAttribute('data-subtab');
      if (linkSubtab === subtabName) {
        link.classList.add('active');
        link.classList.remove('text-slate-400');
      } else {
        link.classList.remove('active');
        link.classList.add('text-slate-400');
      }
    });

    audioNavSubtabLinks.forEach(link => {
      const linkSubtab = link.getAttribute('data-subtab');
      if (linkSubtab === subtabName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    audioSubtabContents.forEach(content => {
      if (content.id === `${subtabName}-content`) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });
  }

  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = link.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  buildSubtabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const subtabName = link.getAttribute('data-subtab');
      switchBuildSubtab(subtabName);
    });
  });

  audioSubtabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const subtabName = link.getAttribute('data-subtab');
      switchAudioSubtab(subtabName);
    });
  });

  audioNavSubtabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const subtabName = link.getAttribute('data-subtab');
      switchTab('audio');
      switchAudioSubtab(subtabName);
    });
  });

  buildLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      switchTab('builds');
      switchBuildSubtab(target);
    });
  });

  const homeTabLinks = document.querySelectorAll('.home-tab-link');
  const homeSubtabLinks = document.querySelectorAll('.home-subtab-link');

  homeTabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  homeSubtabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-tab');
      let subtab = link.getAttribute('data-subtab');
      
      switchTab(tab);
      
      if (tab === 'builds') {
        switchBuildSubtab(subtab);
      } else if (tab === 'audio') {

        if (subtab === 'volume-tool') subtab = 'volume';
        if (subtab === 'audio-cropper') subtab = 'cropper';
        if (subtab === 'audio-converter') subtab = 'albumart'; 
        switchAudioSubtab(subtab);
      }
    });
  });

  window.audioSendToTool = function(blob, filename, toolKey) {
    const mimeType = filename.endsWith('.wav') ? 'audio/wav' : 'audio/mp3';
    const file = new File([blob], filename, { type: mimeType });
    switchTab('audio');
    switchAudioSubtab(toolKey);
    setTimeout(() => {
      if (toolKey === 'metadata-editor' && window.audioToolReceiveFile) {
        window.audioToolReceiveFile(file);
      } else if (toolKey === 'cropper' && window.cropperReceiveFile) {
        window.cropperReceiveFile(file);
      } else if (toolKey === 'volume' && window.volumeReceiveFile) {
        window.volumeReceiveFile(file);
      }
    }, 80);
  };

  switchTab('home');
  switchBuildSubtab('schematic');
});
