// assets/js/supabaseClient.js
// Cliente oficial de Supabase para el Portal Central Cubikar (cubikar.com)

export const SUPABASE_CONFIG = {
  url: 'https://hxyzvxueoqvvjyehfpym.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4eXp2eHVlb3F2dmp5ZWhmcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMTYwODAsImV4cCI6MjEwOTY5MjA4MH0.q3P-_HZ11PP5dgCkAX7o5TZGqVAoqVv438W6coZiYeA'
};

let supabaseInstance = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  if (typeof window !== 'undefined' && window.supabase) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Si estamos en producción (cubikar.com), usamos cookie compartida para todos los subdominios
    const authOptions = {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'cubikar_shared_auth'
    };

    if (!isLocalhost && window.location.hostname.includes('cubikar.com')) {
      authOptions.cookieOptions = {
        domain: '.cubikar.com',
        sameSite: 'lax',
        secure: true
      };
    }

    supabaseInstance = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      { auth: authOptions }
    );
    return supabaseInstance;
  }

  console.warn('[Cubikar Portal] SDK de Supabase aún no cargado en window.');
  return null;
}
