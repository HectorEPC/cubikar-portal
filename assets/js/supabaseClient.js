// assets/js/supabaseClient.js
// Cliente oficial de Supabase para el Portal Central Cubikar (cubikar.app)

export const SUPABASE_CONFIG = {
  url: 'https://hxyzvxueoqvvjyehfpym.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4eXp2eHVlb3F2dmp5ZWhmcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMTYwODAsImV4cCI6MjEwOTY5MjA4MH0.q3P-_HZ11PP5dgCkAX7o5TZGqVAoqVv438W6coZiYeA'
};

let supabaseInstance = null;
const recentNetFailureTimestamps = [];
const MAX_SAFE_HTTP_BEARER_CHARS = 12000;

function getHeaderCaseInsensitive(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || '');
  const target = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === target) return String(headers[k] || '');
  }
  return '';
}

function createResilientSupabaseFetch() {
  if (typeof globalThis === 'undefined' || typeof globalThis.fetch !== 'function') return undefined;
  return async function cubikarSupabaseFetch(input, init) {
    const authHdr = getHeaderCaseInsensitive(init?.headers || input?.headers, 'Authorization');
    const reqUrl = typeof input === 'string' ? input : String(input?.url || '');
    const isTokenExchange = reqUrl.includes('/auth/v1/token');
    if (!isTokenExchange && /^Bearer\s+/i.test(authHdr) && authHdr.length > (MAX_SAFE_HTTP_BEARER_CHARS + 7)) {
      if (typeof window !== 'undefined') {
        window.__cubikarOversizedJwtBlocked = true;
      }
      throw new DOMException('Token JWT sobredimensionado bloqueado localmente antes del transporte HTTP', 'AbortError');
    }

    const now = Date.now();
    while (recentNetFailureTimestamps.length > 0 && (now - recentNetFailureTimestamps[0]) > 4000) {
      recentNetFailureTimestamps.shift();
    }
    const retryCount = Number(getHeaderCaseInsensitive(init?.headers || input?.headers, 'X-Retry-Count') || '0') || 0;
    if (retryCount >= 2 || (retryCount >= 1 && recentNetFailureTimestamps.length >= 3)) {
      throw new DOMException('Reintento suprimido por inestabilidad de red', 'AbortError');
    }
    try {
      const response = await globalThis.fetch(input, init);
      recentNetFailureTimestamps.length = 0;
      if (typeof window !== 'undefined' && window.__cubikarOversizedJwtBlocked && /^Bearer\s+/i.test(authHdr)) {
        window.__cubikarOversizedJwtBlocked = false;
      }
      return response;
    } catch (err) {
      if (err?.name !== 'AbortError' && err?.code !== 'ABORT_ERR') {
        recentNetFailureTimestamps.push(Date.now());
      }
      throw err;
    }
  };
}

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    const authOptions = {
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    };
    const customFetch = createResilientSupabaseFetch();

    supabaseInstance = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      {
        auth: authOptions,
        ...(customFetch ? { global: { fetch: customFetch } } : {})
      }
    );
    return supabaseInstance;
  }

  console.warn('[Cubikar Portal] SDK de Supabase aún no cargado en window.supabase');
  return null;
}

export const getSupabaseClient = getSupabase;
