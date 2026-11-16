// assets/js/auth.js
// Manejador de Autenticación, Registro y Estado de Sesión en el Portal Central Cubikar
// Totalmente sincronizado con Supabase Auth y los esquemas de ADM_CONST y ADM_ARQ

import { getSupabase, SUPABASE_CONFIG } from './supabaseClient.js?v=20261116_cf10';
import { CUBIKAR_SUB_TEST_MODE } from './checkout.js?v=20261116_cf10';
import {
  writeSharedSsoCookie,
  clearSharedSsoCookie,
  readSharedSsoCookie,
  readLocalSupabaseTokens,
  extractIncomingSsoFromHash,
  scrubSsoHashParams,
  getLastSignOutTimestamp,
  buildSsoTargetUrl
} from './ssoHelper.js?v=20261116_cf10';

export const GOOGLE_CLIENT_ID = '1097638023851-36b44hlrj7fgslfcmqlvf77dk89h7eus.apps.googleusercontent.com';
export const STORAGE_KEY_CLOSED_SESSIONS = 'control_obra_closed_sessions_v1';

// Cuentas exclusivas de tutoriales (limpias, sin proyectos, con acceso Plus inmediato)
export const TUTORIAL_ACCOUNTS = {
  'tutorial.arq@cubikar.app': {
    id: '11111111-1111-4111-a111-111111111111',
    companyId: '11111111-1111-4111-a111-111111111112',
    email: 'tutorial.arq@cubikar.app',
    name: 'Arq. Demo Tutorial',
    company: 'Estudio de Arquitectura Demo',
    role: 'owner',
    plan: 'plus',
    password: 'Cubikar2026!'
  },
  'tutorial.const@cubikar.app': {
    id: '22222222-2222-4222-a222-222222222221',
    companyId: '22222222-2222-4222-a222-222222222222',
    email: 'tutorial.const@cubikar.app',
    name: 'Ing. Demo Tutorial',
    company: 'Constructora Modelo Demo',
    role: 'owner',
    plan: 'plus',
    password: 'Cubikar2026!'
  }
};

let currentUser = null;
let currentProfile = null;
let currentCompany = null;
let activeGoogleNoncePair = null;
let googleSignInBusy = false;
let explicitAuthDepth = 0;
let inFlightProfilePromise = null;
let inFlightProfileUserId = null;
let loadedProfileUserId = null;
let lastProfileLoadedAt = 0;

export function getClosedSessionsList() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_CLOSED_SESSIONS);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    return list.map(e => (typeof e === 'string' ? e.toLowerCase().trim() : '')).filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function markSessionClosed(email) {
  if (!email) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const cleanEmail = email.toLowerCase().trim();
    const list = getClosedSessionsList();
    if (!list.includes(cleanEmail)) {
      list.push(cleanEmail);
      localStorage.setItem(STORAGE_KEY_CLOSED_SESSIONS, JSON.stringify(list));
    }
  } catch (_) {}
}

export function markSessionOpen(email) {
  if (!email) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const cleanEmail = email.toLowerCase().trim();
    const list = getClosedSessionsList();
    const filtered = list.filter(e => e !== cleanEmail);
    localStorage.setItem(STORAGE_KEY_CLOSED_SESSIONS, JSON.stringify(filtered));
  } catch (_) {}
}

export function clearLocalSupabaseTokens() {
  if (typeof localStorage !== 'undefined') {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sb-') || k.includes('auth-token') || k.includes('supabase.auth.token'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('sb-') || k.includes('auth-token') || k.includes('supabase.auth.token'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (_) {}
  }
}

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

let ssoHydrationInProgress = false;
const MAX_SAFE_JWT_CHARS = 7500;
const COMPACT_COOLDOWN_MS = 180000;
let compactSessionInFlightPromise = null;
let lastCompactRefreshAt = 0;
const repairedJwtFingerprints = new Set();
const compactAttemptByUser = new Map();

function extractJwtSub(token) {
  if (!token || typeof token !== 'string') return '';
  try {
    const parts = token.split('.');
    if (parts.length < 2) return '';
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? b64 + '='.repeat(4 - (b64.length % 4)) : b64;
    const payload = JSON.parse(atob(pad));
    return String(payload?.sub || '');
  } catch (_) {
    return '';
  }
}

function isUserOnCompactCooldown(uid, currentTokenLen = 0) {
  if (!uid) return false;
  const now = Date.now();
  const mem = compactAttemptByUser.get(uid);
  if (mem && (now - mem.ts) < COMPACT_COOLDOWN_MS && (!currentTokenLen || currentTokenLen <= mem.len + 400)) {
    return true;
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem('cubikar_jwt_slim_uid_' + uid);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (now - Number(parsed.ts || 0)) < COMPACT_COOLDOWN_MS && (!currentTokenLen || currentTokenLen <= Number(parsed.len || 0) + 400)) {
          compactAttemptByUser.set(uid, { ts: Number(parsed.ts || 0), len: Number(parsed.len || 0) });
          return true;
        }
      }
    }
  } catch (_) {}
  return false;
}

function markUserCompactCooldown(uid, tokenLen = 0) {
  if (!uid) return;
  const entry = { ts: Date.now(), len: Number(tokenLen || 0) };
  compactAttemptByUser.set(uid, entry);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('cubikar_jwt_slim_uid_' + uid, JSON.stringify(entry));
    }
  } catch (_) {}
}

function extractJwtExpSeconds(token) {
  if (!token || typeof token !== 'string') return 0;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return 0;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? b64 + '='.repeat(4 - (b64.length % 4)) : b64;
    const payload = JSON.parse(atob(pad));
    return Number(payload?.exp || 0) || 0;
  } catch (_) {
    return 0;
  }
}

function hasBloatedUserMetadata(user) {
  const meta = user?.user_metadata;
  if (!meta || typeof meta !== 'object') return false;
  if (meta.cubikar_collaboration_v1 && typeof meta.cubikar_collaboration_v1 === 'object') return true;
  for (const imgKey of ['avatar_url', 'picture']) {
    const val = meta[imgKey];
    if (typeof val === 'string' && (val.startsWith('data:') || val.length > 600)) return true;
  }
  const cs = meta.cubikar_cloud_state_v2;
  if (cs && typeof cs === 'object') {
    if (Array.isArray(cs.ownedProjects) && cs.ownedProjects.length > 0) return true;
    if (Array.isArray(cs.collaboratedProjects) && cs.collaboratedProjects.length > 0) return true;
    if (Array.isArray(cs.deletedProjectIds) && cs.deletedProjectIds.length > 15) return true;
  }
  if (Array.isArray(meta.cubikar_dismissed_notifications) && meta.cubikar_dismissed_notifications.length > 25) return true;
  if (Array.isArray(meta.cubikar_read_mentions) && meta.cubikar_read_mentions.length > 25) return true;
  try {
    if (JSON.stringify(meta).length > 5200) return true;
  } catch (_) {}
  return false;
}

function isJwtSessionBloated(session) {
  const token = session?.access_token;
  if (typeof token === 'string' && token.length > MAX_SAFE_JWT_CHARS) return true;
  return hasBloatedUserMetadata(session?.user);
}

async function repairBloatedJwtRemote(accessToken) {
  if (!accessToken || typeof accessToken !== 'string' || !accessToken.includes('.')) return false;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoints = [];
  const addEndpoint = (u) => { if (u && !endpoints.includes(u)) endpoints.push(u); };
  addEndpoint('/api/admin-users');
  if (origin !== 'https://const.cubikar.app') {
    addEndpoint('https://const.cubikar.app/api/admin-users');
  }
  if (origin !== 'https://cubikar.app') {
    addEndpoint('https://cubikar.app/api/admin-users');
  }

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'slim_own_jwt_metadata',
          accessToken
        })
      });
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      if (json?.ok) return true;
    } catch (_) {}
  }
  return false;
}

async function refreshCleanSession(sb, refreshToken) {
  if (!sb) return null;
  try {
    const { data, error } = refreshToken
      ? await sb.auth.refreshSession({ refresh_token: refreshToken })
      : await sb.auth.refreshSession();
    if (!error && data?.session?.access_token) {
      return data.session;
    }
  } catch (_) {}

  if (refreshToken && SUPABASE_CONFIG?.url && SUPABASE_CONFIG?.anonKey) {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_CONFIG.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (res.ok) {
        const tok = await res.json().catch(() => null);
        if (tok?.access_token) {
          const setRes = await sb.auth.setSession({
            access_token: tok.access_token,
            refresh_token: tok.refresh_token || refreshToken
          });
          return setRes?.data?.session || tok;
        }
      }
    } catch (_) {}
  }
  return null;
}

export async function ensureCompactAuthSession(sbClient = null, sessionOverride = null) {
  if (compactSessionInFlightPromise) {
    return compactSessionInFlightPromise;
  }

  compactSessionInFlightPromise = (async () => {
    const sb = sbClient || getSupabase();
    let session = sessionOverride || null;
    if (!session && sb) {
      try {
        const { data } = await sb.auth.getSession();
        session = data?.session || null;
      } catch (_) {}
    }
    if (!session) {
      const localTok = readLocalSupabaseTokens();
      if (localTok?.accessToken && localTok?.refreshToken) {
        session = { access_token: localTok.accessToken, refresh_token: localTok.refreshToken, user: null };
      }
    }
    if (!session || !isJwtSessionBloated(session)) {
      return session;
    }
    if (!session.access_token || !session.access_token.includes('.')) {
      return session;
    }

    const uid = session?.user?.id || extractJwtSub(session.access_token);
    if (isUserOnCompactCooldown(uid, session.access_token.length)) {
      return session;
    }

    const fp = `${session.access_token.length}_${session.access_token.slice(-16)}`;
    if (repairedJwtFingerprints.has(fp)) {
      return session;
    }
    try {
      const prevTs = Number(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('cubikar_jwt_slim_ts_' + fp) || 0 : 0);
      if (prevTs > 0 && (Date.now() - prevTs) < 15000) {
        return session;
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('cubikar_jwt_slim_ts_' + fp, String(Date.now()));
      }
    } catch (_) {}
    repairedJwtFingerprints.add(fp);

    const exp = extractJwtExpSeconds(session.access_token);
    if (exp > 0 && exp < Math.floor(Date.now() / 1000) + 30 && session.refresh_token) {
      lastCompactRefreshAt = Date.now();
      const renewed = await refreshCleanSession(sb, session.refresh_token);
      if (renewed?.access_token) {
        session = renewed;
        if (!isJwtSessionBloated(session)) {
          markUserCompactCooldown(uid, session.access_token.length);
          return session;
        }
      }
    }

    markUserCompactCooldown(uid, session.access_token.length);
    const repaired = await repairBloatedJwtRemote(session.access_token);
    if (!repaired) {
      return session;
    }

    let latestRefreshToken = session.refresh_token;
    if (sb) {
      try {
        const { data: latestData } = await sb.auth.getSession();
        if (latestData?.session?.refresh_token) {
          latestRefreshToken = latestData.session.refresh_token;
        }
      } catch (_) {}
    }

    lastCompactRefreshAt = Date.now();
    const cleanSession = await refreshCleanSession(sb, latestRefreshToken);
    if (cleanSession?.access_token) {
      lastCompactRefreshAt = Date.now();
      markUserCompactCooldown(uid, cleanSession.access_token.length);
      console.info(`[Portal Auth] Sesión JWT compactada automáticamente (${session.access_token.length} -> ${cleanSession.access_token.length} bytes).`);
      return cleanSession;
    }
    return session;
  })().finally(() => {
    compactSessionInFlightPromise = null;
  });

  return compactSessionInFlightPromise;
}

async function tryHydrateSsoSession(sb) {
  if (!sb) return null;
  const hashTokens = extractIncomingSsoFromHash();
  let tokens = hashTokens;
  const closedList = getClosedSessionsList();
  const lastSignOutTs = getLastSignOutTimestamp();

  if (!tokens) {
    const cookieTokens = readSharedSsoCookie();
    const cookieEmail = (cookieTokens?.email || '').toLowerCase().trim();
    const isNewerCookie = cookieTokens?.ts > 0 && lastSignOutTs > 0 && cookieTokens.ts > lastSignOutTs;
    if ((cookieTokens?.refreshToken || cookieTokens?.email) && (!closedList.includes(cookieEmail) || isNewerCookie)) {
      tokens = cookieTokens;
    }
  }
  if (!tokens?.refreshToken && !tokens?.email) {
    scrubSsoHashParams();
    return null;
  }

  explicitAuthDepth += 1;
  ssoHydrationInProgress = true;
  try {
    const tutEmail = (tokens?.email || '').toLowerCase().trim();
    if (tutEmail && TUTORIAL_ACCOUNTS[tutEmail]) {
      const tut = TUTORIAL_ACCOUNTS[tutEmail];
      const syntheticUser = {
        id: tut.id,
        email: tut.email,
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: {
          full_name: tut.name,
          name: tut.name,
          empresa_nombre: tut.company,
          plan: 'plus',
          subscription: { planId: 'plus', billingCycle: 'monthly', isBetaTest: true }
        },
        app_metadata: { provider: 'email', providers: ['email'] }
      };
      const syntheticProfile = {
        id: tut.id,
        empresa_id: tut.companyId,
        nombre_completo: tut.name,
        email: tut.email,
        rol: tut.role || 'owner',
        avatar_url: '',
        empresas: {
          id: tut.companyId,
          nombre: tut.company,
          plan: 'plus',
          estado_suscripcion: 'active',
          acceso_arq: true,
          plan_arq: 'plus',
          acceso_const: true,
          plan_const: 'plus'
        }
      };
      const syntheticSession = {
        access_token: tokens.accessToken || ('tut_access_token_' + tut.id),
        refresh_token: tokens.refreshToken || ('tut_refresh_token_' + tut.id),
        user: syntheticUser,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30
      };
      currentUser = syntheticUser;
      currentProfile = syntheticProfile;
      currentCompany = syntheticProfile.empresas;
      markSessionOpen(tutEmail);
      writeSharedSsoCookie(syntheticSession);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      return syntheticSession;
    }

    if (!tokens.refreshToken) return null;

    if (tokens.fromHash && tokens.email) {
      markSessionOpen(tokens.email);
    }

    const incomingExp = extractJwtExpSeconds(tokens.accessToken);
    const incomingNotExpired = !incomingExp || incomingExp > (Math.floor(Date.now() / 1000) + 30);
    if (tokens.accessToken && tokens.accessToken.length > MAX_SAFE_JWT_CHARS && incomingNotExpired) {
      await repairBloatedJwtRemote(tokens.accessToken);
    }

    const { data, error } = (tokens.accessToken && tokens.accessToken.length <= MAX_SAFE_JWT_CHARS)
      ? await sb.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
      : await sb.auth.refreshSession({ refresh_token: tokens.refreshToken });
    if (error || !data?.session?.user) return null;
    const compactSession = (await ensureCompactAuthSession(sb, data.session)) || data.session;
    const userEmail = (compactSession.user.email || '').toLowerCase().trim();
    const isExplicitSso = Boolean(tokens.fromHash || (tokens.ts && tokens.ts > lastSignOutTs));
    if (isExplicitSso) {
      markSessionOpen(userEmail);
    } else if (closedList.includes(userEmail)) {
      clearLocalSupabaseTokens();
      try {
        await sb.auth.signOut({ scope: 'local' });
      } catch (_) {}
      return null;
    }
    return compactSession;
  } catch (err) {
    console.warn('[Portal Auth] No se pudo hidratar sesión SSO entrante:', err?.message || err);
    return null;
  } finally {
    scrubSsoHashParams();
    ssoHydrationInProgress = false;
    explicitAuthDepth = Math.max(0, explicitAuthDepth - 1);
  }
}

export async function hydrateIncomingSsoSession(sbInstance = null) {
  const sb = sbInstance || getSupabase();
  return tryHydrateSsoSession(sb);
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
      const email = (session.user.email || '').toLowerCase().trim();
      const closedList = getClosedSessionsList();
      const isClosed = closedList.includes(email);
      const isOAuthRedirect = typeof window !== 'undefined' && (
        window.location.hash.includes('cubikar_sso_') ||
        window.location.hash.includes('access_token') ||
        window.location.search.includes('code=')
      );
      const isExplicitInteractive = explicitAuthDepth > 0 || ssoHydrationInProgress || isOAuthRedirect;

      if (isExplicitInteractive) {
        markSessionOpen(email);
      } else if (isClosed) {
        console.info(`[Portal Auth] Bloqueando auto-sesión pasiva (${event}) por sesión cerrada previamente (${email}).`);
        currentUser = null;
        currentProfile = null;
        currentCompany = null;
        resetProfileCache();
        clearLocalSupabaseTokens();
        clearLocalUserStorage();
        clearSharedSsoCookie({ markSignOut: true });
        setTimeout(() => {
          try {
            sb.auth.signOut({ scope: 'local' }).catch(() => {});
          } catch (_) {}
          if (onStateChange) onStateChange(null);
        }, 0);
        return;
      }

      const prevEmail = (currentUser?.email || '').toLowerCase().trim();
      if ((prevEmail && prevEmail !== email) || (currentProfile && currentProfile.id !== session.user.id)) {
        currentProfile = null;
        currentCompany = null;
        resetProfileCache();
      }

      const isCompactLoopEvent = event === 'TOKEN_REFRESHED' && lastCompactRefreshAt > 0 && (Date.now() - lastCompactRefreshAt) < 15000;
      const evtUid = session.user?.id || extractJwtSub(session.access_token);
      if (!isCompactLoopEvent && isJwtSessionBloated(session) && !isUserOnCompactCooldown(evtUid, session.access_token?.length || 0)) {
        setTimeout(async () => {
          const cleanSession = (await ensureCompactAuthSession(sb, session)) || session;
          if (!cleanSession?.user) return;
          currentUser = cleanSession.user;
          writeSharedSsoCookie(cleanSession);
          syncLocalUserStorage(currentUser, currentProfile, currentCompany);
          if (onStateChange) {
            onStateChange({ user: currentUser, profile: currentProfile, company: currentCompany, event });
          }
          scheduleBackgroundProfileSync(currentUser.id, onStateChange);
        }, 0);
        return;
      }

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
        clearLocalSupabaseTokens();
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
    // 1. Inspeccionar si viene SSO explícito en hash o cookie o si cambió el email respecto al usuario local previo
    const incomingHashTokens = extractIncomingSsoFromHash();
    const cookieTokens = readSharedSsoCookie();
    const lastSignOutTs = getLastSignOutTimestamp();
    let prevLocalEmail = '';
    try {
      const rawPrev = typeof localStorage !== 'undefined' ? localStorage.getItem('control_obra_active_user_v1') : null;
      if (rawPrev) {
        prevLocalEmail = (JSON.parse(rawPrev)?.email || '').toLowerCase().trim();
      }
    } catch (_) {}

    let { data: { session }, error } = await sb.auth.getSession();
    const closedList = getClosedSessionsList();
    if (session?.user) {
      const email = (session.user.email || '').toLowerCase().trim();
      const incomingSameEmail = Boolean(incomingHashTokens?.email && incomingHashTokens.email === email);
      if (closedList.includes(email) && !incomingSameEmail) {
        console.info(`[Portal Auth] Sesión persistida pertenece a usuario con sesión cerrada (${email}). Purgando.`);
        clearLocalSupabaseTokens();
        clearLocalUserStorage();
        clearSharedSsoCookie({ markSignOut: true });
        try {
          await sb.auth.signOut({ scope: 'local' }).catch(() => {});
        } catch (_) {}
        session = null;
      }
    }

    const activeEmail = (session?.user?.email || '').toLowerCase().trim();
    if (activeEmail && prevLocalEmail && activeEmail !== prevLocalEmail) {
      currentProfile = null;
      currentCompany = null;
      resetProfileCache();
    }

    const cookieEmail = (cookieTokens?.email || '').toLowerCase().trim();
    const cookieTargetsDifferentUser = Boolean(
      cookieEmail &&
      cookieEmail !== activeEmail &&
      (!closedList.includes(cookieEmail) || (cookieTokens?.ts > 0 && lastSignOutTs > 0 && cookieTokens.ts > lastSignOutTs))
    );
    const hashTargetsDifferentUser = Boolean(incomingHashTokens?.email && incomingHashTokens.email !== activeEmail);
    const hashTargetsNewToken = Boolean(incomingHashTokens?.refreshToken && session?.refresh_token !== incomingHashTokens.refreshToken);

    if (!session?.user || error || hashTargetsDifferentUser || hashTargetsNewToken || cookieTargetsDifferentUser) {
      const ssoSession = await tryHydrateSsoSession(sb);
      if (ssoSession?.user) {
        session = ssoSession;
        error = null;
      }
    } else if (incomingHashTokens) {
      scrubSsoHashParams();
    }

    if (session?.user && !error) {
      const initUid = session.user?.id || extractJwtSub(session.access_token);
      if (isJwtSessionBloated(session) && !isUserOnCompactCooldown(initUid, session.access_token?.length || 0)) {
        session = (await ensureCompactAuthSession(sb, session)) || session;
      }
      const userEmail = (session.user.email || '').toLowerCase().trim();
      if (getClosedSessionsList().includes(userEmail)) {
        if (onStateChange) onStateChange(null);
        return;
      }
      if ((currentUser?.email || '').toLowerCase().trim() !== userEmail || (prevLocalEmail && prevLocalEmail !== userEmail)) {
        currentProfile = null;
        currentCompany = null;
        resetProfileCache();
      }
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

export const initPortalAuth = initAuth;

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
            plan_const,
            acceso_const,
            plan_arq,
            acceso_arq,
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
  explicitAuthDepth += 1;
  try {
    let data = null;
    let authError = null;

    try {
      const res = await sb.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });
      data = res.data;
      authError = res.error;
    } catch (e) {
      authError = e;
    }

    // Reconocimiento directo para cuentas de tutorial
    if ((authError || !data?.user) && TUTORIAL_ACCOUNTS[cleanEmail] && password === TUTORIAL_ACCOUNTS[cleanEmail].password) {
      const tut = TUTORIAL_ACCOUNTS[cleanEmail];
      const syntheticUser = {
        id: tut.id,
        email: tut.email,
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: {
          full_name: tut.name,
          name: tut.name,
          empresa_nombre: tut.company,
          plan: 'plus',
          subscription: { planId: 'plus', billingCycle: 'monthly', isBetaTest: true }
        },
        app_metadata: { provider: 'email', providers: ['email'] }
      };
      const syntheticProfile = {
        id: tut.id,
        empresa_id: tut.companyId,
        nombre_completo: tut.name,
        email: tut.email,
        rol: 'owner',
        avatar_url: '',
        empresas: {
          id: tut.companyId,
          nombre: tut.company,
          plan: 'plus',
          estado_suscripcion: 'active',
          acceso_arq: true,
          plan_arq: 'plus',
          acceso_const: true,
          plan_const: 'plus'
        }
      };
      const syntheticSession = {
        access_token: 'tut_access_token_' + tut.id,
        refresh_token: 'tut_refresh_token_' + tut.id,
        user: syntheticUser,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30
      };

      currentUser = syntheticUser;
      currentProfile = syntheticProfile;
      currentCompany = syntheticProfile.empresas;
      markSessionOpen(cleanEmail);
      writeSharedSsoCookie(syntheticSession);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      return { user: currentUser, session: syntheticSession };
    }

    if (authError) throw authError;

    if (data?.session && isJwtSessionBloated(data.session)) {
      const compact = await ensureCompactAuthSession(sb, data.session);
      if (compact?.user) {
        data.session = compact;
        data.user = compact.user;
      }
    }

    if (data?.user) {
      currentUser = data.user;
      markSessionOpen(cleanEmail);
      if (data.session) writeSharedSsoCookie(data.session);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      scheduleBackgroundProfileSync(data.user.id);
    }
    return data;
  } finally {
    setTimeout(() => { explicitAuthDepth = Math.max(0, explicitAuthDepth - 1); }, 1000);
  }
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

  explicitAuthDepth += 1;
  try {
    const optionsData = {
      full_name: cleanName,
      empresa_nombre: cleanCompany
    };

    if (CUBIKAR_SUB_TEST_MODE) {
      optionsData.plan = 'plus';
      optionsData.subscription = {
        planId: 'plus',
        billingCycle: 'monthly',
        isBetaTest: true
      };
    }

    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: optionsData
      }
    });

    if (error) throw error;

    if (data?.user && data?.session) {
      currentUser = data.user;
      markSessionOpen(cleanEmail);
      writeSharedSsoCookie(data.session);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      scheduleBackgroundProfileSync(data.user.id);
    }
    return data;
  } finally {
    setTimeout(() => { explicitAuthDepth = Math.max(0, explicitAuthDepth - 1); }, 1000);
  }
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

  explicitAuthDepth += 1;
  try {
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
  } catch (err) {
    explicitAuthDepth = Math.max(0, explicitAuthDepth - 1);
    throw err;
  }
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

  explicitAuthDepth += 1;
  try {
    const { data, error } = await sb.auth.signInWithIdToken(payload);
    if (error) throw error;

    if (data?.session && isJwtSessionBloated(data.session)) {
      const compact = await ensureCompactAuthSession(sb, data.session);
      if (compact?.user) {
        data.session = compact;
        data.user = compact.user;
      }
    }

    if (data?.user) {
      currentUser = data.user;
      const cleanEmail = (data.user.email || '').trim().toLowerCase();
      if (cleanEmail) markSessionOpen(cleanEmail);
      if (data.session) writeSharedSsoCookie(data.session);
      syncLocalUserStorage(currentUser, currentProfile, currentCompany);
      scheduleBackgroundProfileSync(data.user.id);
    }
    return data;
  } finally {
    setTimeout(() => { explicitAuthDepth = Math.max(0, explicitAuthDepth - 1); }, 1000);
  }
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
export async function logout(options = {}) {
  const scope = options?.scope === 'global' ? 'global' : 'local';
  const email = (currentUser?.email || '').toLowerCase().trim();
  if (email) {
    markSessionClosed(email);
  }
  try {
    const raw = localStorage.getItem('control_obra_active_user_v1');
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.email) markSessionClosed(p.email);
    }
  } catch (_) {}

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
    if (scope === 'global') {
      // Ejecutar scope global ANTES de limpiar tokens o llamar scope local para enviar el JWT válido
      try {
        await sb.auth.signOut({ scope: 'global' }).catch(() => {});
      } catch (_) {}
    }
    try {
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    } catch (_) {}
  }

  clearLocalSupabaseTokens();
  clearLocalUserStorage();
  currentUser = null;
  currentProfile = null;
  currentCompany = null;
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
    const tokens = (session?.access_token && session?.refresh_token)
      ? { accessToken: session.access_token, refreshToken: session.refresh_token, email: session.user?.email || currentUser?.email || '' }
      : (readLocalSupabaseTokens() || readSharedSsoCookie() || (currentUser?.email ? { email: currentUser.email } : null));
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
export function resolveUserProfileAndPlan(user, profile, company) {
  const hasExplicitProductFields = Boolean(
    company && (
      company.plan_const != null ||
      company.plan_arq != null ||
      company.acceso_const != null ||
      company.acceso_arq != null
    )
  );
  const legacyFallbackPlan = !hasExplicitProductFields
    ? (company?.plan || user?.user_metadata?.subscription?.planId || 'free')
    : 'free';

  const rawConstPlan = (company?.acceso_const === false && !company?.plan_const)
    ? 'free'
    : (company?.plan_const || legacyFallbackPlan || 'free');
  const rawArqPlan = (company?.acceso_arq === false && !company?.plan_arq)
    ? 'free'
    : (company?.plan_arq || legacyFallbackPlan || 'free');

  const effectiveConstPlan = rawConstPlan === 'pro'
    ? 'pro'
    : (CUBIKAR_SUB_TEST_MODE ? 'plus' : rawConstPlan);
  const effectiveArqPlan = rawArqPlan === 'pro'
    ? 'pro'
    : (CUBIKAR_SUB_TEST_MODE ? 'plus' : rawArqPlan);

  const accesoConst = company?.acceso_const != null
    ? Boolean(company.acceso_const)
    : (effectiveConstPlan !== 'free');
  const accesoArq = company?.acceso_arq != null
    ? Boolean(company.acceso_arq)
    : (effectiveArqPlan !== 'free');

  const plan = (company?.plan === 'pro' || effectiveConstPlan === 'pro' || effectiveArqPlan === 'pro')
    ? 'pro'
    : (CUBIKAR_SUB_TEST_MODE
        ? 'plus'
        : (effectiveConstPlan === 'plus' || effectiveArqPlan === 'plus'
            ? 'plus'
            : (company?.plan || user?.user_metadata?.subscription?.planId || 'free')));

  const billingCycle = company?.billing_cycle || user?.user_metadata?.subscription?.billingCycle || 'monthly';

  return {
    plan,
    plan_const: effectiveConstPlan,
    plan_arq: effectiveArqPlan,
    acceso_const: accesoConst,
    acceso_arq: accesoArq,
    billingCycle
  };
}

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

    const {
      plan,
      plan_const: effectiveConstPlan,
      plan_arq: effectiveArqPlan,
      acceso_const: accesoConst,
      acceso_arq: accesoArq,
      billingCycle
    } = resolveUserProfileAndPlan(user, profile, company);

    const cleanEmail = (user.email || '').toLowerCase().trim();

    const userData = {
      id: user.id,
      email: cleanEmail,
      name: name,
      company: companyName,
      avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      plan: plan,
      plan_const: effectiveConstPlan,
      plan_arq: effectiveArqPlan,
      acceso_const: accesoConst,
      acceso_arq: accesoArq,
      billingCycle,
      role: profile?.rol || 'owner'
    };

    localStorage.setItem('control_obra_active_user_v1', JSON.stringify(userData));
    localStorage.setItem('control_obra_active_user_v1_last', JSON.stringify(userData));

    if (cleanEmail) {
      try {
        localStorage.setItem(`cubikar_subscription_${cleanEmail}`, JSON.stringify({
          planId: plan,
          plan_const: effectiveConstPlan,
          plan_arq: effectiveArqPlan,
          acceso_const: accesoConst,
          acceso_arq: accesoArq,
          billingCycle,
          ...(CUBIKAR_SUB_TEST_MODE && plan !== 'pro' ? { isBetaTest: true } : {}),
          updatedAt: new Date().toISOString()
        }));
        localStorage.setItem(`adm_const_subscription_${cleanEmail}`, JSON.stringify({
          planId: effectiveConstPlan,
          plan_const: effectiveConstPlan,
          acceso_const: accesoConst,
          billingCycle,
          ...(CUBIKAR_SUB_TEST_MODE && effectiveConstPlan !== 'pro' ? { isBetaTest: true } : {}),
          updatedAt: new Date().toISOString()
        }));
        localStorage.setItem(`adm_arq_subscription_${cleanEmail}`, JSON.stringify({
          planId: effectiveArqPlan,
          plan_arq: effectiveArqPlan,
          acceso_arq: accesoArq,
          billingCycle,
          ...(CUBIKAR_SUB_TEST_MODE && effectiveArqPlan !== 'pro' ? { isBetaTest: true } : {}),
          updatedAt: new Date().toISOString()
        }));
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[Portal Auth] Error al sincronizar almacenamiento local:', err);
  }
}

export const syncLocalUserSession = syncLocalUserStorage;

export async function syncSubscriptionFromCloud() {
  const sb = getSupabase();
  if (!sb) return null;
  let userId = currentUser?.id;
  if (!userId) {
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user) {
        currentUser = data.session.user;
        userId = currentUser.id;
      }
    } catch (_) {}
  }
  if (!userId) return null;
  const res = await loadUserProfileAndCompany(userId, true);
  if (res && currentUser) {
    syncLocalUserStorage(currentUser, currentProfile, currentCompany);
  }
  return res;
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
