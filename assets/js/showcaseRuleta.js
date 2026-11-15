// assets/js/showcaseRuleta.js
// Showcase Dual Cinemático: Video Publicitario Oficial & Ruleta de Capturas Cubikar

export const HERO_SLIDES = [
  {
    id: 'apu',
    app: 'const',
    title: 'Catálogo Base & Matrices APU',
    product: 'Cubikar Construcción',
    badgeClass: 'badge-const',
    image: 'assets/images/showcase/hero-app-apu.png',
    tag: 'Presupuestos & Precios Unitarios'
  },
  {
    id: 'alcances',
    app: 'arq',
    title: 'Alcances de Proyecto Ejecutivo',
    product: 'Cubikar Arquitectura',
    badgeClass: 'badge-arq',
    image: 'assets/images/showcase/hero-app-alcances.png',
    tag: 'Coordinación Multidisciplinaria'
  },
  {
    id: 'erp',
    app: 'const',
    title: 'Tablero Financiero ERP & Compras',
    product: 'Cubikar Construcción',
    badgeClass: 'badge-const',
    image: 'assets/images/showcase/hero-app-erp.png',
    tag: 'Control de Egresos & Semáforo'
  },
  {
    id: 'estimaciones',
    app: 'const',
    title: 'Estimaciones & Números Generadores',
    product: 'Cubikar Construcción',
    badgeClass: 'badge-const',
    image: 'assets/images/showcase/hero-app-estimaciones.png',
    tag: 'Avance Real & Cobros de Obra'
  },
  {
    id: 'especialistas',
    app: 'arq',
    title: 'Control de Pagos a Especialistas',
    product: 'Cubikar Arquitectura',
    badgeClass: 'badge-arq',
    image: 'assets/images/showcase/hero-app-especialistas.png',
    tag: 'Honorarios & Subcontratos'
  }
];

export const YOUTUBE_VIDEO_ID = 'bj2uwR_fvcg';
export const YOUTUBE_EMBED_URL = `https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?enablejsapi=1&autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&controls=1&modestbranding=1&rel=0&playsinline=1`;

let currentMode = 'video'; // 'video' | 'gallery'
let currentIndex = 0;
let autoPlayInterval = null;
let isPaused = false;
let isMuted = true;
const SLIDE_DURATION = 5000;

export function initShowcaseRuleta() {
  const mount = document.getElementById('cubikar-showcase-mount');
  if (!mount) return;

  renderShowcaseStructure(mount);
  bindShowcaseEvents();
  setMode('video');
}

function renderShowcaseStructure(container) {
  container.innerHTML = `
    <div id="hero-showcase-wrapper" class="relative w-full h-full min-h-[500px] lg:min-h-[700px] select-none flex items-center justify-center lg:justify-end lg:pr-6 xl:pr-12 p-3 sm:p-6 lg:p-8">
      
      <!-- Ambient Glow Behind Hero Showcase (D5 Render Cyan/Indigo Aura) -->
      <div class="absolute -inset-10 bg-gradient-to-tr from-cyan-500/10 via-blue-600/10 to-indigo-500/10 rounded-full blur-3xl opacity-70 pointer-events-none"></div>

      <!-- Main Studio Window Container -->
      <div class="relative w-full max-w-4xl xl:max-w-5xl z-10 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-black shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_35px_rgba(0,242,254,0.18)] flex flex-col">
        
        <!-- ================================================================= -->
        <!-- STUDIO WINDOW TOP BAR (Integrated Mode Switcher + Studio Status) -->
        <!-- ================================================================= -->
        <div class="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0e111a]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-2 select-none z-20">
          
          <!-- Left: Mac Window Controls + Seamless Mode Switcher Tabs -->
          <div class="flex items-center gap-2 sm:gap-3">
            <div class="hidden sm:flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
              <div class="h-3 w-px bg-white/15 mx-1"></div>
            </div>

            <!-- Mode Tabs integrated directly in header -->
            <div class="flex items-center gap-1 p-0.5 rounded-xl bg-black/60 border border-white/10">
              <button id="showcase-tab-video" class="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-sm">
                <i class="fa-solid fa-play text-[9px]"></i>
                <span>Video Publicitario</span>
              </button>
              <button id="showcase-tab-gallery" class="px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white hover:bg-white/10">
                <i class="fa-solid fa-images text-[9px]"></i>
                <span>Capturas de App</span>
              </button>
            </div>
          </div>

          <!-- Right: Video Controls (Audio & 1080p) OR Gallery Dots -->
          <div class="flex items-center gap-2">
            
            <!-- Video Specific Controls (Hidden in gallery mode) -->
            <div id="header-video-controls" class="flex items-center gap-2">
              <span class="hidden sm:inline-block px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-bold text-cyan-300">1080p HD</span>
              
              <button id="video-sound-btn" class="px-2.5 sm:px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer">
                <i id="video-sound-icon" class="fa-solid fa-volume-xmark text-slate-400"></i>
                <span id="video-sound-label" class="hidden sm:inline">Activar Audio</span>
                <span class="sm:hidden">Audio</span>
              </button>
            </div>

            <!-- Gallery Specific Dots (Hidden in video mode) -->
            <div id="header-gallery-dots" class="hidden flex items-center gap-1.5 p-1 rounded-full bg-white/5 border border-white/10">
              ${HERO_SLIDES.map((_, idx) => `
                <button onclick="window.goToHeroSlide(${idx})" class="w-2 h-2 rounded-full transition-all duration-300 ${idx === 0 ? 'bg-cyan-400 w-5' : 'bg-white/30 hover:bg-white/60'}" id="carousel-dot-${idx}"></button>
              `).join('')}
            </div>

          </div>

        </div>

        <!-- ================================================================= -->
        <!-- WINDOW BODY: 16:9 VIEWPORT (VIDEO O GALERÍA)                     -->
        <!-- ================================================================= -->
        <div class="relative w-full aspect-video bg-black overflow-hidden">
          
          <!-- VISTA 1: VIDEO YOUTUBE IFRAME -->
          <div id="hero-video-view" class="absolute inset-0 w-full h-full z-10 transition-opacity duration-300">
            <iframe 
              id="hero-youtube-iframe"
              class="w-full h-full border-0 absolute inset-0"
              src="${YOUTUBE_EMBED_URL}"
              title="Cubikar Video Publicitario"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>

          <!-- VISTA 2: RULETA DE CAPTURAS DE LA APP -->
          <div id="hero-gallery-view" class="hidden absolute inset-0 w-full h-full z-10 transition-opacity duration-300">
            
            <div id="hero-carousel-images" class="absolute inset-0 w-full h-full">
              ${HERO_SLIDES.map((slide, idx) => `
                <div id="carousel-slide-${idx}" class="carousel-slide ${idx === 0 ? 'active' : 'inactive'} absolute inset-0 w-full h-full">
                  <img src="${slide.image}" alt="${slide.title}" class="w-full h-full object-cover object-left-top transform transition-transform duration-[7000ms] ease-out ${idx === 0 ? 'scale-100' : 'scale-105'}">
                  <div class="absolute inset-0 bg-gradient-to-t from-[#07080c] via-transparent to-black/30 pointer-events-none"></div>
                  <div class="absolute inset-0 bg-gradient-to-r from-[#07080c] via-transparent to-transparent opacity-80 lg:opacity-40 pointer-events-none"></div>
                </div>
              `).join('')}
            </div>

          </div>

        </div>

        <!-- ================================================================= -->
        <!-- STUDIO WINDOW BOTTOM STATUS BAR                                   -->
        <!-- ================================================================= -->
        <div class="px-4 py-2.5 bg-gradient-to-r from-[#0e111a] via-[#07080c] to-[#0e111a] border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 select-none z-20">
          
          <!-- Bottom Left Info -->
          <div class="flex items-center gap-2 sm:gap-3">
            <div id="bottom-video-info" class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,242,254,0.9)] animate-pulse"></span>
              <span class="text-cyan-400 font-bold">Video Oficial</span>
              <span class="hidden md:inline text-slate-500">| Conoce el flujo de trabajo en la nube</span>
            </div>

            <div id="bottom-gallery-info" class="hidden flex items-center gap-2">
              <span id="carousel-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold ${HERO_SLIDES[0].badgeClass}">
                ${HERO_SLIDES[0].product}
              </span>
              <span id="carousel-title" class="text-xs font-bold text-white tracking-wide truncate max-w-[200px] sm:max-w-xs">
                ${HERO_SLIDES[0].title}
              </span>
            </div>
          </div>

          <!-- Bottom Right Controls -->
          <div class="flex items-center gap-2 sm:gap-3">
            
            <!-- Video External Link -->
            <div id="bottom-video-actions">
              <a href="https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}" target="_blank" rel="noopener noreferrer" class="hover:text-cyan-400 transition flex items-center gap-1.5 text-[11px] font-medium">
                <span>Ver en YouTube</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </a>
            </div>

            <!-- Gallery Navigation Controls -->
            <div id="bottom-gallery-actions" class="hidden flex items-center gap-1.5">
              <button id="carousel-btn-prev" class="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer" title="Anterior">
                <i class="fa-solid fa-chevron-left text-[10px]"></i>
              </button>
              
              <div class="px-1 text-xs font-mono font-bold text-slate-300 min-w-[42px] text-center">
                <span id="carousel-current-num" class="text-cyan-400">01</span><span class="text-slate-600">/</span><span>05</span>
              </div>

              <button id="carousel-btn-next" class="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer" title="Siguiente">
                <i class="fa-solid fa-chevron-right text-[10px]"></i>
              </button>

              <button id="carousel-btn-pause" class="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer ml-1" title="Pausar / Reproducir">
                <i id="carousel-pause-icon" class="fa-solid fa-pause text-[10px]"></i>
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  `;
}

export function setMode(mode) {
  currentMode = mode;
  const tabVideo = document.getElementById('showcase-tab-video');
  const tabGallery = document.getElementById('showcase-tab-gallery');
  const viewVideo = document.getElementById('hero-video-view');
  const viewGallery = document.getElementById('hero-gallery-view');
  
  const headerVideoControls = document.getElementById('header-video-controls');
  const headerGalleryDots = document.getElementById('header-gallery-dots');
  
  const bottomVideoInfo = document.getElementById('bottom-video-info');
  const bottomGalleryInfo = document.getElementById('bottom-gallery-info');
  const bottomVideoActions = document.getElementById('bottom-video-actions');
  const bottomGalleryActions = document.getElementById('bottom-gallery-actions');

  const iframe = document.getElementById('hero-youtube-iframe');

  if (mode === 'video') {
    if (tabVideo) {
      tabVideo.className = 'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-sm';
    }
    if (tabGallery) {
      tabGallery.className = 'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white hover:bg-white/10';
    }
    
    if (viewVideo) viewVideo.classList.remove('hidden');
    if (viewGallery) viewGallery.classList.add('hidden');

    if (headerVideoControls) headerVideoControls.classList.remove('hidden');
    if (headerGalleryDots) headerGalleryDots.classList.add('hidden');

    if (bottomVideoInfo) bottomVideoInfo.classList.remove('hidden');
    if (bottomGalleryInfo) bottomGalleryInfo.classList.add('hidden');
    if (bottomVideoActions) bottomVideoActions.classList.remove('hidden');
    if (bottomGalleryActions) bottomGalleryActions.classList.add('hidden');

    stopAutoPlay();
    if (iframe && iframe.contentWindow) {
      sendYouTubeCommand('playVideo');
    }
  } else {
    if (tabGallery) {
      tabGallery.className = 'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-sm';
    }
    if (tabVideo) {
      tabVideo.className = 'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white hover:bg-white/10';
    }

    if (viewVideo) viewVideo.classList.add('hidden');
    if (viewGallery) viewGallery.classList.remove('hidden');

    if (headerVideoControls) headerVideoControls.classList.add('hidden');
    if (headerGalleryDots) headerGalleryDots.classList.remove('hidden');

    if (bottomVideoInfo) bottomVideoInfo.classList.add('hidden');
    if (bottomGalleryInfo) bottomGalleryInfo.classList.remove('hidden');
    if (bottomVideoActions) bottomVideoActions.classList.add('hidden');
    if (bottomGalleryActions) bottomGalleryActions.classList.remove('hidden');

    if (iframe && iframe.contentWindow) {
      sendYouTubeCommand('pauseVideo');
    }
    updateSlide(currentIndex);
    startAutoPlay();
  }
}

function sendYouTubeCommand(func, args = []) {
  const iframe = document.getElementById('hero-youtube-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: func,
      args: args
    }), '*');
  }
}

export function toggleVideoSound() {
  isMuted = !isMuted;
  const command = isMuted ? 'mute' : 'unMute';
  sendYouTubeCommand(command);

  const btn = document.getElementById('video-sound-btn');
  const icon = document.getElementById('video-sound-icon');
  const label = document.getElementById('video-sound-label');

  if (btn && icon && label) {
    if (isMuted) {
      icon.className = 'fa-solid fa-volume-xmark text-slate-400';
      label.textContent = 'Activar Audio';
      btn.className = 'px-2.5 sm:px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer';
    } else {
      icon.className = 'fa-solid fa-volume-high text-cyan-400 animate-pulse';
      label.textContent = 'Audio Activado';
      btn.className = 'px-2.5 sm:px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_15px_rgba(0,242,254,0.3)]';
    }
  }
}

function bindShowcaseEvents() {
  const tabVideo = document.getElementById('showcase-tab-video');
  const tabGallery = document.getElementById('showcase-tab-gallery');
  const soundBtn = document.getElementById('video-sound-btn');

  if (tabVideo) tabVideo.addEventListener('click', () => setMode('video'));
  if (tabGallery) tabGallery.addEventListener('click', () => setMode('gallery'));
  if (soundBtn) soundBtn.addEventListener('click', toggleVideoSound);

  const btnPrev = document.getElementById('carousel-btn-prev');
  const btnNext = document.getElementById('carousel-btn-next');
  const btnPause = document.getElementById('carousel-btn-pause');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      prevSlide();
      resetTimer();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      nextSlide();
      resetTimer();
    });
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      togglePause();
    });
  }

  const wrapper = document.getElementById('hero-gallery-view');
  if (wrapper) {
    wrapper.addEventListener('mouseenter', () => {
      isPaused = true;
    });
    wrapper.addEventListener('mouseleave', () => {
      isPaused = false;
    });
  }
}

function updateSlide(newIdx) {
  HERO_SLIDES.forEach((_, idx) => {
    const el = document.getElementById(`carousel-slide-${idx}`);
    const dot = document.getElementById(`carousel-dot-${idx}`);
    if (el) {
      if (idx === newIdx) {
        el.className = 'carousel-slide active absolute inset-0 w-full h-full';
        const img = el.querySelector('img');
        if (img) img.classList.replace('scale-105', 'scale-100');
      } else {
        el.className = 'carousel-slide inactive absolute inset-0 w-full h-full';
        const img = el.querySelector('img');
        if (img) img.classList.replace('scale-100', 'scale-105');
      }
    }
    if (dot) {
      if (idx === newIdx) {
        dot.className = 'w-5 h-2 rounded-full bg-cyan-400 transition-all duration-300';
      } else {
        dot.className = 'w-2 h-2 rounded-full bg-white/30 hover:bg-white/60 transition-all duration-300';
      }
    }
  });

  const slide = HERO_SLIDES[newIdx];
  const titleEl = document.getElementById('carousel-title');
  const badgeEl = document.getElementById('carousel-badge');
  const numEl = document.getElementById('carousel-current-num');

  if (titleEl) titleEl.textContent = slide.title;
  if (badgeEl) {
    badgeEl.textContent = slide.product;
    badgeEl.className = `px-2 py-0.5 rounded-full text-[10px] font-bold ${slide.badgeClass}`;
  }
  if (numEl) numEl.textContent = `0${newIdx + 1}`;

  currentIndex = newIdx;
}

function nextSlide() {
  const nextIdx = (currentIndex + 1) % HERO_SLIDES.length;
  updateSlide(nextIdx);
}

function prevSlide() {
  const prevIdx = (currentIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length;
  updateSlide(prevIdx);
}

function startAutoPlay() {
  stopAutoPlay();
  autoPlayInterval = setInterval(() => {
    if (!isPaused && currentMode === 'gallery') {
      nextSlide();
    }
  }, SLIDE_DURATION);
}

function stopAutoPlay() {
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
  }
}

function resetTimer() {
  stopAutoPlay();
  startAutoPlay();
}

function togglePause() {
  isPaused = !isPaused;
  const icon = document.getElementById('carousel-pause-icon');
  if (icon) {
    if (isPaused) {
      icon.className = 'fa-solid fa-play text-[10px] text-cyan-400';
    } else {
      icon.className = 'fa-solid fa-pause text-[10px]';
    }
  }
}

// Global scope helpers
window.goToHeroSlide = (idx) => {
  setMode('gallery');
  updateSlide(idx);
  resetTimer();
};

window.switchAppToConst = () => {
  setMode('gallery');
  const constIdx = HERO_SLIDES.findIndex(s => s.app === 'const');
  if (constIdx !== -1) {
    updateSlide(constIdx);
  }
  const el = document.getElementById('hero-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.switchAppToArq = () => {
  setMode('gallery');
  const arqIdx = HERO_SLIDES.findIndex(s => s.app === 'arq');
  if (arqIdx !== -1) {
    updateSlide(arqIdx);
  }
  const el = document.getElementById('hero-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.toggleHeroVideoSound = toggleVideoSound;
window.setHeroShowcaseMode = setMode;
