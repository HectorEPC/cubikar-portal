// assets/js/auth.js
// Manejador de Autenticación, Registro y Estado de Sesión en el Portal Central Cubikar
// Totalmente sincronizado con Supabase Auth y los esquemas de ADM_CONST y ADM_ARQ

import { getSupabase } from './supabaseClient.js';
import {
  writeSharedSsoCookie,
  clearSharedSsoCookie,
  readSharedSsoCookie,
  readLocalSupabaseTokens,
  extractIncomingSsoFromHash,
  scrubSsoHashParams,
  getLastSignOutTimestamp,
  buildSsoTargetUrl
} from './ssoHelper.js?v=20261114_04';

export const GOOGLE_CLIENT_ID = '1097638023851-36b44hlrj7fgslfcmqlvf77dk89h7eus.apps.googleusercontent.com';

let currentUser = null;
let currentProfile = null;
let currentCompany = null;
let activeGoogleNoncePair = null;
let googleSignInBusy = false;
let inFlightProfilePromise = null;
let inFlightProfileUserId = null;
let loadedProfileUserId = null;
let lastProfileLoadedAt = 0;

function resetProfileCache() {
  inFlightProfilePromise = null;
  inFlightProfileUserId = null;
  loadedProfileUserId = null;
  lastProfileLoadedAt = 0;
}

function scheduleBackgroundProfileSync(userId, onStateChange = null) {
  if (!userId) return;
  setTimeout(async () => {
    const res = await loadUserProfileAndCompany(userId);
    if (res && currentUser?.id === userId) {
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      if (onStateChange) {
        onStateChange({ user: currentUser, profile: currentProfile, company: currentCompany, event: 'PROFILE_SYNCED' });
      }
    }
  }, 0);
}

async function tryHydrateSsoSession(sb) {
  if (!sb) return null;
  const hashTokens = extractIncomingSsoFromHash();
  scrubSsoHashParams();
  let tokens = hashTokens;
  if (!tokens) {
    const cookieTokens = readSharedSsoCookie();
    const lastSignOutTs = getLastSignOutTimestamp();
    if (cookieTokens?.refreshToken && !(lastSignOutTs > 0 && cookieTokens.ts > 0 && cookieTokens.ts <= lastSignOutTs)) {
      tokens = cookieTokens;
    }
  }
  if (!tokens?.refreshToken) return null;
  try {
    const { data, error } = tokens.accessToken
      ? await sb.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
      : await sb.auth.refreshSession({ refresh_token: tokens.refreshToken });
    if (error || !data?.session?.user) return null;
    return data.session;
  } catch (err) {
    console.warn('[Portal Auth] No se pudo hidratar sesión SSO entrante:', err?.message || err);
    return null;
  }
}

/**
 * Inicializar observador de autenticación
 */
export async function initAuth(onStateChange) {
  const sb = getSupabase();
  if (!sb) {
    console.warn('[Portal Auth] Supabase aún no inicializado');
    return;
  }

  // Listener síncrono: nunca ejecutar queries Supabase dentro de onAuthStateChange
  // para evitar contención/bloqueo del lock interno (navigator.locks) de GoTrue.
  sb.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      currentUser = session.user;
      writeSharedSsoCookie(session);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      const userId = currentUser.id;
      setTimeout(() => {
        if (onStateChange) {
          onStateChange({ user: currentUser, profile: currentProfile, company: currentCompany, event });
        }
        scheduleBackgroundProfileSync(userId, onStateChange);
      }, 0);
    } else {
      if (event === 'SIGNED_OUT') {
        clearSharedSsoCookie({ markSignOut: true });
      }
      currentUser = null;
      currentProfile = null;
      currentCompany = null;
      resetProfileCache();
      clearLocalUserStorage();
      setTimeout(() => {
        if (onStateChange) onStateChange(null);
      }, 0);
    }
  });

  try {
    // 1. Verificar sesión existente o hidratar SSO entrante desde subdominios Cubikar
    let { data: { session }, error } = await sb.auth.getSession();
    if (!session?.user || error) {
      const ssoSession = await tryHydrateSsoSession(sb);
      if (ssoSession?.user) {
        session = ssoSession;
        error = null;
      }
    }
    if (session?.user && !error) {
      currentUser = session.user;
      writeSharedSsoCookie(session);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      if (onStateChange) onStateChange({ user: currentUser, profile: currentProfile, company: currentCompany, event: 'INIT' });
      scheduleBackgroundProfileSync(currentUser.id, onStateChange);
    } else {
      if (onStateChange) onStateChange(null);
    }
  } catch (err) {
    console.warn('[Portal Auth] Error al inicializar sesión:', err);
    if (onStateChange) onStateChange(null);
  }
}

/**
 * Cargar perfil de usuario y datos de empresa desde Supabase (con deduplicación)
 */
export async function loadUserProfileAndCompany(userId, forceRefresh = false) {
  const sb = getSupabase();
  if (!sb || !userId) return null;

  if (!forceRefresh && loadedProfileUserId === userId && Date.now() - lastProfileLoadedAt < 5000 && currentProfile) {
    return { profile: currentProfile, company: currentCompany };
  }
  if (inFlightProfilePromise && inFlightProfileUserId === userId) {
    return inFlightProfilePromise;
  }

  inFlightProfileUserId = userId;
  inFlightProfilePromise = (async () => {
    try {
      const { data: perfil, error } = await sb
        .from('perfiles')
        .select(`
          id,
          nombre_completo,
          email,
          avatar_url,
          rol,
          empresa_id,
          empresas (
            id,
            nombre,
            plan,
            estado_suscripcion,
            logo_url
          )
        `)
        .eq('id', userId)
        .maybeSingle();

      if (!error && perfil) {
        currentProfile = perfil;
        currentCompany = perfil.empresas || null;
        loadedProfileUserId = userId;
        lastProfileLoadedAt = Date.now();
        return { profile: currentProfile, company: currentCompany };
      }
    } catch (err) {
      console.warn('[Portal Auth] No se pudo cargar perfil extendido:', err);
    } finally {
      if (inFlightProfileUserId === userId) {
        inFlightProfilePromise = null;
        inFlightProfileUserId = null;
      }
    }
    return null;
  })();

  return inFlightProfilePromise;
}

/**
 * Iniciar sesión con email y contraseña
 */
export async function loginWithEmail(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Servidor de autenticación no disponible. Por favor recarga la página.');

  const cleanEmail = (email || '').trim().toLowerCase();
  const { data, error } = await sb.auth.signInWithPassword({
    email: cleanEmail,
    password: password
  });

  if (error) throw error;

  if (data?.user) {
    currentUser = data.user;
    if (data.session) writeSharedSsoCookie(data.session);
    syncLocalUserStorage(currentUser, currentProfile, currentCompany);
    scheduleBackgroundProfileSync(data.user.id);
  }
  return data;
}

/**
 * Registrar nuevo usuario con email y contraseña
 */
export async function registerWithEmail(email, password, fullName, companyName) {
  const sb = getSupabase();
  if (!sb) throw new Error('Servidor de autenticación no disponible. Por favor recarga la página.');

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (fullName || '').trim() || cleanEmail.split('@')[0];
  const cleanCompany = (companyName || '').trim() || cleanName;

  const { data, error } = await sb.auth.signUp({
    email: cleanEmail,
    password: password,
    options: {
      data: {
        full_name: cleanName,
        empresa_nombre: cleanCompany
      }
    }
  });

  if (error) throw error;

  if (data?.user && data?.session) {
    currentUser = data.user;
    writeSharedSsoCookie(data.session);
    syncLocalUserStorage(currentUser, currentProfile, currentCompany);
    scheduleBackgroundProfileSync(data.user.id);
  }
  return data;
}

/**
 * Iniciar sesión con Google (OAuth)
 */
export async function loginWithGoogle() {
  const sb = getSupabase();
  if (!sb) throw new Error('Servidor de autenticación no disponible. Por favor recarga la página.');

  let cleanRedirect = window.location.origin;
  if (window.location.protocol === 'file:') {
    cleanRedirect = 'http://localhost:3000/index.html';
  }

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: cleanRedirect,
      queryParams: {
        prompt: 'select_account'
      }
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Carga bajo demanda el SDK oficial de Google Identity Services (accounts.google.com/gsi/client).
 */
function ensureGoogleGsiScript(timeoutMs = 7000) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Sign-In solo está disponible en el navegador.'));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }

  return new Promise((resolve, reject) => {
    let script = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const startedAt = Date.now();
    const poll = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(poll);
        resolve(window.google.accounts.id);
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(poll);
        reject(new Error('No se pudo cargar Google Sign-In. Si usas bloqueador de anuncios o privacidad estricta, permítelo o usa tu correo.'));
      }
    }, 60);

    script.addEventListener('error', () => {
      clearInterval(poll);
      reject(new Error('El navegador o un bloqueador impidió cargar Google Sign-In.'));
    }, { once: true });
  });
}

/**
 * Genera par nonce en texto plano (para Supabase) y hash SHA-256 hex (para Google GIS).
 */
async function createGoogleNoncePair() {
  if (!window.crypto?.getRandomValues || !window.crypto?.subtle) {
    throw new Error('Tu navegador requiere HTTPS o localhost para autenticar con Google.');
  }
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const rawNonce = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const encoded = new TextEncoder().encode(rawNonce);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
  const hashedNonce = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
  return { rawNonce, hashedNonce };
}

/**
 * Inicia sesión en Supabase con el ID Token de Google (sin pasar por /auth/v1/callback).
 */
export async function loginWithGoogleIdToken(idToken, rawNonce) {
  const sb = getSupabase();
  if (!sb) throw new Error('Servidor de autenticación no disponible. Por favor recarga la página.');
  if (!idToken) throw new Error('Google no devolvió un token de identidad válido.');

  const payload = {
    provider: 'google',
    token: idToken
  };
  if (rawNonce) {
    payload.nonce = rawNonce;
  }

  const { data, error } = await sb.auth.signInWithIdToken(payload);
  if (error) throw error;

  if (data?.user) {
    currentUser = data.user;
    if (data.session) writeSharedSsoCookie(data.session);
    syncLocalUserStorage(currentUser, currentProfile, currentCompany);
    scheduleBackgroundProfileSync(data.user.id);
  }
  return data;
}

/**
 * Monta el botón oficial de Google GIS y procesa la credencial vía signInWithIdToken.
 */
export async function mountGoogleSignInButton({
  slotId = 'google-signin-gsi-slot',
  fallbackId = 'google-signin-fallback-btn',
  onStart = null,
  onSuccess = null,
  onError = null,
  forceRefresh = false
} = {}) {
  const slotEl = document.getElementById(slotId);
  if (!slotEl) return false;

  if (!forceRefresh && activeGoogleNoncePair && slotEl.dataset.gsiRendered === '1') {
    return true;
  }

  const gsi = await ensureGoogleGsiScript();
  const noncePair = await createGoogleNoncePair();
  activeGoogleNoncePair = noncePair;

  gsi.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: noncePair.hashedNonce,
    ux_mode: 'popup',
    callback: async (response) => {
      if (googleSignInBusy) return;
      if (!response?.credential) {
        if (onError) onError(new Error('No se recibió una credencial válida de Google. Inténtalo de nuevo.'));
        return;
      }
      googleSignInBusy = true;
      const usedRawNonce = activeGoogleNoncePair?.rawNonce;
      activeGoogleNoncePair = null;
      slotEl.dataset.gsiRendered = '0';

      try {
        if (onStart) onStart();
        const data = await loginWithGoogleIdToken(response.credential, usedRawNonce);
        if (onSuccess) await onSuccess(data);
      } catch (err) {
        if (onError) onError(err);
      } finally {
        googleSignInBusy = false;
      }
    }
  });

  const parentWidth = slotEl.parentElement?.clientWidth || slotEl.clientWidth || 350;
  const buttonWidth = Math.max(220, Math.min(380, Math.floor(parentWidth)));

  slotEl.innerHTML = '';
  gsi.renderButton(slotEl, {
    type: 'standard',
    theme: 'outline',
    size: 'medium',
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    locale: 'es',
    width: buttonWidth
  });

  slotEl.dataset.gsiRendered = '1';
  slotEl.classList.remove('hidden');
  document.getElementById(fallbackId)?.classList.add('hidden');
  return true;
}

/**
 * Cerrar sesión
 */
export async function logout() {
  activeGoogleNoncePair = null;
  googleSignInBusy = false;
  resetProfileCache();
  clearSharedSsoCookie({ markSignOut: true });
  const slotEl = document.getElementById('google-signin-gsi-slot');
  if (slotEl) slotEl.dataset.gsiRendered = '0';
  try {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch (_) {}
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.auth.signOut({ scope: 'global' });
    } catch (_) {}
  }
  currentUser = null;
  currentProfile = null;
  currentCompany = null;
  clearLocalUserStorage();
}

/**
 * Construir URL de destino con tokens SSO para navegar a subdominios sin segundo login
 */
export async function buildSsoUrl(targetUrl, remember = true) {
  const cleanTarget = String(targetUrl || '').split('#')[0];
  try {
    const sb = getSupabase();
    let session = null;
    if (sb) {
      const { data } = await sb.auth.getSession();
      session = data?.session || null;
    }
    const tokens = session?.access_token && session?.refresh_token
      ? session
      : (readLocalSupabaseTokens() || readSharedSsoCookie());
    if (tokens) {
      if (session) writeSharedSsoCookie(session);
      return buildSsoTargetUrl(cleanTarget, tokens, remember);
    }
  } catch (_) {}
  return cleanTarget;
}

/**
 * Sincronizar usuario activo en LocalStorage para compatibilidad inmediata con ADM_CONST y ADM_ARQ
 */
export function syncLocalUserStorage(user, profile, company) {
  if (typeof localStorage === 'undefined' || !user) return;
  try {
    const name = profile?.nombre_completo || 
                 user.user_metadata?.full_name || 
                 user.user_metadata?.name || 
                 user.email?.split('@')[0] || 
                 'Usuario';

    const companyName = company?.nombre || 
                        user.user_metadata?.empresa_nombre || 
                        'Mi Empresa';

    const plan = company?.plan || 
                 user.user_metadata?.subscription?.planId || 
                 'free';

    const cleanEmail = (user.email || '').toLowerCase().trim();

    const userData = {
      id: user.id,
      email: cleanEmail,
      name: name,
      company: companyName,
      avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      plan: plan,
      role: profile?.rol || 'owner'
    };

    localStorage.setItem('control_obra_active_user_v1', JSON.stringify(userData));
    localStorage.setItem('control_obra_active_user_v1_last', JSON.stringify(userData));
  } catch (err) {
    console.warn('[Portal Auth] Error al sincronizar almacenamiento local:', err);
  }
}

/**
 * Limpiar usuario de LocalStorage
 */
export function clearLocalUserStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem('control_obra_active_user_v1');
    localStorage.removeItem('control_obra_active_user_v1_last');
  } catch (err) {}
}

/**
 * Obtener estado de usuario actual
 */
export function getCurrentState() {
  return {
    user: currentUser,
    profile: currentProfile,
    company: currentCompany
  };
}
