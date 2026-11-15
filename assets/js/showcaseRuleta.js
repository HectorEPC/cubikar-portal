// assets/js/showcaseRuleta.js
// Álbum Ruleta Cinemático - Capturas Reales de la Aplicación Cubikar

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

let currentIndex = 0;
let autoPlayInterval = null;
let isPaused = false;
const SLIDE_DURATION = 5000; // 5 segundos por imagen

export function initShowcaseRuleta() {
  const mount = document.getElementById('cubikar-showcase-mount');
  if (!mount) return;

  renderCarouselStructure(mount);
  bindCarouselEvents();
  updateSlide(0);
  startAutoPlay();
}

function renderCarouselStructure(container) {
  container.innerHTML = `
    <div id="hero-carousel-wrapper" class="relative w-full h-full min-h-[520px] lg:min-h-[720px] overflow-hidden select-none">
      
      <!-- Container de Imágenes (Transición Suave Lumion) -->
      <div id="hero-carousel-images" class="absolute inset-0 w-full h-full">
        ${HERO_SLIDES.map((slide, idx) => `
          <div id="carousel-slide-${idx}" class="carousel-slide ${idx === 0 ? 'active' : 'inactive'} absolute inset-0 w-full h-full">
            <img src="${slide.image}" alt="${slide.title}" class="w-full h-full object-cover object-left-top transform transition-transform duration-[7000ms] ease-out ${idx === 0 ? 'scale-100' : 'scale-105'}">
            <!-- Subtle Dark Vignette & Gradient Overlays (D5 Render Lighting) -->
            <div class="absolute inset-0 bg-gradient-to-t from-[#07080c] via-transparent to-black/30 pointer-events-none"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-[#07080c] via-transparent to-transparent opacity-80 lg:opacity-40 pointer-events-none"></div>
          </div>
        `).join('')}
      </div>

      <!-- Floating Minimal Glass Badge (Bottom Left/Right - Lumion Style) -->
      <div class="absolute bottom-6 left-6 right-6 lg:left-auto lg:right-8 z-20 flex items-center justify-between lg:justify-end gap-3 pointer-events-auto">
        
        <!-- Info Pill (Limpio, sin saturación de texto) -->
        <div id="carousel-info-pill" class="px-4 py-2 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center gap-3 transition-all duration-300">
          <span id="carousel-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${HERO_SLIDES[0].badgeClass}">
            ${HERO_SLIDES[0].product}
          </span>
          <div class="hidden sm:block text-left">
            <h4 id="carousel-title" class="text-xs font-bold text-white tracking-wide leading-none">
              ${HERO_SLIDES[0].title}
            </h4>
            <span id="carousel-tag" class="text-[10px] text-slate-400 font-medium">
              ${HERO_SLIDES[0].tag}
            </span>
          </div>
        </div>

        <!-- Controls (Arrows & Play/Pause & Counter) -->
        <div class="flex items-center gap-2 p-1.5 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl">
          <button id="carousel-btn-prev" class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer" title="Anterior">
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
          
          <div class="px-2 text-xs font-mono font-bold text-slate-300 min-w-[48px] text-center">
            <span id="carousel-current-num" class="text-cyan-400">01</span><span class="text-slate-600"> / </span><span>05</span>
          </div>

          <button id="carousel-btn-next" class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer" title="Siguiente">
            <i class="fa-solid fa-chevron-right text-xs"></i>
          </button>

          <button id="carousel-btn-pause" class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer ml-1" title="Pausar / Reproducir">
            <i id="carousel-pause-icon" class="fa-solid fa-pause text-[11px]"></i>
          </button>
        </div>

      </div>

      <!-- Micro Progress Dots (Top Right) -->
      <div class="absolute top-6 right-6 z-20 flex items-center gap-1.5 p-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
        ${HERO_SLIDES.map((_, idx) => `
          <button onclick="window.goToHeroSlide(${idx})" class="w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === 0 ? 'bg-cyan-400 w-6' : 'bg-white/30 hover:bg-white/60'}" id="carousel-dot-${idx}"></button>
        `).join('')}
      </div>

    </div>
  `;
}

function bindCarouselEvents() {
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

  // Pausar con hover sobre el contenedor
  const wrapper = document.getElementById('hero-carousel-wrapper');
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
        dot.className = 'w-6 h-2.5 rounded-full bg-cyan-400 transition-all duration-300';
      } else {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-white/30 hover:bg-white/60 transition-all duration-300';
      }
    }
  });

  const slide = HERO_SLIDES[newIdx];
  const titleEl = document.getElementById('carousel-title');
  const tagEl = document.getElementById('carousel-tag');
  const badgeEl = document.getElementById('carousel-badge');
  const numEl = document.getElementById('carousel-current-num');

  if (titleEl) titleEl.textContent = slide.title;
  if (tagEl) tagEl.textContent = slide.tag;
  if (badgeEl) {
    badgeEl.textContent = slide.product;
    badgeEl.className = `px-2.5 py-0.5 rounded-full text-[10px] font-bold ${slide.badgeClass}`;
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
    if (!isPaused) {
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
      icon.className = 'fa-solid fa-play text-[11px] text-cyan-400';
    } else {
      icon.className = 'fa-solid fa-pause text-[11px]';
    }
  }
}

// Global scope helpers
window.goToHeroSlide = (idx) => {
  updateSlide(idx);
  resetTimer();
};

window.switchAppToConst = () => {
  const constIdx = HERO_SLIDES.findIndex(s => s.app === 'const');
  if (constIdx !== -1) {
    updateSlide(constIdx);
  }
  const el = document.getElementById('hero-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.switchAppToArq = () => {
  const arqIdx = HERO_SLIDES.findIndex(s => s.app === 'arq');
  if (arqIdx !== -1) {
    updateSlide(arqIdx);
  }
  const el = document.getElementById('hero-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};
