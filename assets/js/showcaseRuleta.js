// assets/js/showcaseRuleta.js
// Álbum Ruleta Publicitario Oficial — Modo Limpio sin Barras de Botones (1 al 6 en Loop Infinito)

export const HERO_SLIDES = [
  {
    id: 'slide-1',
    sequence: 1,
    title: 'Ecosistema Unificado Digital',
    product: 'Cubikar Oficial',
    image: 'assets/images/showcase/ruleta/1 cubikar_animacion_logo.gif',
    tag: 'Animación Oficial & Branding',
    duration: 6200
  },
  {
    id: 'slide-2',
    sequence: 2,
    title: 'Control de Proyectos & Portafolio',
    product: 'Cubikar Arquitectura',
    image: 'assets/images/showcase/ruleta/2.png',
    tag: 'Gestión Integral & Entregables',
    duration: 5000
  },
  {
    id: 'slide-3',
    sequence: 3,
    title: 'Catálogo de Insumos & Matrices APU',
    product: 'Cubikar Construcción',
    image: 'assets/images/showcase/ruleta/3.png',
    tag: 'Presupuestos Oficiales & Precios Unitarios',
    duration: 5000
  },
  {
    id: 'slide-4',
    sequence: 4,
    title: 'Tablero Financiero ERP & Compras',
    product: 'Cubikar Construcción',
    image: 'assets/images/showcase/ruleta/4.png',
    tag: 'Control de Egresos & Proveedores',
    duration: 5000
  },
  {
    id: 'slide-5',
    sequence: 5,
    title: 'Estimaciones & Números Generadores',
    product: 'Cubikar Construcción',
    image: 'assets/images/showcase/ruleta/5.png',
    tag: 'Avance Real & Cobros de Obra',
    duration: 5000
  },
  {
    id: 'slide-6',
    sequence: 6,
    title: 'Supervisión en Vivo & Nube Segura',
    product: 'Cubikar Ecosistema',
    image: 'assets/images/showcase/ruleta/6.png',
    tag: 'Sincronización Cloud & Respaldos',
    duration: 5000
  }
];

let currentIndex = 0;
let autoPlayTimer = null;
let isPaused = false;
let progressStartTime = 0;
let remainingTime = 0;

export function initShowcaseRuleta() {
  const mount = document.getElementById('cubikar-showcase-mount');
  if (!mount) return;

  renderRuletaStructure(mount);
  bindRuletaEvents();
  updateSlide(0, false);
  startSlideAutoPlay(HERO_SLIDES[0].duration);
}

function renderRuletaStructure(container) {
  container.innerHTML = `
    <div id="hero-showcase-wrapper" class="relative w-full h-full min-h-[500px] lg:min-h-[700px] select-none flex items-center justify-center lg:justify-end lg:pr-6 xl:pr-12 p-3 sm:p-6 lg:p-8">
      
      <!-- Aura de resplandor ambiental detrás del Álbum Ruleta (Cian & Azul Índigo) -->
      <div class="absolute -inset-10 bg-gradient-to-tr from-cyan-500/10 via-blue-600/10 to-indigo-500/10 rounded-full blur-3xl opacity-70 pointer-events-none"></div>

      <!-- Ventana Principal del Álbum Ruleta (Diseño Limpio Sin Barras) -->
      <div id="ruleta-window-container" class="relative w-full max-w-4xl xl:max-w-5xl z-10 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 bg-black shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_35px_rgba(0,242,254,0.18)] flex flex-col">
        
        <!-- VIEWPORT PRINCIPAL 16:10 TOTALMENTE LIMPIO -->
        <div id="ruleta-viewport" class="relative w-full aspect-[16/10] bg-[#021026] overflow-hidden">
          
          <!-- Contenedor de Slides (1 al 6) -->
          <div id="hero-carousel-images" class="absolute inset-0 w-full h-full">
            ${HERO_SLIDES.map((slide, idx) => `
              <div 
                id="carousel-slide-${idx}" 
                class="carousel-slide ${idx === 0 ? 'active' : 'inactive'} absolute inset-0 w-full h-full flex items-center justify-center bg-[#021026]"
              >
                <img 
                  src="${slide.image}" 
                  alt="${slide.title}" 
                  class="w-full h-full object-contain sm:object-cover object-center transform transition-transform duration-[6000ms] ease-out ${idx === 0 ? 'scale-100' : 'scale-105'}"
                  loading="${idx < 2 ? 'eager' : 'lazy'}"
                >
                <!-- Sombras sutiles de viñeta cinematográfica para integración limpia -->
                <div class="absolute inset-0 bg-gradient-to-t from-[#07080c]/50 via-transparent to-black/15 pointer-events-none"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#07080c]/50 via-transparent to-transparent pointer-events-none"></div>
              </div>
            `).join('')}
          </div>

          <!-- Barra de progreso sutil y ultra-fina (1.5px) en la base inferior -->
          <div class="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-30 pointer-events-none">
            <div id="ruleta-progress-bar" class="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 shadow-[0_0_10px_rgba(0,242,254,0.8)] w-0 transition-none"></div>
          </div>

        </div>

      </div>

    </div>
  `;
}

function bindRuletaEvents() {
  const viewport = document.getElementById('ruleta-viewport');
  if (viewport) {
    viewport.addEventListener('mouseenter', () => {
      isPaused = true;
      pauseProgressBar();
    });
    viewport.addEventListener('mouseleave', () => {
      isPaused = false;
      resumeProgressBar();
    });
  }
}

function updateSlide(newIdx, animateProgress = true) {
  HERO_SLIDES.forEach((_, idx) => {
    const el = document.getElementById(`carousel-slide-${idx}`);
    if (el) {
      if (idx === newIdx) {
        el.className = 'carousel-slide active absolute inset-0 w-full h-full flex items-center justify-center bg-[#021026]';
        const img = el.querySelector('img');
        if (img) img.classList.replace('scale-105', 'scale-100');
      } else {
        el.className = 'carousel-slide inactive absolute inset-0 w-full h-full flex items-center justify-center bg-[#021026]';
        const img = el.querySelector('img');
        if (img) img.classList.replace('scale-100', 'scale-105');
      }
    }
  });

  currentIndex = newIdx;

  if (animateProgress && !isPaused) {
    startSlideAutoPlay(HERO_SLIDES[newIdx].duration);
  }
}

function nextSlide() {
  const nextIdx = (currentIndex + 1) % HERO_SLIDES.length;
  updateSlide(nextIdx, true);
}

function prevSlide() {
  const prevIdx = (currentIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length;
  updateSlide(prevIdx, true);
}

function startSlideAutoPlay(duration) {
  stopAutoPlay();
  
  const bar = document.getElementById('ruleta-progress-bar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '0%';
    void bar.offsetWidth; // Forzar reflow
    bar.style.transition = `width ${duration}ms linear`;
    bar.style.width = '100%';
  }

  progressStartTime = Date.now();
  remainingTime = duration;

  autoPlayTimer = setTimeout(() => {
    if (!isPaused) {
      nextSlide();
    }
  }, duration);
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }
}

function pauseProgressBar() {
  stopAutoPlay();
  const bar = document.getElementById('ruleta-progress-bar');
  if (bar) {
    const computedWidth = window.getComputedStyle(bar).width;
    bar.style.transition = 'none';
    bar.style.width = computedWidth;
  }
  const elapsed = Date.now() - progressStartTime;
  remainingTime = Math.max(500, remainingTime - elapsed);
}

function resumeProgressBar() {
  const bar = document.getElementById('ruleta-progress-bar');
  if (bar && remainingTime > 0) {
    bar.style.transition = `width ${remainingTime}ms linear`;
    bar.style.width = '100%';
  }
  progressStartTime = Date.now();
  autoPlayTimer = setTimeout(() => {
    if (!isPaused) {
      nextSlide();
    }
  }, remainingTime);
}

function resetTimer() {
  const duration = HERO_SLIDES[currentIndex].duration || 5000;
  startSlideAutoPlay(duration);
}

// Global scope helpers para compatibilidad
window.goToHeroSlide = (idx) => {
  isPaused = false;
  updateSlide(idx, true);
};

window.switchAppToConst = () => {
  const constIdx = HERO_SLIDES.findIndex(s => s.product.includes('Construcción'));
  if (constIdx !== -1) {
    window.goToHeroSlide(constIdx);
  }
  const el = document.getElementById('hero-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.switchAppToArq = () => {
  const arqIdx = HERO_SLIDES.findIndex(s => s.product.includes('Arquitectura'));
  if (arqIdx !== -1) {
    window.goToHeroSlide(arqIdx);
  }
  const el = document.getElementById('hero-section');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.toggleRuletaFullscreen = function() {
  const container = document.getElementById('ruleta-window-container');
  if (!container) return;
  if (!document.fullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

window.toggleHeroVideoSound = () => {};
window.setHeroShowcaseMode = () => {};
window.toggleVideoFullscreen = window.toggleRuletaFullscreen;
