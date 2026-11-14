// assets/js/main.js
// Controlador principal de interfaz para cubikar.com

import { getSupabase } from './supabaseClient.js';
import { initAuth, loginWithEmail, registerWithEmail, loginWithGoogle, logout, getCurrentState } from './auth.js';
import { startCheckout, openCustomerPortal } from './checkout.js';
import { downloadFullEcosystemBackup } from './exportBackup.js';

let currentBillingCycle = 'monthly'; // 'monthly' | 'annual'
let authMode = 'login'; // 'login' | 'register'
let pendingCheckoutProduct = null;

// =========================================================================
// INICIALIZACIÓN
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Auth de Supabase
  initAuth((state) => {
    updateAuthUI(state);
  });

  // Exponer funciones globales para los botones inline
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.toggleAuthMode = toggleAuthMode;
  window.handleGoogleSignIn = handleGoogleSignIn;
  window.handleAuthSubmit = handleAuthSubmit;
  window.openUserDashboard = openUserDashboard;
  window.closeUserDashboard = closeUserDashboard;
  window.handleLogout = handleLogout;
  window.setBillingCycle = setBillingCycle;
  window.handlePlanSelection = handlePlanSelection;
  window.triggerDemoBackupDownload = triggerDemoBackupDownload;
  window.handleDownloadMyBackup = handleDownloadMyBackup;
  window.handleStripePortal = handleStripePortal;
  window.launchApp = launchApp;
  window.scrollToEcosistema = () => {
    const el = document.getElementById('ecosistema');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };
});

// =========================================================================
// CICLO DE FACTURACIÓN (MENSUAL / ANUAL)
// =========================================================================
export function setBillingCycle(cycle) {
  currentBillingCycle = cycle;
  const btnMonthly = document.getElementById('btn-cycle-monthly');
  const btnAnnual = document.getElementById('btn-cycle-annual');

  if (cycle === 'monthly') {
    btnMonthly.className = 'px-5 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white shadow transition cursor-pointer';
    btnAnnual.className = 'px-5 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer';

    document.querySelector('.price-arq').textContent = '$350';
    document.querySelector('.price-const').textContent = '$350';
    document.querySelector('.price-combo').textContent = '$550';

    document.querySelectorAll('.cycle-text').forEach(el => el.textContent = 'MXN / mes');
    document.querySelectorAll('.billed-subtext').forEach((el, idx) => {
      if (idx === 1) {
        el.textContent = '¡Ahorras más del 20% al contratar ambas!';
      } else {
        el.textContent = 'Facturado mensualmente';
      }
    });
  } else {
    btnAnnual.className = 'px-5 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white shadow transition flex items-center gap-1.5 cursor-pointer';
    btnMonthly.className = 'px-5 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer';

    // Precios anuales equivalentes por mes o anual total
    document.querySelector('.price-arq').textContent = '$280';
    document.querySelector('.price-const').textContent = '$280';
    document.querySelector('.price-combo').textContent = '$440';

    document.querySelectorAll('.cycle-text').forEach(el => el.textContent = 'MXN / mes (facturado anual)');
    document.querySelectorAll('.billed-subtext').forEach((el, idx) => {
      if (idx === 0) el.textContent = '$3,360 MXN al año (ahorras $840)';
      if (idx === 1) el.textContent = '$5,280 MXN al año (ahorras $1,320)';
      if (idx === 2) el.textContent = '$3,360 MXN al año (ahorras $840)';
    });
  }
}

// =========================================================================
// SELECCIÓN DE PLANES Y STRIPE CHECKOUT
// =========================================================================
export function handlePlanSelection(productId) {
  const { user } = getCurrentState();
  if (!user) {
    pendingCheckoutProduct = productId;
    openAuthModal('register', productId);
  } else {
    startCheckout(productId, currentBillingCycle);
  }
}

// =========================================================================
// AUTH MODAL & FLOW
// =========================================================================
export function openAuthModal(mode = 'login', productId = null) {
  authMode = mode;
  pendingCheckoutProduct = productId;

  const modal = document.getElementById('modal-auth');
  const title = document.getElementById('auth-modal-title');
  const subtitle = document.getElementById('auth-modal-subtitle');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-mode-btn');
  const nameContainer = document.getElementById('auth-name-container');
  const companyContainer = document.getElementById('auth-company-container');

  if (mode === 'register') {
    title.textContent = productId ? 'Crea tu cuenta para continuar' : 'Crear Cuenta en Cubikar';
    subtitle.textContent = 'Un solo usuario para todas tus aplicaciones de arquitectura y obra';
    submitBtn.textContent = 'Registrarse y Continuar';
    toggleBtn.innerHTML = '¿Ya tienes cuenta? <span class="font-bold text-blue-400">Inicia sesión aquí</span>';
    nameContainer.classList.remove('hidden');
    companyContainer.classList.remove('hidden');
  } else {
    title.textContent = 'Acceso al Ecosistema';
    subtitle.textContent = 'Ingresa con tu cuenta unificada de Cubikar';
    submitBtn.textContent = 'Iniciar Sesión';
    toggleBtn.innerHTML = '¿No tienes cuenta? <span class="font-bold text-blue-400">Regístrate aquí</span>';
    nameContainer.classList.add('hidden');
    companyContainer.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

export function closeAuthModal() {
  document.getElementById('modal-auth').classList.add('hidden');
}

export function toggleAuthMode() {
  openAuthModal(authMode === 'login' ? 'register' : 'login', pendingCheckoutProduct);
}

export async function handleGoogleSignIn() {
  try {
    await loginWithGoogle();
  } catch (err) {
    alert('Error con Google: ' + err.message);
  }
}

export async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const fullName = document.getElementById('auth-name').value.trim();
  const company = document.getElementById('auth-company').value.trim();
  const submitBtn = document.getElementById('auth-submit-btn');

  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Procesando...';

  try {
    if (authMode === 'register') {
      await registerWithEmail(email, password, fullName, company);
      alert('¡Cuenta creada con éxito! Si tu proyecto requiere confirmación por correo, revisa tu bandeja.');
    } else {
      await loginWithEmail(email, password);
    }

    closeAuthModal();

    if (pendingCheckoutProduct) {
      const prod = pendingCheckoutProduct;
      pendingCheckoutProduct = null;
      startCheckout(prod, currentBillingCycle);
    }
  } catch (err) {
    alert('Error de autenticación: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// =========================================================================
// ACTUALIZACIÓN DE ESTADO EN UI
// =========================================================================
function updateAuthUI(state) {
  const guestActions = document.getElementById('nav-guest-actions');
  const userActions = document.getElementById('nav-user-actions');
  const userDisplayName = document.getElementById('user-display-name');
  const userCompanyBadge = document.getElementById('user-company-badge');
  const userAvatarBadge = document.getElementById('user-avatar-badge');

  if (state?.user) {
    guestActions.classList.add('hidden');
    userActions.classList.remove('hidden');
    userActions.classList.add('flex');

    const name = state.profile?.nombre_completo || state.user.user_metadata?.full_name || state.user.email.split('@')[0];
    const company = state.company?.nombre || state.user.user_metadata?.empresa_nombre || 'Mi Estudio';
    const initial = name.charAt(0).toUpperCase();

    userDisplayName.textContent = name;
    userCompanyBadge.textContent = company;
    userAvatarBadge.textContent = initial;

    // Actualizar datos del modal Dashboard
    document.getElementById('dash-user-name').textContent = name;
    document.getElementById('dash-user-email').textContent = state.user.email;
    document.getElementById('dash-user-company').textContent = company;
    document.getElementById('dash-user-initial').textContent = initial;
  } else {
    guestActions.classList.remove('hidden');
    userActions.classList.add('hidden');
    userActions.classList.remove('flex');
  }
}

// =========================================================================
// DASHBOARD DE USUARIO (MODAL "MI CUENTA")
// =========================================================================
export function openUserDashboard() {
  document.getElementById('modal-dashboard').classList.remove('hidden');
}

export function closeUserDashboard() {
  document.getElementById('modal-dashboard').classList.add('hidden');
}

export async function handleLogout() {
  if (confirm('¿Deseas cerrar tu sesión en Cubikar?')) {
    await logout();
    closeUserDashboard();
  }
}

export function handleStripePortal() {
  openCustomerPortal();
}

// =========================================================================
// LANZADOR DE APLICACIONES (ARQ / CONST)
// =========================================================================
export function launchApp(appId) {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    if (appId === 'arq') {
      // Redirige al directorio hermano en entorno local
      window.location.href = '../ADM_ARQ/index.html';
    } else {
      window.location.href = '../ADM_CONST/index.html';
    }
  } else {
    // En producción en Vercel
    if (appId === 'arq') {
      window.location.href = 'https://arq.cubikar.com';
    } else {
      window.location.href = 'https://const.cubikar.com';
    }
  }
}

// =========================================================================
// MOTOR DE DESCARGA DE RESPALDO (REQUERIMIENTO DEL USUARIO)
// =========================================================================
export async function triggerDemoBackupDownload() {
  const { user, profile, company } = getCurrentState();
  const userName = profile?.nombre_completo || user?.user_metadata?.full_name || 'Demo_Cubikar';
  const userEmail = user?.email || 'demo@cubikar.com';
  const companyName = company?.nombre || 'Estudio_Ejemplo';

  await downloadFullEcosystemBackup(userName, userEmail, companyName);
}

export async function handleDownloadMyBackup() {
  const { user, profile, company } = getCurrentState();
  if (!user) {
    alert('Inicia sesión para descargar tu respaldo personalizado.');
    return;
  }
  const userName = profile?.nombre_completo || user.user_metadata?.full_name || user.email.split('@')[0];
  const userEmail = user.email;
  const companyName = company?.nombre || 'Mi_Estudio';

  await downloadFullEcosystemBackup(userName, userEmail, companyName);
}
