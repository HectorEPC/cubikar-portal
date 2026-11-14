// assets/js/auth.js
// Manejador de Autenticación, Registro y Estado de Sesión en el Portal Central

import { getSupabase } from './supabaseClient.js';

let currentUser = null;
let currentProfile = null;
let currentCompany = null;

export async function initAuth(onStateChange) {
  const sb = getSupabase();
  if (!sb) return;

  // 1. Verificar sesión existente
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadUserProfileAndCompany(currentUser.id);
    if (onStateChange) onStateChange({ user: currentUser, profile: currentProfile, company: currentCompany });
  } else {
    if (onStateChange) onStateChange(null);
  }

  // 2. Escuchar cambios de sesión en tiempo real
  sb.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      await loadUserProfileAndCompany(currentUser.id);
      if (onStateChange) onStateChange({ user: currentUser, profile: currentProfile, company: currentCompany });
    } else {
      currentUser = null;
      currentProfile = null;
      currentCompany = null;
      if (onStateChange) onStateChange(null);
    }
  });
}

export async function loadUserProfileAndCompany(userId) {
  const sb = getSupabase();
  if (!sb || !userId) return;

  try {
    const { data: perfil, error } = await sb
      .from('perfiles')
      .select('*, empresas(*)')
      .eq('id', userId)
      .single();

    if (!error && perfil) {
      currentProfile = perfil;
      currentCompany = perfil.empresas;
    }
  } catch (err) {
    console.warn('[Portal Auth] No se pudo cargar perfil extendido:', err);
  }
}

export async function loginWithEmail(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Servidor de autenticación no disponible');

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function registerWithEmail(email, password, fullName, companyName) {
  const sb = getSupabase();
  if (!sb) throw new Error('Servidor de autenticación no disponible');

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        empresa_nombre: companyName || fullName
      }
    }
  });
  if (error) throw error;
  return data;
}

export async function loginWithGoogle() {
  const sb = getSupabase();
  if (!sb) throw new Error('Servidor de autenticación no disponible');

  const cleanRedirect = window.location.origin + window.location.pathname;
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: cleanRedirect }
  });
  if (error) throw error;
  return data;
}

export async function logout() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  currentUser = null;
  currentProfile = null;
  currentCompany = null;
}

export function getCurrentState() {
  return {
    user: currentUser,
    profile: currentProfile,
    company: currentCompany
  };
}
