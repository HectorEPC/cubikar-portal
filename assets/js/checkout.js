// assets/js/checkout.js
// Integración con Stripe Checkout vía Supabase Edge Functions

import { getSupabase } from './supabaseClient.js';
import { getCurrentState } from './auth.js';

export const PLANS_CONFIG = {
  arq: {
    id: 'arq',
    name: 'Cubikar Arquitectura',
    monthlyPrice: 350,
    annualPrice: 3360,
    annualMonthlyEquivalent: 280,
    tag: 'Especialistas en Diseño y Proyecto Ejecutivo'
  },
  const: {
    id: 'const',
    name: 'Cubikar Construcción',
    monthlyPrice: 350,
    annualPrice: 3360,
    annualMonthlyEquivalent: 280,
    tag: 'Control Total de Obra, APU y Bitácora'
  },
  combo: {
    id: 'combo',
    name: 'Suite Cubikar (Combo Completo)',
    monthlyPrice: 550,
    annualPrice: 5280,
    annualMonthlyEquivalent: 440,
    savingsText: 'Ahorra más del 20% al contratar ambas apps',
    tag: 'El ecosistema unificado de mayor valor'
  }
};

export async function startCheckout(productId, billingCycle = 'monthly') {
  const { user } = getCurrentState();
  if (!user) {
    // Si no ha iniciado sesión, abrimos el modal de login/registro
    if (window.openAuthModal) {
      window.openAuthModal('register', productId, billingCycle);
    }
    return;
  }

  const sb = getSupabase();
  if (!sb) {
    alert('Error conectando con el servicio de pagos. Inténtalo nuevamente.');
    return;
  }

  const btn = document.activeElement;
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> Conectando con Stripe...';
  }

  try {
    const { data: { session } } = await sb.auth.getSession();
    const token = session?.access_token;

    const successUrl = `${window.location.origin}/?status=success&product=${productId}`;
    const cancelUrl = `${window.location.origin}/?status=cancel`;

    const response = await fetch(`${sb.supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        productId,
        planId: productId,
        billingCycle,
        successUrl,
        cancelUrl
      })
    });

    const result = await response.json();

    if (result.url) {
      window.location.href = result.url;
    } else {
      throw new Error(result.error || 'No se pudo generar la sesión de pago.');
    }
  } catch (err) {
    console.error('[Stripe Checkout] Error:', err);
    alert(`No fue posible iniciar el pago: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

export async function openCustomerPortal() {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  try {
    const response = await fetch(`${sb.supabaseUrl}/functions/v1/create-portal-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        returnUrl: window.location.href
      })
    });

    const result = await response.json();
    if (result.url) {
      window.location.href = result.url;
    } else {
      alert('No se pudo abrir el portal de facturación: ' + (result.error || 'Intente más tarde'));
    }
  } catch (err) {
    console.error('[Portal Stripe] Error:', err);
    alert('Error al conectar con Stripe Customer Portal.');
  }
}
