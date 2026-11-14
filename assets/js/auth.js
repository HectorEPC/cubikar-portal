// assets/js/auth.js
// Manejador de Autenticación, Registro y Estado de Sesión en el Portal Central Cubikar
// Totalmente sincronizado con Supabase Auth y los esquemas de ADM_CONST y ADM_ARQ

import { getSupabase } from './supabaseClient.js';

let currentUser = null;
let currentProfile = null;
let currentCompany = null;

/**
 * Inicializar observador de autenticación
 */
export async function initAuth(onStateChange) {
  const sb = getSupabase();
  if (!sb) {
    console.warn('[Portal Auth] Supabase aún no inicializado');
    return;
  }

  try {
    // 1. Verificar sesión existente en el almacenamiento
    const { data: { session }, error } = await sb.auth.getSession();
    if (session?.user && !error) {
      currentUser = session.user;
      await loadUserProfileAndCompany(currentUser.id);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      if (onStateChange) onStateChange({ user: currentUser, profile: currentProfile, company: currentCompany });
    } else {
      if (onStateChange) onStateChange(null);
    }
  } catch (err) {
    console.warn('[Portal Auth] Error al inicializar sesión:', err);
    if (onStateChange) onStateChange(null);
  }

  // 2. Escuchar cambios de sesión en tiempo real (login, logout, refresh de token)
  sb.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      await loadUserProfileAndCompany(currentUser.id);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      if (onStateChange) onStateChange({ user: currentUser, profile: currentProfile, company: currentCompany });
    } else {
      currentUser = null;
      currentProfile = null;
      currentCompany = null;
      clearLocalUserStorage();
      if (onStateChange) onStateChange(null);
    }
  });
}

/**
 * Cargar perfil de usuario y datos de empresa desde Supabase
 */
export async function loadUserProfileAndCompany(userId) {
  const sb = getSupabase();
  if (!sb || !userId) return null;

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
      return { profile: currentProfile, company: currentCompany };
    }
  } catch (err) {
    console.warn('[Portal Auth] No se pudo cargar perfil extendido:', err);
  }
  return null;
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
    await loadUserProfileAndCompany(data.user.id);
    syncLocalUserStorage(currentUser, currentProfile, currentCompany);
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
    await loadUserProfileAndCompany(data.user.id);
    syncLocalUserStorage(currentUser, currentProfile, currentCompany);
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
 * Cerrar sesión
 */
export async function logout() {
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
