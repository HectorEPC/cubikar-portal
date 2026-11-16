// assets/js/main.js
// Controlador interactivo sincronizado al 100% con ADM_CONST y ADM_ARQ

import { CONST_TIERS, ARQ_TIERS, COMBO_TIERS, redirectToStripeCheckout, openCustomerPortal, CUBIKAR_SUB_TEST_MODE } from './checkout.js';
import { downloadFullEcosystemBackup } from './exportBackup.js';
import { initAppSwitcher } from './appSwitcher.js';
import { initShowcaseRuleta } from './showcaseRuleta.js';
import { 
  isUserAdmin, 
  openCubikarAdminModal,
  closeCubikarAdminModal,
  openCoAdminsModal,
  closeCoAdminsModal,
  openMarketRatesModal,
  closeMarketRatesModal,
  saveMarketRatesFromModal,
  exportCubikarDatabaseToExcel,
  setAdminAppScope,
  setAdminTableSearch,
  setAdminFilterActivity,
  setAdminFilterPlan,
  setAdminFilterCycle,
  toggleSelectAllAdminUsers,
  onAdminUserCheckboxChange,
  addCoAdmin,
  removeCoAdmin,
  hydrateCoAdminsFromCloud
} from './cubikarAdmin.js';
import { 
  initAuth, 
  hydrateIncomingSsoSession,
  syncSubscriptionFromCloud,
  loginWithEmail, 
  loginWithGoogle,
  registerWithEmail, 
  mountGoogleSignInButton, 
  logout, 
  getCurrentState,
  buildSsoUrl
} from './auth.js';

function showPortalNotification(message, type = 'info') {
  try {
    const existing = document.getElementById('cubikar-portal-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'cubikar-portal-toast';
    const isSuccess = type === 'success';
    const borderCls = isSuccess ? 'border-emerald-500/50 bg-emerald-950/95 text-emerald-100' : 'border-amber-500/50 bg-amber-950/95 text-amber-100';
    const iconCls = isSuccess ? 'fa-solid fa-circle-check text-emerald-400' : 'fa-solid fa-circle-exclamation text-amber-400';
    toast.className = `fixed top-24 right-4 z-[100060] max-w-md px-4 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 text-xs font-semibold transition-all duration-300 ${borderCls}`;
    toast.innerHTML = `<i class="${iconCls} text-base shrink-0"></i><span class="flex-1">${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      try { toast.remove(); } catch (_) {}
    }, 6500);
  } catch (_) {
    alert(message);
  }
}

let currentBillingCycle = 'monthly'; // 'monthly' | 'annual'
let currentPricingProduct = 'const'; // 'const' | 'arq' | 'combo'
let currentAuthMode = 'login';       // 'login' | 'register'
let googleAuthInProgress = false;
let googleAuthWatchdog = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Sincronizar visibilidad del banner de prueba (Cubikar Sub Test)
  const subBanner = document.getElementById('banner-cubikar-sub-test');
  if (subBanner) {
    subBanner.style.display = CUBIKAR_SUB_TEST_MODE ? 'flex' : 'none';
  }

  // Manejar retorno de logout desde aplicaciones satélite (Cubikar Construcción o Cubikar Arquitectura)
  const urlParams = new URLSearchParams(window.location.search);
  const isLogoutReturn = urlParams.get('logout') === '1';
  if (isLogoutReturn) {
    try {
      await logout();
      updateAuthUI(null);
    } catch (_) {}
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Manejar errores de retorno OAuth
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const errorDesc = urlParams.get('error_description') || urlParams.get('error') || hashParams.get('error_description') || hashParams.get('error');
  if (errorDesc) {
    console.error('[Supabase OAuth Error]:', errorDesc);
    alert('Aviso de inicio de sesión: ' + errorDesc);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  let handledOAuthReturn = false;
  const isOAuthReturn = window.location.hash.includes('access_token') || 
                        window.location.search.includes('code=');

  // 1. Inicializar App Switcher (Selector de Apps de 9 puntos)
  initAppSwitcher('cubikar-app-switcher-mount', 'portal');

  // 1.1 Inicializar Álbum Ruleta Interactivo (Showcase Lumion x D5 Render)
  initShowcaseRuleta();

  // 2. Hidratar sesión SSO entrante y esperar inicialización de autenticación antes de evaluar tutorial o retornos de pago
  let lastHydratedCoAdminEmail = '';
  await hydrateIncomingSsoSession();
  await initAuth(state => {
    updateAuthUI(state);
    if (state && state.user) {
      const em = String(state.user.email || '').toLowerCase().trim();
      if (em && em !== lastHydratedCoAdminEmail) {
        lastHydratedCoAdminEmail = em;
        hydrateCoAdminsFromCloud()
          .then(() => updateAuthUI(getCurrentState()))
          .catch(() => {});
      }
      if (isOAuthReturn && !handledOAuthReturn) {
        handledOAuthReturn = true;
        window.history.replaceState({}, document.title, window.location.pathname);
        completeAuthAndOpenChooser();
        return;
      }
      const authModal = document.getElementById('modal-auth');
      if (authModal && !authModal.classList.contains('hidden') && !googleAuthInProgress && state.event === 'SIGNED_IN') {
        completeAuthAndOpenChooser();
      }
    }
  });

  // 2.1 Manejar retorno de Stripe Checkout (?pago=exitoso | ?pago=cancelado)
  const pagoParam = urlParams.get('pago');
  if (pagoParam === 'exitoso' || pagoParam === 'cancelado') {
    const cleanParams = new URLSearchParams(window.location.search);
    cleanParams.delete('pago');
    const cleanQuery = cleanParams.toString();
    const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '') + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);

    if (pagoParam === 'exitoso') {
      try {
        await syncSubscriptionFromCloud();
        updateAuthUI(getCurrentState());
        renderPricingCardsAndComparison();
      } catch (_) {}
      showPortalNotification('¡Pago procesado con éxito! Tu suscripción de Cubikar ha sido actualizada y activada.', 'success');
    } else {
      showPortalNotification('El proceso de pago en Stripe fue cancelado. No se realizó ningún cargo.', 'warning');
    }
  }

  // 3. Exponer funciones al scope global para eventos interactivos en HTML
  window.selectPricingProduct = selectPricingProduct;
  window.setBillingCycle = setBillingCycle;
  window.handleTierSelection = handleTierSelection;
  window.triggerDemoBackupDownload = handleDownloadMyBackup;
  window.handleDownloadMyBackup = handleDownloadMyBackup;
  window.launchApp = launchApp;
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.toggleAuthMode = toggleAuthMode;
  window.openAppChooserModal = openAppChooserModal;
  window.closeAppChooserModal = closeAppChooserModal;
  window.handleAuthSubmit = handleAuthSubmit;
  window.handleGoogleSignIn = handleGoogleSignIn;
  window.openUserDashboard = openUserDashboard;
  window.closeUserDashboard = closeUserDashboard;
  window.handleLogout = handleLogout;
  window.handleStripePortal = handleStripePortal;
  window.openCubikarAdminModal = openCubikarAdminModal;
  window.closeCubikarAdminModal = closeCubikarAdminModal;
  window.openCoAdminsModal = openCoAdminsModal;
  window.closeCoAdminsModal = closeCoAdminsModal;
  window.openMarketRatesModal = openMarketRatesModal;
  window.closeMarketRatesModal = closeMarketRatesModal;
  window.saveMarketRatesFromModal = saveMarketRatesFromModal;
  window.exportCubikarDatabaseToExcel = exportCubikarDatabaseToExcel;
  window.setAdminAppScope = setAdminAppScope;
  window.setAdminTableSearch = setAdminTableSearch;
  window.setAdminFilterActivity = setAdminFilterActivity;
  window.setAdminFilterPlan = setAdminFilterPlan;
  window.setAdminFilterCycle = setAdminFilterCycle;
  window.toggleSelectAllAdminUsers = toggleSelectAllAdminUsers;
  window.onAdminUserCheckboxChange = onAdminUserCheckboxChange;
  window.addCoAdmin = addCoAdmin;
  window.removeCoAdmin = removeCoAdmin;
  window.getCurrentState = getCurrentState;
  window.scrollToEcosistema = () => {
    const el = document.getElementById('ecosistema-visual');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // 4. Render inicial de tarjetas y tabla comparativa
  renderPricingCardsAndComparison();
});

// =========================================================================
// CAMBIO DE PRODUCTO (CONSTRUCCIÓN / ARQUITECTURA / COMBO)
// =========================================================================
export function selectPricingProduct(product) {
  currentPricingProduct = product;
  const tabConst = document.getElementById('tab-prod-const');
  const tabArq = document.getElementById('tab-prod-arq');
  const tabCombo = document.getElementById('tab-prod-combo');

  [tabConst, tabArq, tabCombo].forEach(t => {
    if (t) t.className = 'flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer';
  });

  if (product === 'const') {
    tabConst.className = 'flex-1 py-2 px-4 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 shadow transition flex items-center justify-center gap-1.5 cursor-pointer';
  } else if (product === 'arq') {
    tabArq.className = 'flex-1 py-2 px-4 rounded-xl text-xs font-bold bg-blue-600 text-white shadow transition flex items-center justify-center gap-1.5 cursor-pointer';
  } else {
    tabCombo.className = 'flex-1 py-2 px-4 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 shadow transition flex items-center justify-center gap-1.5 cursor-pointer';
  }

  renderPricingCardsAndComparison();
}

// =========================================================================
// CAMBIO DE CICLO (MENSUAL / ANUAL)
// =========================================================================
export function setBillingCycle(cycle) {
  currentBillingCycle = cycle;
  const btnMonthly = document.getElementById('btn-cycle-monthly');
  const btnAnnual = document.getElementById('btn-cycle-annual');

  if (cycle === 'monthly') {
    btnMonthly.className = 'px-5 py-2 rounded-lg text-xs font-bold bg-white text-slate-950 shadow transition cursor-pointer';
    btnAnnual.className = 'px-5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer';
  } else {
    btnAnnual.className = 'px-5 py-2 rounded-lg text-xs font-bold bg-white text-slate-950 shadow transition flex items-center gap-1.5 cursor-pointer';
    btnMonthly.className = 'px-5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer';
  }

  renderPricingCardsAndComparison();
}

// =========================================================================
// RENDER DINÁMICO DE TARJETAS DE PRECIOS
// =========================================================================
function renderPricingCardsAndComparison() {
  const container = document.getElementById('pricing-cards-container');
  if (!container) return;

  const isAnnual = currentBillingCycle === 'annual';
  let tiersData = CONST_TIERS;
  let accentColor = 'amber';
  let productLabel = 'Cubikar Construcción';

  if (currentPricingProduct === 'arq') {
    tiersData = ARQ_TIERS;
    accentColor = 'blue';
    productLabel = 'Cubikar Arquitectura';
  } else if (currentPricingProduct === 'combo') {
    tiersData = COMBO_TIERS;
    accentColor = 'emerald';
    productLabel = 'Suite Cubikar (Combo Completo)';
  }

  // 1. Render de las 3 Tarjetas (Free, Plus, Pro)
  const tiers = [tiersData.free, tiersData.plus, tiersData.pro];
  container.innerHTML = tiers.map(plan => {
    const isFree = plan.id === 'free';
    const isPlus = plan.id === 'plus';
    const isPro = plan.id === 'pro';

    const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
    const origPrice = isAnnual ? plan.originalAnnualPrice : plan.originalMonthlyPrice;
    const hasDiscount = Boolean(origPrice && origPrice > price);
    const subtext = isAnnual ? plan.subtextAnnual : plan.subtextMonthly;

    let cardBorder = 'border-slate-800 bg-slate-900/60';
    let iconBoxCls = 'bg-slate-800 text-slate-400';
    let iconName = 'fa-solid fa-seedling';
    let btnCls = 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700';
    let btnText = `<span>Comenzar con ${plan.name}</span>`;
    let checkIconCls = 'text-slate-500';

    if (isPlus) {
      cardBorder = 'border-2 border-blue-500/80 shadow-2xl glow-blue bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 transform lg:-translate-y-2';
      iconBoxCls = 'bg-blue-500/20 text-blue-400 border border-blue-400/30';
      iconName = 'fa-solid fa-bolt';
      btnCls = CUBIKAR_SUB_TEST_MODE
        ? 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black shadow-lg shadow-cyan-500/25 transform hover:-translate-y-0.5'
        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transform hover:-translate-y-0.5';
      btnText = CUBIKAR_SUB_TEST_MODE
        ? `<i class="fa-solid fa-flask text-xs"></i><span>Probar Plan Plus Gratis (Beta)</span>`
        : `<i class="fa-solid fa-bolt text-[11px]"></i><span>Elegir Plan Plus</span>`;
      checkIconCls = 'text-blue-400';
    } else if (isPro) {
      cardBorder = 'border border-amber-500/40 hover:border-amber-400 transition bg-slate-900/80 shadow-xl';
      iconBoxCls = 'bg-amber-500/20 text-amber-400 border border-amber-400/30';
      iconName = 'fa-solid fa-crown';
      btnCls = CUBIKAR_SUB_TEST_MODE
        ? 'bg-slate-800 hover:bg-slate-700/80 text-slate-400 border border-slate-700 cursor-pointer'
        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md transform hover:-translate-y-0.5';
      btnText = CUBIKAR_SUB_TEST_MODE
        ? `<i class="fa-solid fa-lock text-xs text-amber-400/80"></i><span>Próximamente tras fase Beta</span>`
        : `<i class="fa-solid fa-crown text-[11px]"></i><span>Elegir Plan Pro</span>`;
      checkIconCls = 'text-amber-400';
    }

    const plusBadgeText = CUBIKAR_SUB_TEST_MODE ? 'GRATIS EN FASE DE PRUEBA' : plan.badge;
    const cardBadgeText = (CUBIKAR_SUB_TEST_MODE && isPro) ? 'EN EVALUACIÓN' : plan.badge;

    return `
      <div class="rounded-3xl glass-card p-6 sm:p-7 flex flex-col justify-between ${cardBorder} relative">
        ${isPlus ? `
          <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 ${CUBIKAR_SUB_TEST_MODE ? 'bg-amber-500 text-slate-950 font-black' : 'bg-blue-600 text-white font-extrabold'} text-[10px] uppercase px-3.5 py-1 rounded-full shadow tracking-wider flex items-center gap-1.5">
            <i class="${CUBIKAR_SUB_TEST_MODE ? 'fa-solid fa-flask' : 'fa-solid fa-fire'} text-[10px]"></i>
            <span>${plusBadgeText}</span>
          </div>
        ` : ''}

        <div>
          <!-- Header Tarjeta -->
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 ${iconBoxCls}">
                <i class="${iconName}"></i>
              </div>
              <div>
                <h4 class="font-extrabold text-base leading-tight text-white">${plan.name}</h4>
                <span class="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPlus ? (CUBIKAR_SUB_TEST_MODE ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'bg-blue-500/20 text-blue-300 border border-blue-400/40') :
                  (isPro ? (CUBIKAR_SUB_TEST_MODE ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-amber-500/20 text-amber-300 border border-amber-400/40') : 'bg-slate-800 text-slate-300 border border-slate-700')
                }">
                  ${cardBadgeText}
                </span>
              </div>
            </div>
            ${hasDiscount ? `
              <span class="text-[10px] font-black px-2 py-0.5 rounded-md ${
                isPro ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              } flex items-center gap-1 shadow-2xs shrink-0">
                <i class="fa-solid fa-fire text-[9px]"></i> ${plan.discountBadge}
              </span>
            ` : ''}
          </div>

          <!-- Tagline -->
          <p class="text-xs leading-relaxed mb-4 text-slate-400">
            ${plan.tagline}
          </p>

          <!-- Bloque de Precio -->
          <div class="p-4 rounded-xl mb-5 bg-slate-950/80 border ${isPlus ? 'border-blue-500/30' : (isPro ? 'border-amber-500/30' : 'border-slate-800')}">
            ${(CUBIKAR_SUB_TEST_MODE && isPlus) ? `
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-[10px] font-black px-2 py-0.5 rounded-sm bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  Cubikar Sub Test &bull; 100% Bonificado
                </span>
              </div>
              <div class="flex items-baseline gap-1">
                <span class="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-cyan-400">$0</span>
                <span class="text-xs font-bold text-slate-300">MXN / mes de prueba</span>
              </div>
              <p class="text-[10px] mt-1 font-medium text-slate-400">
                Acceso completo sin tarjeta bancaria ni cobros durante la evaluación
              </p>
            ` : ((CUBIKAR_SUB_TEST_MODE && isPro) ? `
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-[10px] font-black px-2 py-0.5 rounded-sm bg-slate-800 text-slate-400 border border-slate-700">
                  En Evaluación
                </span>
              </div>
              <div class="flex items-baseline gap-1">
                <span class="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-500">$0</span>
                <span class="text-xs font-bold text-slate-500">MXN (No disponible aún)</span>
              </div>
              <p class="text-[10px] mt-1 font-medium text-slate-500">
                Habilitado una vez concluida la fase de prueba
              </p>
            ` : `
              ${hasDiscount ? `
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="text-xs font-semibold line-through text-slate-500">
                    $${origPrice.toLocaleString('es-MX')} MXN
                  </span>
                  <span class="text-[10px] font-black px-1.5 py-0.5 rounded-sm bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Ahorras $${(origPrice - price).toLocaleString('es-MX')}${plan.periodLabel}
                  </span>
                </div>
              ` : ''}
              <div class="flex items-baseline gap-1">
                <span class="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight ${
                  isPro ? 'text-amber-400' : (isPlus ? 'text-blue-400' : 'text-white')
                }">
                  $${price.toLocaleString('es-MX')}
                </span>
                <span class="text-xs font-bold text-slate-400">
                  ${isFree ? 'MXN Siempre gratis' : `MXN ${plan.periodLabel}`}
                </span>
              </div>
              ${hasDiscount ? `
                <div class="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-400">
                  <i class="fa-solid fa-bolt text-[9px]"></i>
                  <span>Precio especial de lanzamiento</span>
                </div>
              ` : ''}
              <p class="text-[10px] mt-1 font-medium text-slate-400">
                ${subtext}
              </p>
            `)}
          </div>

          <!-- Lista de Características -->
          <div class="space-y-2 mb-6">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Incluye:</span>
            <ul class="space-y-2 text-xs text-slate-200">
              ${plan.features.map(f => `
                <li class="flex items-start gap-2">
                  <i class="fa-solid fa-check ${checkIconCls} mt-0.5 text-[11px] shrink-0"></i>
                  <span>${f}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>

        <!-- Botón CTA -->
        <div class="pt-4 border-t border-slate-800">
          <button onclick="handleTierSelection('${plan.id}')" class="w-full py-3.5 px-4 rounded-xl text-xs font-bold ${btnCls} transition flex items-center justify-center gap-1.5 cursor-pointer">
            ${btnText}
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 2. Render de la Tabla Comparativa
  renderDynamicComparisonTable(productLabel, accentColor);
}

// =========================================================================
// RENDER DINÁMICO DEL CUADRO COMPARATIVO
// =========================================================================
function renderDynamicComparisonTable(productLabel, accentColor) {
  const container = document.getElementById('comparison-table-wrapper');
  if (!container) return;

  const isAnnual = currentBillingCycle === 'annual';
  let rows = [];

  if (currentPricingProduct === 'const') {
    // Filas oficiales de ADM_CONST
    rows = [
      ['Proyectos Activos', '2 proyectos', '15 proyectos', '50 proyectos'],
      ['Conceptos por Proyecto', '100 líneas', '1,500 líneas', '3,500 líneas (licitaciones)'],
      ['Usuarios Colaboradores', '1 a 3 usuarios', '10 usuarios incluidos', '30 usuarios con roles granulares'],
      ['Generación APU con IA (Motor + Flash)', '10 / mes', '1,500 / mes', '3,500 / mes'],
      ['Precios Web en Vivo (Google Search)', '0 (o API propia)', '70 consultas / mes', '200 consultas / mes'],
      ['Impresión en Todas las Pestañas', 'Con logo y nombre de la App', 'Marca propia / Sin marca de App', 'Marca blanca corporativa'],
      ['Ruta Crítica, Curva S y Financiero', 'Básico', 'Completo con días inhábiles', 'Avanzado con suspensiones'],
      ['Bitácora Legal y Compras ERP', 'Básico', 'Completo (firmas y PDF)', 'Avanzado con libro foliado legal'],
      ['Almacenamiento en Nube', '200 MB', '2 GB (con compresión)', '5 GB de alta velocidad'],
      ['Catálogos Maestros Importados', '6 MB', '50 MB personalizados', '200 MB (Opus, Neodata, Excel)']
    ];
  } else if (currentPricingProduct === 'arq') {
    // Filas oficiales de ADM_ARQ
    rows = [
      ['Proyectos Ejecutivos Activos', '2 proyectos ejecutivos', '15 proyectos ejecutivos', '30 proyectos ejecutivos'],
      ['Conceptos Entregables por Obra', '15 entregables', '160 entregables', '200 entregables'],
      ['Colaboradores de Despacho', '2 colaboradores', '5 colaboradores (roles)', '20 colaboradores multidisciplinarios'],
      ['Almacenamiento en Servidor', '50 MB (con compresor)', '1,000 MB (1 GB)', '2,500 MB (2.5 GB)'],
      ['Seguimiento de Revisiones de Planos', 'Básico', 'Pendiente, En Revisión, Aprobado', 'Con firmas y peritajes de DRO'],
      ['Especialistas, Ingenierías y DRO', 'No incluido', 'Control de Contratos y Pagos', 'Gestión Integral Multi-Etapa'],
      ['Flujo de Caja (Cash Flow)', 'No incluido', 'Resumen Ejecutivo de Flujo', 'Flujo Completo (Cobrado vs Pagado)'],
      ['Calendario Gantt & Ruta Crítica (CPM)', 'Diagrama básico', 'Con Festivos oficiales de México y Curva S', 'Ejecutivo con suspensiones'],
      ['Cobranza de Honorarios', 'Básico', 'Amortización 100% e IVA', 'Multi-Etapa con retenciones fiscales'],
      ['Personalización e Impresión', 'Carátula básica', 'Logotipo y Membrete oficial del despacho', 'Personalización corporativa total']
    ];
  } else {
    // Filas de la Suite Combo
    rows = [
      ['Proyectos Totales Activos', '2 Arq + 2 Const (4 totales)', '15 Arq + 15 Const (30 totales)', '30 Arq + 50 Const (80 totales)'],
      ['Líneas / Entregables por Proyecto', '15 Arq / 100 Const', '160 Arq / 1,500 Const', '200 Arq / 3,500 Const'],
      ['Usuarios Compartidos en Suite', 'Hasta 3 usuarios', 'Hasta 10 usuarios compartidos', 'Hasta 30 usuarios corporativos'],
      ['Almacenamiento Total en Nube', '250 MB combinados', '3 GB en servidor', '7.5 GB de alta velocidad'],
      ['SSO (Un solo login)', 'Acceso a arq y const', 'Acceso total sin reconexión', 'Acceso total con roles unificados'],
      ['Matrices APU + Honorarios Cost-Plus', 'Esenciales', 'Completos con catálogos oficiales', 'Completos + Catálogos maestros'],
      ['Bitácora Legal + Contratos de Ingenierías', 'Básico', 'Completo (firmas digitales)', 'Libro legal + peritajes DRO'],
      ['Doble Ruta Crítica y Curva S', 'Básico', 'Planeación ejecutiva y obra', 'Ejecutivo avanzado'],
      ['Flujo de Caja y Dashboard ERP', 'Básico', 'Cobranza y compras en obra', 'Flujo integral de constructora y despacho'],
      ['Respaldo Jerárquico en ZIP', 'Descarga básica', 'Descarga completa en 1 clic', 'Descarga completa con histórico']
    ];
  }

  const thColor = accentColor === 'blue' ? 'text-blue-400' : (accentColor === 'amber' ? 'text-amber-400' : 'text-emerald-400');

  container.innerHTML = `
    <div class="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2.5">
        <i class="fa-solid fa-table-list ${thColor} text-base"></i>
        <h4 class="font-extrabold text-sm sm:text-base text-white">
          Cuadro Comparativo Oficial &bull; ${productLabel}
        </h4>
      </div>
      <span class="text-xs font-semibold text-slate-400">
        ${currentPricingProduct === 'arq' ? 
          (isAnnual ? 'Gratuita ($0) • Plus ($159/mes) • Pro ($399/mes)' : 'Gratuita ($0) • Plus ($199/mes) • Pro ($499/mes)') :
          (currentPricingProduct === 'const' ?
            (isAnnual ? 'Gratuita ($0) • Plus ($280/mes) • Pro ($760/mes)' : 'Gratuita ($0) • Plus ($350/mes) • Pro ($950/mes)') :
            (isAnnual ? 'Gratuita ($0) • Plus Combo ($359/mes) • Pro Combo ($950/mes)' : 'Gratuita ($0) • Plus Combo ($449/mes) • Pro Combo ($1,190/mes)'))
        }
      </span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="border-b border-slate-800 bg-slate-950/60 text-slate-300">
            <th class="py-3 px-5 font-bold">Métrica / Función</th>
            <th class="py-3 px-5 font-bold text-center text-slate-400">Gratuita ($0)</th>
            <th class="py-3 px-5 font-bold text-center text-blue-400">Plus</th>
            <th class="py-3 px-5 font-bold text-center text-amber-400">Pro</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800 text-slate-300">
          ${rows.map(r => `
            <tr class="hover:bg-slate-800/40 transition">
              <td class="py-3 px-5 font-semibold text-white">${r[0]}</td>
              <td class="py-3 px-5 text-center text-slate-400">${r[1]}</td>
              <td class="py-3 px-5 text-center font-medium text-slate-200">${r[2]}</td>
              <td class="py-3 px-5 text-center font-medium text-slate-200">${r[3]}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// =========================================================================
// ACCIONES Y STRIPE CHECKOUT
// =========================================================================
export function handleTierSelection(planId) {
  redirectToStripeCheckout(currentPricingProduct, planId, currentBillingCycle);
}

export async function launchApp(appId) {
  if (appId === 'combo') {
    openAppChooserModal();
    return;
  }
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost
    ? (appId === 'arq' ? '/ADM_ARQ/index.html' : '/ADM_CONST/index.html')
    : (appId === 'arq' ? 'https://arq.cubikar.app/' : 'https://const.cubikar.app/');
  const ssoUrl = await buildSsoUrl(baseUrl, true);
  window.location.href = ssoUrl;
}

// =========================================================================
// DESCARGA DE RESPALDO (REQUERIMIENTO DEL USUARIO)
// =========================================================================
export async function handleDownloadMyBackup() {
  const state = getCurrentState();
  const userName = state?.profile?.nombre_completo || 
                   state?.user?.user_metadata?.full_name || 
                   state?.user?.user_metadata?.name || 
                   'Usuario_Cubikar';
  const userEmail = state?.user?.email || 'contacto@cubikar.app';
  const companyName = state?.company?.nombre || 
                      state?.user?.user_metadata?.empresa_nombre || 
                      'Despacho_y_Constructora';

  await downloadFullEcosystemBackup(userName, userEmail, companyName);
}

// =========================================================================
// CONTROL DE MODALES DE AUTENTICACIÓN Y MI CUENTA
// =========================================================================
export function openAuthModal(mode = 'login') {
  currentAuthMode = mode;
  resetModalAuthControls();
  hideAuthMessages();

  const modal = document.getElementById('modal-auth');
  const modalTitle = document.getElementById('auth-modal-title');
  const modalSubtitle = document.getElementById('auth-modal-subtitle');
  const nameContainer = document.getElementById('auth-name-container');
  const companyContainer = document.getElementById('auth-company-container');
  const nameInput = document.getElementById('auth-name');
  const companyInput = document.getElementById('auth-company');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-mode-btn');

  const testModeNotice = document.getElementById('auth-test-mode-notice');
  if (testModeNotice) {
    if (CUBIKAR_SUB_TEST_MODE) {
      testModeNotice.classList.remove('hidden');
    } else {
      testModeNotice.classList.add('hidden');
    }
  }

  if (mode === 'login') {
    if (modalTitle) modalTitle.textContent = 'Acceso al Ecosistema';
    if (modalSubtitle) modalSubtitle.textContent = 'Ingresa con tu cuenta unificada de Cubikar';
    if (nameContainer) nameContainer.classList.add('hidden');
    if (companyContainer) companyContainer.classList.add('hidden');
    if (nameInput) nameInput.required = false;
    if (companyInput) companyInput.required = false;
    if (submitBtn) submitBtn.textContent = 'Iniciar Sesión';
    if (toggleBtn) toggleBtn.innerHTML = '¿No tienes cuenta? <span class="font-bold text-blue-400">Regístrate aquí</span>';
  } else {
    if (modalTitle) modalTitle.textContent = 'Crear Cuenta en Cubikar';
    if (modalSubtitle) modalSubtitle.textContent = CUBIKAR_SUB_TEST_MODE ? 'Acceso de cortesía a Plan Plus durante evaluación' : 'Comienza a gestionar tus proyectos y obras';
    if (nameContainer) nameContainer.classList.remove('hidden');
    if (companyContainer) companyContainer.classList.remove('hidden');
    if (nameInput) nameInput.required = true;
    if (companyInput) companyInput.required = false;
    if (submitBtn) submitBtn.textContent = CUBIKAR_SUB_TEST_MODE ? 'Crear Cuenta (Plan Plus Beta Gratis)' : 'Crear Cuenta Gratis';
    if (toggleBtn) toggleBtn.innerHTML = '¿Ya tienes cuenta? <span class="font-bold text-blue-400">Inicia sesión aquí</span>';
  }

  modal?.classList.remove('hidden');
  setupModalGoogleButton().catch(() => {});
}

function resetModalAuthControls() {
  if (googleAuthWatchdog) {
    clearTimeout(googleAuthWatchdog);
    googleAuthWatchdog = null;
  }
  googleAuthInProgress = false;
  const gsiSlot = document.getElementById('google-signin-gsi-slot');
  if (gsiSlot) gsiSlot.classList.remove('pointer-events-none', 'opacity-60');
  const submitBtn = document.getElementById('auth-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
    submitBtn.textContent = currentAuthMode === 'login'
      ? 'Iniciar Sesión'
      : (CUBIKAR_SUB_TEST_MODE ? 'Crear Cuenta (Plan Plus Beta Gratis)' : 'Crear Cuenta Gratis');
  }
}

function completeAuthAndOpenChooser() {
  resetModalAuthControls();
  closeAuthModal();
  updateAuthUI(getCurrentState());
  let pendingProd = window.__cubikarPendingProductIntent || null;
  try {
    if (!pendingProd && typeof sessionStorage !== 'undefined') {
      pendingProd = sessionStorage.getItem('cubikar_pending_product_intent');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('cubikar_pending_product_intent');
    }
    window.__cubikarPendingProductIntent = null;
  } catch (_) {}
  if (pendingProd === 'const' || pendingProd === 'arq') {
    launchApp(pendingProd);
    return;
  }
  openAppChooserModal();
}

export function closeAuthModal() {
  resetModalAuthControls();
  document.getElementById('modal-auth')?.classList.add('hidden');
  hideAuthMessages();
}

export function toggleAuthMode() {
  if (currentAuthMode === 'login') {
    openAuthModal('register');
  } else {
    openAuthModal('login');
  }
}

async function setupModalGoogleButton(forceRefresh = false) {
  return mountGoogleSignInButton({
    slotId: 'google-signin-gsi-slot',
    fallbackId: 'google-signin-fallback-btn',
    forceRefresh,
    onStart: () => {
      hideAuthMessages();
      googleAuthInProgress = true;
      const gsiSlot = document.getElementById('google-signin-gsi-slot');
      if (gsiSlot) gsiSlot.classList.add('pointer-events-none', 'opacity-60');
      const submitBtn = document.getElementById('auth-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
      }
      showAuthSuccess('Verificando tu cuenta de Google...');
      if (googleAuthWatchdog) clearTimeout(googleAuthWatchdog);
      googleAuthWatchdog = setTimeout(() => {
        if (!googleAuthInProgress) return;
        resetModalAuthControls();
        showAuthError('La verificación con Google tardó demasiado. Intenta nuevamente o ingresa con tu correo.');
        setupModalGoogleButton(true).catch(() => {});
      }, 15000);
    },
    onSuccess: () => {
      completeAuthAndOpenChooser();
    },
    onError: (err) => {
      console.error('[Google Sign-In Error]:', err);
      resetModalAuthControls();
      showAuthError('No se pudo iniciar sesión con Google: ' + (err?.message || 'Error de autenticación'));
      setupModalGoogleButton(true).catch(() => {});
    }
  });
}

export async function handleGoogleSignIn() {
  hideAuthMessages();
  try {
    const submitBtn = document.getElementById('auth-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    }
    showAuthSuccess('Conectando con Google...');
    await loginWithGoogle();
  } catch (err) {
    console.error('[Google Sign-In Error]:', err);
    showAuthError(err?.message || 'No se pudo iniciar sesión con Google.');
    resetModalAuthControls();
  }
}

export async function handleAuthSubmit(e) {
  e.preventDefault();
  if (googleAuthInProgress) return;
  hideAuthMessages();

  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const nameInput = document.getElementById('auth-name');
  const companyInput = document.getElementById('auth-company');
  const submitBtn = document.getElementById('auth-submit-btn');

  const email = emailInput?.value?.trim() || '';
  const password = passwordInput?.value || '';
  const fullName = nameInput?.value?.trim() || '';
  const company = companyInput?.value?.trim() || '';

  if (!email || !password) {
    showAuthError('Por favor ingresa tu correo y contraseña.');
    return;
  }

  const originalBtnText = submitBtn ? submitBtn.innerHTML : (currentAuthMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> ${currentAuthMode === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...'}`;
  }

  try {
    if (currentAuthMode === 'login') {
      await loginWithEmail(email, password);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
      completeAuthAndOpenChooser();
    } else {
      const data = await registerWithEmail(email, password, fullName, company);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
      if (data?.session) {
        completeAuthAndOpenChooser();
      } else {
        showAuthSuccess('¡Cuenta registrada! Si tu proyecto requiere confirmación, por favor verifica tu correo electrónico para activar el acceso.');
      }
    }
  } catch (err) {
    console.error('[Portal Auth Error]:', err);
    let msg = err.message || 'Ocurrió un error al procesar tu solicitud.';
    if (msg.includes('Invalid login credentials')) {
      msg = 'El correo o la contraseña son incorrectos. Por favor verifícalos o regístrate si aún no tienes cuenta.';
    } else if (msg.includes('Email not confirmed')) {
      msg = 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada o spam para activar tu cuenta.';
    } else if (msg.includes('User already registered')) {
      msg = 'Ya existe una cuenta con este correo. Haz clic en "Inicia sesión aquí".';
    } else if (msg.includes('Password should be at least')) {
      msg = 'La contraseña debe contener al menos 6 caracteres.';
    } else if (msg.includes('rate limit')) {
      msg = 'Demasiados intentos. Por favor espera un momento antes de volver a intentar.';
    }
    showAuthError(msg);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
}

function showAuthError(msg) {
  const errEl = document.getElementById('auth-error-msg');
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
  const succEl = document.getElementById('auth-success-msg');
  if (succEl) succEl.classList.add('hidden');
}

function showAuthSuccess(msg) {
  const succEl = document.getElementById('auth-success-msg');
  if (succEl) {
    succEl.textContent = msg;
    succEl.classList.remove('hidden');
  }
  const errEl = document.getElementById('auth-error-msg');
  if (errEl) errEl.classList.add('hidden');
}

function hideAuthMessages() {
  document.getElementById('auth-error-msg')?.classList.add('hidden');
  document.getElementById('auth-success-msg')?.classList.add('hidden');
}

// =========================================================================
// ACTUALIZACIÓN DE INTERFAZ SEGÚN ESTADO DE AUTENTICACIÓN
// =========================================================================
export function updateAuthUI(state) {
  const navGuest = document.getElementById('nav-guest-actions');
  const navUser = document.getElementById('nav-user-actions');
  const appSwitcherMount = document.getElementById('cubikar-app-switcher-mount');

  if (state && state.user) {
    // Usuario autenticado
    if (navGuest) navGuest.classList.add('hidden');
    if (navUser) {
      navUser.classList.remove('hidden');
      navUser.classList.add('flex');
    }
    if (appSwitcherMount) {
      appSwitcherMount.classList.remove('hidden');
      appSwitcherMount.classList.add('flex');
    }

    const name = state.profile?.nombre_completo || 
                 state.user.user_metadata?.full_name || 
                 state.user.user_metadata?.name || 
                 state.user.email?.split('@')[0] || 
                 'Usuario';

    const company = state.company?.nombre || 
                    state.user.user_metadata?.empresa_nombre || 
                    'Ecosistema Cubikar';

    const initial = name.charAt(0).toUpperCase();

    // Actualizar badges en Navbar
    const avatarBadge = document.getElementById('user-avatar-badge');
    const nameBadge = document.getElementById('user-display-name');
    const companyBadge = document.getElementById('user-company-badge');

    if (avatarBadge) avatarBadge.textContent = initial;
    if (nameBadge) nameBadge.textContent = name;
    if (companyBadge) companyBadge.textContent = company;

    // Actualizar datos en Modal Mi Cuenta (Dashboard)
    const dashInitial = document.getElementById('dash-user-initial');
    const dashName = document.getElementById('dash-user-name');
    const dashEmail = document.getElementById('dash-user-email');
    const dashCompany = document.getElementById('dash-user-company');

    if (dashInitial) dashInitial.textContent = initial;
    if (dashName) dashName.textContent = name;
    if (dashEmail) dashEmail.textContent = state.user.email || '';
    if (dashCompany) dashCompany.textContent = company;

    // Control de visibilidad del Área de Administración para SuperAdmin
    const isAdmin = isUserAdmin(state.user.email);
    const dashAdminSec = document.getElementById('dash-admin-section');
    if (dashAdminSec) {
      if (isAdmin) dashAdminSec.classList.remove('hidden');
      else dashAdminSec.classList.add('hidden');
    }
    const chooserAdminSec = document.getElementById('app-chooser-admin-section');
    if (chooserAdminSec) {
      if (isAdmin) chooserAdminSec.classList.remove('hidden');
      else chooserAdminSec.classList.add('hidden');
    }
  } else {
    // Usuario invitado / no autenticado
    if (navGuest) navGuest.classList.remove('hidden');
    if (navUser) {
      navUser.classList.add('hidden');
      navUser.classList.remove('flex');
    }
    if (appSwitcherMount) {
      appSwitcherMount.classList.add('hidden');
      appSwitcherMount.classList.remove('flex');
    }
    const dashAdminSec = document.getElementById('dash-admin-section');
    if (dashAdminSec) dashAdminSec.classList.add('hidden');
    const chooserAdminSec = document.getElementById('app-chooser-admin-section');
    if (chooserAdminSec) chooserAdminSec.classList.add('hidden');
  }
}

// =========================================================================
// ACCIONES DE USUARIO Y MI CUENTA
// =========================================================================
export function openUserDashboard() {
  const state = getCurrentState();
  const email = (state?.user?.email || document.getElementById('dash-user-email')?.textContent || '').toLowerCase().trim();
  const isAdmin = isUserAdmin(email);
  const dashAdminSec = document.getElementById('dash-admin-section');
  if (dashAdminSec) {
    if (isAdmin) {
      dashAdminSec.classList.remove('hidden');
    } else {
      dashAdminSec.classList.add('hidden');
    }
  }
  document.getElementById('modal-dashboard')?.classList.remove('hidden');
}

export function closeUserDashboard() {
  document.getElementById('modal-dashboard')?.classList.add('hidden');
}

export function openAppChooserModal(userName) {
  const modal = document.getElementById('modal-app-chooser');
  const nameEl = document.getElementById('app-chooser-user-name');
  const state = getCurrentState();
  if (nameEl) {
    if (userName) {
      nameEl.textContent = userName;
    } else {
      const n = state?.profile?.nombre_completo || 
                state?.user?.user_metadata?.full_name || 
                state?.user?.user_metadata?.name || 
                state?.user?.email?.split('@')[0] || 
                'Usuario';
      nameEl.textContent = n;
    }
  }

  const isAdmin = isUserAdmin(state?.user?.email);
  const chooserAdminSec = document.getElementById('app-chooser-admin-section');
  if (chooserAdminSec) {
    if (isAdmin) chooserAdminSec.classList.remove('hidden');
    else chooserAdminSec.classList.add('hidden');
  }

  modal?.classList.remove('hidden');
}

export function closeAppChooserModal() {
  document.getElementById('modal-app-chooser')?.classList.add('hidden');
}

export async function handleLogout() {
  try {
    await logout();
  } catch (err) {
    console.warn('Error al cerrar sesión:', err);
  }
  closeUserDashboard();
  updateAuthUI(null);
}

export async function handleStripePortal() {
  return openCustomerPortal();
}

export function switchSliceTab(type) {
  const tabArq = document.getElementById('tab-slice-arq');
  const tabConst = document.getElementById('tab-slice-const');
  const panelArq = document.getElementById('slice-panel-arq');
  const panelConst = document.getElementById('slice-panel-const');
  const gridArq = document.getElementById('arq-capabilities-grid');
  const gridConst = document.getElementById('const-capabilities-grid');

  if (!tabArq || !tabConst || !panelArq || !panelConst) return;

  if (type === 'arq') {
    tabArq.className = 'px-7 py-3 rounded-xl font-extrabold text-xs transition-all duration-300 flex items-center gap-2.5 cursor-pointer bg-gradient-to-r from-cyan-400 to-blue-600 text-slate-950 shadow-[0_0_20px_rgba(0,242,254,0.35)]';
    tabConst.className = 'px-7 py-3 rounded-xl font-extrabold text-xs transition-all duration-300 flex items-center gap-2.5 cursor-pointer text-slate-400 hover:text-white hover:bg-white/5';
    panelArq.classList.remove('hidden');
    panelArq.classList.add('flex');
    panelConst.classList.remove('flex');
    panelConst.classList.add('hidden');
    if (gridArq) gridArq.classList.remove('hidden');
    if (gridConst) gridConst.classList.add('hidden');
  } else {
    tabConst.className = 'px-7 py-3 rounded-xl font-extrabold text-xs transition-all duration-300 flex items-center gap-2.5 cursor-pointer bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)]';
    tabArq.className = 'px-7 py-3 rounded-xl font-extrabold text-xs transition-all duration-300 flex items-center gap-2.5 cursor-pointer text-slate-400 hover:text-white hover:bg-white/5';
    panelConst.classList.remove('hidden');
    panelConst.classList.add('flex');
    panelArq.classList.remove('flex');
    panelArq.classList.add('hidden');
    if (gridConst) gridConst.classList.remove('hidden');
    if (gridArq) gridArq.classList.add('hidden');
  }
}
window.switchSliceTab = switchSliceTab;

let collabModeTimer = null;
let currentCollabMode = 'owned';

export function switchCollabMode(mode, manual = true) {
  currentCollabMode = mode;
  const select = document.getElementById('projectScopeModeSelect');
  const viewOwned = document.getElementById('collab-view-owned');
  const viewInvited = document.getElementById('collab-view-invited');
  const badge = document.getElementById('mode-status-badge');
  const title = document.getElementById('portal-collab-title');
  const count = document.getElementById('portal-collab-count');
  const createBtn = document.getElementById('portal-collab-create-btn');

  if (select && select.value !== mode) {
    select.value = mode;
  }

  if (mode === 'owned') {
    if (viewOwned) viewOwned.classList.remove('hidden');
    if (viewInvited) viewInvited.classList.add('hidden');
    if (title) title.textContent = 'Mis Proyectos de Obra';
    if (count) count.textContent = '2 Obras Activas';
    if (createBtn) createBtn.innerHTML = '<i class="fa-solid fa-plus mr-1"></i><span>Nuevo Proyecto</span>';
    if (badge) {
      badge.innerHTML = `
        <div class="flex items-center gap-2 bg-slate-950/80 border border-amber-500/40 px-3 py-1 rounded-xl text-xs w-full justify-between sm:justify-start">
          <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-crown text-amber-400 text-xs"></i>
            <span class="text-slate-300 text-xs">🏷️ Membresía activa: <strong class="text-white">Plan Pro</strong></span>
          </div>
          <span class="text-amber-300 font-mono text-[10px] bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 font-bold ml-auto sm:ml-2">(2/5 obras)</span>
        </div>
      `;
    }
  } else {
    if (viewInvited) viewInvited.classList.remove('hidden');
    if (viewOwned) viewOwned.classList.add('hidden');
    if (title) title.textContent = 'Proyectos de Arq. Carlos Mendoza';
    if (count) count.textContent = '1 Obra Asignada';
    if (createBtn) createBtn.innerHTML = '<i class="fa-solid fa-plus mr-1"></i><span>Crear en espacio de Carlos</span>';
    if (badge) {
      badge.innerHTML = `
        <div class="flex items-center gap-2 bg-emerald-950/70 border border-emerald-500/50 px-3 py-1 rounded-xl text-xs w-full justify-between sm:justify-start">
          <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-circle-check text-emerald-400 text-xs"></i>
            <span class="text-emerald-200 text-xs">🏷️ Membresía: <strong class="text-white">Plan Empresarial</strong> (1/15 obras)</span>
          </div>
          <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold text-[10px] ml-auto sm:ml-2">⭐ Editor (Puedes crear obras)</span>
        </div>
      `;
    }
  }

  if (manual && collabModeTimer) {
    clearInterval(collabModeTimer);
    collabModeTimer = null;
  }
}
window.switchCollabMode = switchCollabMode;

function initCollabAutoCycle() {
  if (collabModeTimer) clearInterval(collabModeTimer);
  collabModeTimer = setInterval(() => {
    const nextMode = currentCollabMode === 'owned' ? 'invited' : 'owned';
    switchCollabMode(nextMode, false);
  }, 6500);
}
initCollabAutoCycle();

/* =========================================================================
   LIGHTBOX SHOWCASE INTERACTIVO
   ========================================================================= */
export function openShowcaseLightbox(src, title) {
  const modal = document.getElementById('modal-showcase-lightbox');
  const img = document.getElementById('lightbox-img');
  const titleEl = document.getElementById('lightbox-title');
  if (modal && img) {
    img.src = src;
    if (titleEl && title) titleEl.innerHTML = title;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
}
window.openShowcaseLightbox = openShowcaseLightbox;

export function closeShowcaseLightbox() {
  const modal = document.getElementById('modal-showcase-lightbox');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
}
window.closeShowcaseLightbox = closeShowcaseLightbox;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeShowcaseLightbox();
  }
});



