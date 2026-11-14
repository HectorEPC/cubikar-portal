// assets/js/supabaseClient.js
// Cliente oficial de Supabase para el Portal Central Cubikar (cubikar.app)

export const SUPABASE_CONFIG = {
  url: 'https://hxyzvxueoqvvjyehfpym.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4eXp2eHVlb3F2dmp5ZWhmcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMTYwODAsImV4cCI6MjEwOTY5MjA4MH0.q3P-_HZ11PP5dgCkAX7o5TZGqVAoqVv438W6coZiYeA'
};

let supabaseInstance = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    const authOptions = {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    };

    if (!isLocalhost && window.location.hostname.includes('cubikar.app')) {
      authOptions.cookieOptions = {
        domain: '.cubikar.app',
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

  console.warn('[Cubikar Portal] SDK de Supabase aún no cargado en window.supabase');
  return null;
}
