// assets/js/showcaseRuleta.js
// Álbum Ruleta Interactivo para Cubikar - Inspirado en Lumion, D5 Render y Monday.com

export const SHOWCASE_DATA = {
  const: {
    appId: 'const',
    name: 'Cubikar Construcción',
    badge: 'const.cubikar.app',
    badgeClass: 'badge-const',
    themeColor: 'amber',
    glowClass: 'd5-glow-amber',
    accentHex: '#f59e0b',
    accentGradient: 'from-amber-500 to-orange-500',
    borderActive: 'border-amber-500',
    url: 'https://const.cubikar.app',
    slides: [
      {
        id: 'apu',
        num: '01',
        title: 'Catálogo Base & Matrices APU',
        subtitle: 'Análisis de Precios Unitarios en tiempo real',
        desc: 'Presupuesta desglosando Materiales, Mano de Obra, Equipos y Subcontratos con bases oficiales y cálculo de FASR.',
        type: 'apu_simulation'
      },
      {
        id: 'gantt',
        num: '02',
        title: 'Cronograma de Obra & Ruta Crítica',
        subtitle: 'Planificación temporal y registro pluvial',
        desc: 'Diagramas de Gantt interactivos con cálculo automático de ruta crítica, holguras y bitácora de días lluviosos.',
        type: 'gantt_simulation'
      },
      {
        id: 'estimaciones',
        num: '03',
        title: 'Estimaciones & Números Generadores',
        subtitle: 'Cobros formales basados en avance real ejecutado',
        desc: 'Controla volúmenes contratados vs. ejecutados, retenciones de fondo de garantía y genera carátulas de estimación en 1 clic.',
        type: 'estimaciones_simulation'
      },
      {
        id: 'compras',
        num: '04',
        title: 'Control de Compras ERP',
        subtitle: 'Suministros, órdenes de compra y comparativa de cotizaciones',
        desc: 'Evita sobrecostos rastreando requisiciones de residentes, comparativa de 3 cotizaciones y pagos a proveedores de insumos.',
        type: 'compras_simulation'
      },
      {
        id: 'bitacora',
        num: '05',
        title: 'Bitácora Digital Legal de Obra',
        subtitle: 'Registro de incidencias inmutable con validez técnica',
        desc: 'Asientos diarios protegidos contra alteraciones, firmas digitales, reporte de clima y registro fotográfico con geolocalización.',
        type: 'bitacora_simulation'
      }
    ]
  },
  arq: {
    appId: 'arq',
    name: 'Cubikar Arquitectura',
    badge: 'arq.cubikar.app',
    badgeClass: 'badge-arq',
    themeColor: 'blue',
    glowClass: 'd5-glow-cyan',
    accentHex: '#00e5ff',
    accentGradient: 'from-cyan-400 to-blue-600',
    borderActive: 'border-cyan-400',
    url: 'https://arq.cubikar.app',
    slides: [
      {
        id: 'alcances',
        num: '01',
        title: 'Matriz de Alcances de Proyecto',
        subtitle: 'Coordinación ejecutiva multidisciplinaria',
        desc: 'Define y supervisa los paquetes de planos: Arquitectónico, Estructural, MEP (Instalaciones) y Estudios Técnicos preliminares.',
        type: 'alcances_simulation'
      },
      {
        id: 'presupuesto',
        num: '02',
        title: 'Presupuesto Base & Honorarios Cost-Plus',
        subtitle: 'Costeo analítico de proyecto y margen del despacho',
        desc: 'Calcula el costo real por metro cuadrado, horas de diseñadores y utilidades del despacho con fórmula paramétrica.',
        type: 'presupuesto_simulation'
      },
      {
        id: 'tareas',
        num: '03',
        title: 'Asignación de Tareas & Calendario',
        subtitle: 'Gestión ágil para diseñadores y especialistas externos',
        desc: 'Asigna entregables clave con fechas límite, alertas de revisión de planos y control de versiones por etapa de diseño.',
        type: 'tareas_simulation'
      },
      {
        id: 'honorarios',
        num: '04',
        title: 'Estimaciones & Cobro de Honorarios',
        subtitle: 'Emisión de estados de cuenta y cobros por hito de entrega',
        desc: 'Gestiona anticipos, hitos de anteproyecto y entrega final de planos con seguimiento transparente para el cliente.',
        type: 'honorarios_simulation'
      },
      {
        id: 'proveedores',
        num: '05',
        title: 'Pagos a Proveedores & Contratistas',
        subtitle: 'Administración de ingenieros y consultores externos',
        desc: 'Monitorea saldos por pagar a estructuristas, mecánicos de suelos y topógrafos vinculados a cada proyecto ejecutivo.',
        type: 'proveedores_simulation'
      }
    ]
  }
};

let currentApp = 'const'; // 'const' | 'arq'
let currentSlideIndex = 0;
let autoPlayInterval = null;
let isPaused = false;
let progressInterval = null;
let progressValue = 0;
const SLIDE_DURATION = 7000; // 7 segundos por slide

export function initShowcaseRuleta() {
  const container = document.getElementById('cubikar-showcase-mount');
  if (!container) return;

  renderRuletaStructure(container);
  bindEvents();
  showSlide(currentApp, 0);
  startAutoPlay();
}

function renderRuletaStructure(container) {
  container.innerHTML = `
    <div id="ecosistema" class="relative max-w-6xl mx-auto">
      
      <!-- Ambient Glow (D5 Render Style) -->
      <div id="ruleta-glow-bg" class="absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent blur-3xl opacity-60 rounded-3xl pointer-events-none transition-all duration-700"></div>

      <!-- Main Showcase Container (Lumion Style) -->
      <div class="relative bg-slate-950/90 border border-slate-800/90 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl">
        
        <!-- Top App Switcher Header -->
        <div class="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[11px] font-mono uppercase tracking-widest text-slate-400 font-semibold">Explora la Suite en Vivo</span>
            </div>
            <h3 class="text-xl sm:text-2xl font-extrabold text-white font-heading tracking-tight">
              Álbum Interactivo de Capacidades
            </h3>
          </div>

          <!-- Dual App Selector Buttons (D5 Style) -->
          <div class="flex items-center p-1.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
            <button id="btn-switch-const" class="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer">
              <i class="fa-solid fa-helmet-safety text-xs"></i>
              <span>Cubikar Construcción</span>
            </button>
            <button id="btn-switch-arq" class="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer">
              <i class="fa-solid fa-compass-drafting text-xs"></i>
              <span>Cubikar Arquitectura</span>
            </button>
          </div>
        </div>

        <!-- Ruleta / Feature Tabs Strip -->
        <div class="px-4 py-3 bg-slate-950/60 border-b border-slate-800/60 overflow-x-auto scrollbar-none">
          <div id="ruleta-tabs-container" class="flex items-center gap-2 min-w-max">
            <!-- Tabs rendered dynamically -->
          </div>
        </div>

        <!-- Simulated OS / Browser Mockup (Twinmotion/Lumion Style) -->
        <div class="p-4 sm:p-6 md:p-8">
          
          <!-- Browser Frame Header -->
          <div class="rounded-t-2xl bg-slate-900/90 border border-slate-800 px-4 py-3 flex items-center justify-between gap-4">
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full bg-rose-500/80"></div>
              <div class="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div class="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
            
            <div class="flex-1 max-w-md hidden sm:flex items-center justify-center">
              <div class="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1 flex items-center gap-2 text-xs font-mono text-slate-400 truncate">
                <i class="fa-solid fa-lock text-[10px] text-emerald-400"></i>
                <span id="ruleta-browser-url" class="truncate">https://const.cubikar.app</span>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <span id="ruleta-live-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                Módulo Activo
              </span>
              <a id="ruleta-launch-link" href="https://const.cubikar.app" target="_blank" class="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition">
                <span>Abrir App</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
              </a>
            </div>
          </div>

          <!-- Browser Frame Content / Interactive Screen Canvas -->
          <div id="ruleta-screen-canvas" class="rounded-b-2xl bg-slate-950 border-x border-b border-slate-800 min-h-[380px] sm:min-h-[440px] relative overflow-hidden flex flex-col justify-between p-4 sm:p-6">
            <!-- Simulated Animated UI content rendered here -->
          </div>

          <!-- Slide Meta & Controls Footer -->
          <div class="mt-5 flex flex-col md:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800/60">
            <div class="text-left max-w-xl">
              <div class="flex items-center gap-2 mb-1">
                <span id="ruleta-slide-num" class="text-xs font-black px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">01</span>
                <h4 id="ruleta-slide-title" class="text-base sm:text-lg font-bold text-white font-heading">
                  Catálogo Base & Matrices APU
                </h4>
              </div>
              <p id="ruleta-slide-desc" class="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Presupuesta desglosando Materiales, Mano de Obra, Equipos y Subcontratos con bases oficiales.
              </p>
            </div>

            <!-- Carousel Controls & Auto-timer -->
            <div class="flex items-center gap-3 shrink-0">
              <button id="btn-ruleta-prev" class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer" title="Anterior">
                <i class="fa-solid fa-chevron-left text-xs"></i>
              </button>
              
              <!-- Timer Progress Bar -->
              <div class="w-24 sm:w-32 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative" title="Tiempo de diapositiva">
                <div id="ruleta-progress-bar" class="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-100 rounded-full" style="width: 0%"></div>
              </div>

              <button id="btn-ruleta-pause" class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer" title="Pausar / Reanudar">
                <i id="ruleta-pause-icon" class="fa-solid fa-pause text-xs"></i>
              </button>

              <button id="btn-ruleta-next" class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer" title="Siguiente">
                <i class="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  `;
}

function bindEvents() {
  const btnConst = document.getElementById('btn-switch-const');
  const btnArq = document.getElementById('btn-switch-arq');
  const btnPrev = document.getElementById('btn-ruleta-prev');
  const btnNext = document.getElementById('btn-ruleta-next');
  const btnPause = document.getElementById('btn-ruleta-pause');
  const screenCanvas = document.getElementById('ruleta-screen-canvas');

  if (btnConst) {
    btnConst.addEventListener('click', () => switchApp('const'));
  }
  if (btnArq) {
    btnArq.addEventListener('click', () => switchApp('arq'));
  }
  if (btnPrev) {
    btnPrev.addEventListener('click', () => prevSlide());
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => nextSlide());
  }
  if (btnPause) {
    btnPause.addEventListener('click', () => togglePause());
  }

  // Pausar auto-avance al pasar el mouse por encima para examinar con calma
  if (screenCanvas) {
    screenCanvas.addEventListener('mouseenter', () => { isPaused = true; updatePauseIcon(); });
    screenCanvas.addEventListener('mouseleave', () => { isPaused = false; updatePauseIcon(); });
  }
}

export function switchApp(appKey) {
  if (currentApp === appKey) return;
  currentApp = appKey;
  currentSlideIndex = 0;
  
  const btnConst = document.getElementById('btn-switch-const');
  const btnArq = document.getElementById('btn-switch-arq');
  const glowBg = document.getElementById('ruleta-glow-bg');
  const liveBadge = document.getElementById('ruleta-live-badge');
  const launchLink = document.getElementById('ruleta-launch-link');
  const browserUrl = document.getElementById('ruleta-browser-url');
  const progressBar = document.getElementById('ruleta-progress-bar');

  if (appKey === 'const') {
    btnConst.className = 'px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer';
    btnArq.className = 'px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer';
    if (glowBg) glowBg.className = 'absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent blur-3xl opacity-60 rounded-3xl pointer-events-none transition-all duration-700';
    if (liveBadge) liveBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider';
    if (launchLink) launchLink.href = 'https://const.cubikar.app';
    if (browserUrl) browserUrl.innerText = 'https://const.cubikar.app';
    if (progressBar) progressBar.className = 'h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-100 rounded-full';
  } else {
    btnArq.className = 'px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20 cursor-pointer';
    btnConst.className = 'px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 text-slate-400 hover:text-white cursor-pointer';
    if (glowBg) glowBg.className = 'absolute -inset-4 bg-gradient-to-r from-cyan-400/20 via-blue-600/10 to-transparent blur-3xl opacity-60 rounded-3xl pointer-events-none transition-all duration-700';
    if (liveBadge) liveBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase tracking-wider';
    if (launchLink) launchLink.href = 'https://arq.cubikar.app';
    if (browserUrl) browserUrl.innerText = 'https://arq.cubikar.app';
    if (progressBar) progressBar.className = 'h-full bg-gradient-to-r from-cyan-400 to-blue-600 transition-all duration-100 rounded-full';
  }

  showSlide(currentApp, 0);
  resetTimer();
}

export function showSlide(appKey, slideIdx) {
  const appData = SHOWCASE_DATA[appKey];
  if (!appData || !appData.slides[slideIdx]) return;
  
  currentSlideIndex = slideIdx;
  const slide = appData.slides[slideIdx];

  // 1. Actualizar pestañas superiores
  renderTabs(appData, slideIdx);

  // 2. Actualizar textos informativos
  const numEl = document.getElementById('ruleta-slide-num');
  const titleEl = document.getElementById('ruleta-slide-title');
  const descEl = document.getElementById('ruleta-slide-desc');
  if (numEl) {
    numEl.innerText = slide.num;
    numEl.className = `text-xs font-black px-2 py-0.5 rounded bg-slate-800 ${appKey === 'const' ? 'text-amber-400' : 'text-cyan-400'} font-mono`;
  }
  if (titleEl) titleEl.innerText = slide.title;
  if (descEl) descEl.innerText = slide.desc;

  // 3. Renderizar el lienzo de la pantalla (UI Interactiva viva)
  const canvas = document.getElementById('ruleta-screen-canvas');
  if (canvas) {
    canvas.innerHTML = getSlideMockupHTML(appKey, slide);
  }
}

function renderTabs(appData, activeIdx) {
  const container = document.getElementById('ruleta-tabs-container');
  if (!container) return;

  container.innerHTML = appData.slides.map((s, idx) => {
    const isActive = idx === activeIdx;
    const activeClass = appData.appId === 'const'
      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold shadow-md shadow-amber-500/10'
      : 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 font-bold shadow-md shadow-cyan-500/10';
    const inactiveClass = 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80';

    return `
      <button onclick="window.goToRuletaSlide(${idx})" class="px-3.5 py-1.5 rounded-xl border text-xs flex items-center gap-2 transition cursor-pointer ${isActive ? activeClass : inactiveClass}">
        <span class="font-mono text-[10px] opacity-75">${s.num}.</span>
        <span>${s.title.split('&')[0].trim()}</span>
      </button>
    `;
  }).join('');
}

function getSlideMockupHTML(appKey, slide) {
  // Construcción: Plantillas visuales ultra profesionales
  if (appKey === 'const') {
    switch (slide.id) {
      case 'apu':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
              <div>
                <span class="text-[10px] font-mono font-bold text-amber-400 uppercase">Concepto APU • C-014</span>
                <h5 class="text-sm sm:text-base font-bold text-white">Muro de block de concreto 15x20x40 cm asentado con mortero</h5>
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-400">Precio Unitario Oficial</span>
                <div class="text-lg sm:text-xl font-extrabold text-amber-400 font-mono">$384.50 <span class="text-xs text-slate-400">MXN / m²</span></div>
              </div>
            </div>

            <!-- Desglose por Familia -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400 font-semibold mb-1">MATERIALES (54%)</div>
                <div class="text-sm font-bold text-white font-mono">$207.63</div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div class="bg-amber-400 h-full rounded-full" style="width: 54%"></div>
                </div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400 font-semibold mb-1">MANO DE OBRA (32%)</div>
                <div class="text-sm font-bold text-white font-mono">$123.04</div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div class="bg-orange-500 h-full rounded-full" style="width: 32%"></div>
                </div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400 font-semibold mb-1">EQUIPO & HERRAMIENTA (8%)</div>
                <div class="text-sm font-bold text-white font-mono">$30.76</div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div class="bg-blue-400 h-full rounded-full" style="width: 8%"></div>
                </div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400 font-semibold mb-1">INDIRECTOS & UTILIDAD (6%)</div>
                <div class="text-sm font-bold text-white font-mono">$23.07</div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div class="bg-emerald-400 h-full rounded-full" style="width: 6%"></div>
                </div>
              </div>
            </div>

            <!-- Tabla de Insumos -->
            <div class="bg-slate-900/40 rounded-xl border border-slate-800/80 p-3 text-xs overflow-x-auto">
              <table class="w-full text-left font-mono">
                <thead>
                  <tr class="text-[10px] text-slate-400 border-b border-slate-800">
                    <th class="pb-1.5">CLAVE</th>
                    <th class="pb-1.5">DESCRIPCIÓN</th>
                    <th class="pb-1.5">UNIDAD</th>
                    <th class="pb-1.5">CANTIDAD</th>
                    <th class="pb-1.5 text-right">COSTO</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 text-[11px] text-slate-300">
                  <tr>
                    <td class="py-1.5 text-amber-400">MAT-0081</td>
                    <td>Block de concreto 15x20x40 cm pesado</td>
                    <td>PZA</td>
                    <td>12.500</td>
                    <td class="text-right text-white">$175.00</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 text-orange-400">MO-OFIC-02</td>
                    <td>Cuadrilla No. 2 (1 Albañil + 1 Peón)</td>
                    <td>JOR</td>
                    <td>0.083</td>
                    <td class="text-right text-white">$98.50</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 text-blue-400">EQ-REV-01</td>
                    <td>Revolvedora 1 saco motor gasolina</td>
                    <td>HORA</td>
                    <td>0.120</td>
                    <td class="text-right text-white">$24.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;

      case 'gantt':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div class="flex items-center gap-3">
                <span class="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-bold font-mono">SEMANA 14 / 32</span>
                <span class="text-xs text-slate-300 font-semibold">Avance Programado: 48.5% • Avance Real: 51.2%</span>
              </div>
              <span class="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                +2.7% ADELANTO
              </span>
            </div>

            <!-- Gantt Visualization -->
            <div class="space-y-2.5 text-xs font-mono">
              <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                <div class="w-48 truncate text-slate-200">1. Cimentación y Zapatas</div>
                <div class="flex-1 bg-slate-950 h-5 rounded-md overflow-hidden relative border border-slate-800">
                  <div class="h-full bg-emerald-500 rounded-md flex items-center px-2 text-[10px] font-bold text-slate-950" style="width: 100%">100% COMPLETADO</div>
                </div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                <div class="w-48 truncate text-slate-200">2. Estructura de Concreto Nivel 1</div>
                <div class="flex-1 bg-slate-950 h-5 rounded-md overflow-hidden relative border border-slate-800">
                  <div class="h-full bg-amber-400 rounded-md flex items-center px-2 text-[10px] font-bold text-slate-950 animate-pulse" style="width: 78%">78% EN PROCESO</div>
                </div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                <div class="w-48 truncate text-slate-200">3. Muros y Albañilería</div>
                <div class="flex-1 bg-slate-950 h-5 rounded-md overflow-hidden relative border border-slate-800">
                  <div class="h-full bg-orange-500/80 rounded-md flex items-center px-2 text-[10px] font-bold text-white" style="width: 35%">35% INICIADO</div>
                </div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                <div class="w-48 truncate text-slate-400">4. Instalaciones Hidrosanitarias</div>
                <div class="flex-1 bg-slate-950 h-5 rounded-md overflow-hidden relative border border-slate-800/60">
                  <div class="h-full bg-slate-800 rounded-md flex items-center px-2 text-[10px] text-slate-500" style="width: 0%">PROGRAMADO SEM 16</div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'estimaciones':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span class="text-[10px] font-mono text-amber-400 font-bold uppercase">Estimación No. 04 (Ordinaria)</span>
                <h5 class="text-sm sm:text-base font-bold text-white">Periodo: 01 Nov - 15 Nov 2026</h5>
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-400">Monto a Cobrar Neto</span>
                <div class="text-lg font-extrabold text-emerald-400 font-mono">$482,910.00 MXN</div>
              </div>
            </div>

            <!-- Resumen de Deducciones -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400">IMPORTE BRUTO</div>
                <div class="text-base font-bold text-white font-mono mt-1">$550,000.00</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400">AMORTIZACIÓN ANTICIPO (10%)</div>
                <div class="text-base font-bold text-rose-400 font-mono mt-1">-$55,000.00</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400">FONDO DE GARANTÍA (5%)</div>
                <div class="text-base font-bold text-amber-400 font-mono mt-1">-$27,500.00</div>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-300 flex items-center justify-between">
              <span>📄 Números generadores validados con croquis y fotos adjuntas</span>
              <span class="font-bold text-amber-400 font-mono">LISTO PARA FIRMA DRO</span>
            </div>
          </div>
        `;

      case 'compras':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <h5 class="text-sm sm:text-base font-bold text-white">Órdenes de Compra & Suministros</h5>
              <span class="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                3 PENDIENTES DE AUTORIZAR
              </span>
            </div>

            <div class="space-y-2 text-xs font-mono">
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-bold text-white">OC-2026-089 • Concreto Premezclado f'c=250 kg/cm²</div>
                  <div class="text-slate-400 text-[10px]">Proveedor: Cemex Concretos • 42 m³</div>
                </div>
                <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">APROBADA EN OBRA</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-bold text-white">OC-2026-090 • Acero Corrugado Varilla No. 4 y 3</div>
                  <div class="text-slate-400 text-[10px]">Proveedor: Aceros y Perfiles del Centro • 6.5 Toneladas</div>
                </div>
                <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px]">EN COMPARATIVA</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-bold text-white">OC-2026-091 • Tubería PVC Sanitaria 4" y 6"</div>
                  <div class="text-slate-400 text-[10px]">Proveedor: Grupo Ferretero Mayorista • Lote 1</div>
                </div>
                <span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">SOLICITUD RESIDENTE</span>
              </div>
            </div>
          </div>
        `;

      case 'bitacora':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span class="text-[10px] font-mono text-amber-400 font-bold uppercase">Folio Legal No. 042</span>
                <h5 class="text-sm sm:text-base font-bold text-white">Asiento Diario de Supervisión y Clima</h5>
              </div>
              <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                <i class="fa-solid fa-certificate"></i> INMUTABLE SHA-256
              </span>
            </div>

            <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-300">
              <div class="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                <span>Fecha: 14/Nov/2026 • 09:30 AM</span>
                <span>Clima: Despejado (24°C) • Personal en obra: 28</span>
              </div>
              <p class="leading-relaxed">
                "Se autoriza colado de losa maciza Nivel 2 previo muestreo de cilindros de prueba por laboratorio certificado. Se constata correcto armado y traslapes conforme a plano E-03."
              </p>
              <div class="pt-2 flex items-center justify-between text-[11px]">
                <span class="text-amber-400 font-bold">Firma Residente: Arq. M. Gómez (Reg. 8841)</span>
                <span class="text-emerald-400 font-bold">Firma DRO: Ing. H. Peralta (DRO-1092)</span>
              </div>
            </div>
          </div>
        `;
    }
  }

  // Arquitectura: Plantillas visuales en tonos cian/azul D5
  else {
    switch (slide.id) {
      case 'alcances':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span class="text-[10px] font-mono text-cyan-400 font-bold uppercase">Proyecto Ejecutivo • Torre Residencial V</span>
                <h5 class="text-sm sm:text-base font-bold text-white">Matriz General de Entregables y Planos</h5>
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-400">Avance Entregables</span>
                <div class="text-lg font-extrabold text-cyan-400 font-mono">18 / 24 Planos</div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-white">A-01 a A-08 • Diseño Arquitectónico</span>
                  <span class="text-emerald-400 text-[10px] font-bold">100% LISTO</span>
                </div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-emerald-400 h-full rounded-full" style="width: 100%"></div>
                </div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-white">E-01 a E-06 • Cálculo Estructural</span>
                  <span class="text-cyan-400 text-[10px] font-bold">85% EN REVISIÓN</span>
                </div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-cyan-400 h-full rounded-full" style="width: 85%"></div>
                </div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-white">IE-01 a IE-04 • Instalación Eléctrica</span>
                  <span class="text-amber-400 text-[10px] font-bold">50% EN PROCESO</span>
                </div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-amber-400 h-full rounded-full" style="width: 50%"></div>
                </div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-white">IH-01 a IH-06 • Hidrosanitario y Gas</span>
                  <span class="text-slate-400 text-[10px]">PENDIENTE</span>
                </div>
                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-slate-700 h-full rounded-full" style="width: 20%"></div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 'presupuesto':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span class="text-[10px] font-mono text-cyan-400 font-bold uppercase">Honorarios Profesionales</span>
                <h5 class="text-sm sm:text-base font-bold text-white">Cotización Proyecto Ejecutivo (Fórmula Cost-Plus)</h5>
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-400">Total Cotizado</span>
                <div class="text-lg font-extrabold text-cyan-400 font-mono">$185,000.00 MXN</div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400">COSTO HORAS DE DISEÑO</div>
                <div class="text-base font-bold text-white font-mono mt-1">$92,000.00</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400">CONSULTORES EXTERNOS</div>
                <div class="text-base font-bold text-blue-400 font-mono mt-1">$48,000.00</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div class="text-[10px] text-slate-400">MARGEN DEL DESPACHO (25%)</div>
                <div class="text-base font-bold text-cyan-400 font-mono mt-1">$45,000.00</div>
              </div>
            </div>
          </div>
        `;

      case 'tareas':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <h5 class="text-sm sm:text-base font-bold text-white">Tablero de Entregables & Diseñadores</h5>
              <span class="text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30">
                SPRINT SEMANAL #6
              </span>
            </div>

            <div class="space-y-2 text-xs font-mono">
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span class="font-bold text-white">Detalle de carpinterías y cancelerías</span>
                  <div class="text-slate-400 text-[10px]">Asignado a: Arq. Paola R. • Entrega: 18 Nov</div>
                </div>
                <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold text-[10px]">EN MODELADO 3D</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span class="font-bold text-white">Memoria de cálculo estructural definitiva</span>
                  <div class="text-slate-400 text-[10px]">Asignado a: Ing. Torres (Externo) • Entrega: 20 Nov</div>
                </div>
                <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px]">REVISIÓN MEMORIA</span>
              </div>
            </div>
          </div>
        `;

      case 'honorarios':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span class="text-[10px] font-mono text-cyan-400 font-bold uppercase">Cobros por Hito de Proyecto</span>
                <h5 class="text-sm sm:text-base font-bold text-white">Control Financiero del Cliente</h5>
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-400">Cobrado al momento</span>
                <div class="text-lg font-extrabold text-emerald-400 font-mono">$111,000.00 (60%)</div>
              </div>
            </div>

            <div class="space-y-2 text-xs font-mono">
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-bold text-white">Hito 1: Anticipo de Firma & Anteproyecto</div>
                  <div class="text-[10px] text-slate-400">30% del total • Facturado & Liquidado</div>
                </div>
                <span class="text-emerald-400 font-bold text-xs">$55,500.00 ✓</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-bold text-white">Hito 2: Aprobación de Planos Arquitectónicos</div>
                  <div class="text-[10px] text-slate-400">30% del total • Liquidado</div>
                </div>
                <span class="text-emerald-400 font-bold text-xs">$55,500.00 ✓</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-bold text-white">Hito 3: Entrega Final de Carpeta Ejecutiva</div>
                  <div class="text-[10px] text-slate-400">40% restante • Al entregar memorias y planos sellados</div>
                </div>
                <span class="text-cyan-400 font-bold text-xs">$74,000.00 PENDIENTE</span>
              </div>
            </div>
          </div>
        `;

      case 'proveedores':
        return `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <h5 class="text-sm sm:text-base font-bold text-white">Cuentas por Pagar a Especialistas Externos</h5>
              <span class="text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30">
                SALDO PENDIENTE: $21,000.00
              </span>
            </div>

            <div class="space-y-2 text-xs font-mono">
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-bold text-white">Despacho de Cálculo Estructural (Ing. Torres)</div>
                  <div class="text-[10px] text-slate-400">Proyecto Torre V • Total: $35,000.00</div>
                </div>
                <span class="text-emerald-400 font-bold text-xs">PAGADO $25,000 (Resta $10,000)</span>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-bold text-white">Mecánica de Suelos & Geotecnia (LabGeo S.A.)</div>
                  <div class="text-[10px] text-slate-400">Sondeos y reporte final • Total: $18,000.00</div>
                </div>
                <span class="text-emerald-400 font-bold text-xs">100% FINIQUITADO ✓</span>
              </div>
            </div>
          </div>
        `;
    }
  }

  return `<div class="p-8 text-center text-slate-500">Vista en desarrollo...</div>`;
}

function prevSlide() {
  const appData = SHOWCASE_DATA[currentApp];
  const prevIdx = (currentSlideIndex - 1 + appData.slides.length) % appData.slides.length;
  showSlide(currentApp, prevIdx);
  resetTimer();
}

function nextSlide() {
  const appData = SHOWCASE_DATA[currentApp];
  const nextIdx = (currentSlideIndex + 1) % appData.slides.length;
  showSlide(currentApp, nextIdx);
  resetTimer();
}

function togglePause() {
  isPaused = !isPaused;
  updatePauseIcon();
}

function updatePauseIcon() {
  const icon = document.getElementById('ruleta-pause-icon');
  if (icon) {
    icon.className = isPaused ? 'fa-solid fa-play text-xs' : 'fa-solid fa-pause text-xs';
  }
}

function startAutoPlay() {
  clearInterval(autoPlayInterval);
  clearInterval(progressInterval);

  progressValue = 0;
  const stepTime = 100;
  const stepIncrement = (stepTime / SLIDE_DURATION) * 100;

  progressInterval = setInterval(() => {
    if (!isPaused) {
      progressValue += stepIncrement;
      const bar = document.getElementById('ruleta-progress-bar');
      if (bar) {
        bar.style.width = `${Math.min(progressValue, 100)}%`;
      }
      if (progressValue >= 100) {
        progressValue = 0;
        nextSlide();
      }
    }
  }, stepTime);
}

function resetTimer() {
  progressValue = 0;
  const bar = document.getElementById('ruleta-progress-bar');
  if (bar) bar.style.width = '0%';
}

// Exponer para callbacks de HTML
window.goToRuletaSlide = (idx) => {
  showSlide(currentApp, idx);
  resetTimer();
};

window.switchAppToConst = () => {
  switchApp('const');
};

window.switchAppToArq = () => {
  switchApp('arq');
};
