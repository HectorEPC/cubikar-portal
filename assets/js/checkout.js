// assets/js/checkout.js
// ConfiguraciÃ³n exacta y completa de suscripciones de ADM_CONST y ADM_ARQ

import { getSupabase } from './supabaseClient.js?v=20261116_cf3';

// =========================================================================
// MODO DE CONTROL: CUBIKAR SUB TEST vs CUBIKAR SUB ORIGINAL
// true: Modo de prueba activo. Plan Plus de cortesÃ­a sin cobros, Stripe pausado.
// false: Modo comercial oficial. Stripe activo y plan gratuito inicial estÃ¡ndar.
// =========================================================================
export const CUBIKAR_SUB_TEST_MODE = true;
if (typeof window !== 'undefined') {
  window.CUBIKAR_SUB_TEST_MODE = CUBIKAR_SUB_TEST_MODE;
}

export const STRIPE_PAYMENT_LINKS = {
  const: {
    plus: {
      monthly: 'https://buy.stripe.com/test_28E00ifDR5Sh4Jhbpe3Je00',
      annual: 'https://buy.stripe.com/test_4gMfZg63hgwVa3B9h63Je01'
    },
    pro: {
      monthly: 'https://buy.stripe.com/test_fZu7sK63hcgF1x564U3Je02',
      annual: 'https://buy.stripe.com/test_dRm3cuajx3K97Vt1OE3Je03'
    }
  },
  arq: {
    plus: {
      monthly: 'https://buy.stripe.com/test_28E00ifDR5Sh4Jhbpe3Je00',
      annual: 'https://buy.stripe.com/test_4gMfZg63hgwVa3B9h63Je01'
    },
    pro: {
      monthly: 'https://buy.stripe.com/test_fZu7sK63hcgF1x564U3Je02',
      annual: 'https://buy.stripe.com/test_dRm3cuajx3K97Vt1OE3Je03'
    }
  },
  combo: {
    plus: {
      monthly: 'https://buy.stripe.com/test_28E00ifDR5Sh4Jhbpe3Je00',
      annual: 'https://buy.stripe.com/test_4gMfZg63hgwVa3B9h63Je01'
    },
    pro: {
      monthly: 'https://buy.stripe.com/test_fZu7sK63hcgF1x564U3Je02',
      annual: 'https://buy.stripe.com/test_dRm3cuajx3K97Vt1OE3Je03'
    }
  }
};

// =========================================================================
// ESPECIFICACIONES EXACTAS DE ADM_CONST
// =========================================================================
export const CONST_TIERS = {
  free: {
    id: 'free',
    name: 'Gratuita',
    badge: 'INICIAL',
    tagline: 'Ideal para estudiantes, docentes y profesionales que quieren presupuestar y organizar obras pequeÃ±as.',
    monthlyPrice: 0,
    annualPrice: 0,
    originalMonthlyPrice: null,
    discountBadge: null,
    periodLabel: 'Siempre gratis',
    subtextMonthly: 'Sin tarjeta bancaria ni vencimiento',
    subtextAnnual: 'Sin tarjeta bancaria ni vencimiento',
    limits: { projects: '2 proyectos activos', concepts: '100 conceptos/obra', members: '1 a 3 colaboradores', storage: '200 MB en nube' },
    features: [
      'Hasta 2 proyectos activos en el portal',
      'Hasta 100 conceptos por proyecto',
      'ColaboraciÃ³n de 1 a 3 (hasta 3 usuarios) por cuenta para trabajar en equipo',
      'Almacenamiento en Nube de 200 MB para proyectos y evidencias',
      'Espacio de 6 MB para importar catÃ¡logos maestros',
      'CatÃ¡logo Base, Matrices APU esenciales y ExplosiÃ³n de Insumos',
      'Copiado de conceptos con Matriz APU entre obras',
      'Importador universal (Excel, CSV, JSON y Opus)',
      'Calendario de Obra con Diagrama de Gantt bÃ¡sico',
      'Estimaciones, BitÃ¡cora y Control de Gastos bÃ¡sicos',
      'ImpresiÃ³n con logotipo y nombre de la aplicaciÃ³n',
      'IA EstÃ¡ndar: hasta 10 conceptos APU / mes'
    ]
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    badge: 'MÃS POPULAR',
    tagline: 'Para arquitectos independientes, contratistas, residentes y despachos en crecimiento.',
    monthlyPrice: 350,
    annualPrice: 280,
    originalMonthlyPrice: 799,
    originalAnnualPrice: 639,
    discountBadge: '56% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'FacturaciÃ³n mensual flexible â€¢ Cancela cuando quieras',
    subtextAnnual: 'Facturado anualmente ($3,360 MXN/aÃ±o â€¢ Ahorras 20%)',
    limits: { projects: '15 proyectos activos', concepts: '1,500 conceptos/obra', members: '10 usuarios incluidos', storage: '2 GB en nube' },
    features: [
      'Hasta 15 proyectos activos en la nube con sincronizaciÃ³n en tiempo real',
      'Hasta 1,500 lÃ­neas/conceptos por proyecto',
      'Hasta 10 usuarios incluidos bajo la misma suscripciÃ³n (invitados gratis)',
      'Almacenamiento en Nube de 2 GB con compresiÃ³n inteligente',
      'Espacio de 50 MB para catÃ¡logos maestros personalizados',
      'Calendario Gantt avanzado con Ruta CrÃ­tica, Financiero y Curva S',
      'Control de Compras, Gastos, Ã“rdenes y Dashboard ERP (Presupuesto vs. Real)',
      'BitÃ¡cora Digital Legal con firmas digitales y PDF inmutable',
      'ImpresiÃ³n profesional en todas las pestaÃ±as con tu propio logotipo',
      'Motor IA + CatÃ¡logo Inteligente: 1,500 conceptos APU / mes',
      'Cotizador Web en Vivo (Google Search): 70 consultas / mes'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    badge: 'EMPRESARIAL',
    tagline: 'Para empresas constructoras, gerencias de obra, despachos de ingenierÃ­a de costos y licitadores.',
    monthlyPrice: 950,
    annualPrice: 760,
    originalMonthlyPrice: 1799,
    originalAnnualPrice: 1439,
    discountBadge: '47% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'FacturaciÃ³n mensual flexible â€¢ Cancela cuando quieras',
    subtextAnnual: 'Facturado anualmente ($9,120 MXN/aÃ±o â€¢ Ahorras 20%)',
    limits: { projects: '50 proyectos activos', concepts: '3,500 conceptos/obra', members: '30 usuarios incluidos', storage: '5 GB de alta velocidad' },
    features: [
      'Hasta 50 proyectos activos en la nube con sincronizaciÃ³n en tiempo real',
      'Hasta 3,500 lÃ­neas/conceptos por proyecto (ideal para licitaciones)',
      'Hasta 30 usuarios incluidos con control granular de permisos por rol',
      'Almacenamiento en Nube de 5 GB de alta velocidad',
      'Espacio de 200 MB para grandes catÃ¡logos maestros (Opus, Neodata, Excel)',
      'Control de Compras, NÃ³mina/Rayas y Dashboard Ejecutivo con alertas',
      'BitÃ¡cora Digital Legal: libro completo foliado en PDF con firmas y archivo',
      'Marca blanca institucional para reportes ejecutivos',
      'GeneraciÃ³n APU con Motor IA: 3,500 conceptos / mes',
      'Cotizador Web en Vivo (Google Search): 200 consultas / mes'
    ]
  }
};

// =========================================================================
// ESPECIFICACIONES EXACTAS DE ADM_ARQ
// =========================================================================
export const ARQ_TIERS = {
  free: {
    id: 'free',
    name: 'Gratuita',
    badge: 'INICIAL',
    tagline: 'Ideal para conocer la plataforma y gestionar proyectos ejecutivos pequeÃ±os.',
    monthlyPrice: 0,
    annualPrice: 0,
    originalMonthlyPrice: null,
    discountBadge: null,
    periodLabel: 'Siempre gratis',
    subtextMonthly: 'Siempre gratis, sin tarjeta',
    subtextAnnual: 'Siempre gratis, sin tarjeta',
    limits: { projects: '2 proyectos ejecutivos', concepts: '15 entregables/obra', members: '2 colaboradores', storage: '50 MB en servidor' },
    features: [
      'Hasta 2 proyectos ejecutivos activos',
      'Hasta 15 conceptos entregables por obra',
      'Hasta 2 colaboradores incluidos bajo la misma cuenta',
      '50 MB en servidor (con compresor de imÃ¡genes para PDF a ~150 KB)',
      'Ãrbol de Alcances (planos arquitectÃ³nicos, memorias y estudios)',
      'CatÃ¡logo Base y Presupuesto de Honorarios esenciales',
      'Copiado de conceptos y partidas entre proyectos',
      'ExplosiÃ³n bÃ¡sica de insumos de proyecto',
      'Cronograma de PlaneaciÃ³n con Diagrama de Gantt bÃ¡sico',
      'ImpresiÃ³n institucional bÃ¡sica con carÃ¡tula de proyecto',
      'Subida de notas y cotizaciones bÃ¡sicas',
      'Importador universal (Excel, CSV, JSON y Opus)',
      'Vista de DÃ­a y Modo Nocturno incluidos'
    ]
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    badge: 'MÃS POPULAR',
    tagline: 'Para arquitectos, despachos y proyectistas que coordinan equipo y entregas pre-construcciÃ³n.',
    monthlyPrice: 199,
    annualPrice: 159,
    originalMonthlyPrice: 499,
    originalAnnualPrice: 499,
    discountBadge: '60% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'FacturaciÃ³n mensual flexible â€¢ Cancela cuando quieras',
    subtextAnnual: 'Facturado al aÃ±o: $1,908.00 MXN â€¢ Ahorras 20%',
    limits: { projects: '15 proyectos ejecutivos', concepts: '160 entregables/obra', members: '5 colaboradores', storage: '1,000 MB (1 GB)' },
    features: [
      '100% DE LAS FUNCIONES Y MÃ“DULOS ACTIVOS',
      'Hasta 15 proyectos ejecutivos activos',
      'Hasta 160 conceptos entregables por obra',
      'Hasta 5 colaboradores incluidos con roles (Editor, Escribir, Leer)',
      '1,000 MB (1 GB) de almacenamiento en servidor',
      'Seguimiento de Revisiones de Planos (Pendiente, En RevisiÃ³n, Aprobado)',
      'Calendario de PlaneaciÃ³n con Ruta CrÃ­tica (CPM) y Festivos oficiales',
      'Programa Financiero de Proyecto y Curva "S"',
      'MÃ³dulo de Cobranza de Honorarios con amortizaciÃ³n al 100% e IVA',
      'MÃ³dulo de Especialistas e IngenierÃ­as Externas',
      'Control de Contratos y Pagos a Especialistas',
      'Resumen Ejecutivo de Flujo de Caja (Cash Flow)',
      'Expediente Documental y FotogrÃ¡fico (facturas PDF/XML y cotizaciones)',
      'Chat de Proyecto por Partida y Plano en tiempo real',
      'Bloqueo y Seguridad de PestaÃ±as con ContraseÃ±a',
      'Logotipo y Membrete Oficial de tu despacho en PDF y Excel (sin marcas de agua)',
      'Importador universal avanzado (Excel, CSV, JSON, Opus y Neodata)'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    badge: 'EMPRESARIAL / MULTIDISCIPLINARIO',
    tagline: 'MÃ¡xima capacidad y escala para firmas de arquitectura, ingenierÃ­as y gerencias.',
    monthlyPrice: 499,
    annualPrice: 399,
    originalMonthlyPrice: 1099,
    originalAnnualPrice: 1099,
    discountBadge: '55% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'FacturaciÃ³n mensual flexible â€¢ Cancela cuando quieras',
    subtextAnnual: 'Facturado al aÃ±o: $4,788.00 MXN â€¢ Ahorras 20%',
    limits: { projects: '30 proyectos ejecutivos', concepts: '200 entregables/obra', members: '20 colaboradores', storage: '2,500 MB (2.5 GB)' },
    features: [
      '100% DE LAS FUNCIONES Y MÃ“DULOS ACTIVOS CON MÃXIMA ESCALA',
      'Hasta 30 proyectos ejecutivos activos',
      'Hasta 200 conceptos entregables por obra',
      'Hasta 20 colaboradores incluidos bajo la misma empresa',
      '2,500 MB (2.5 GB) de almacenamiento en servidor',
      'Seguimiento de Revisiones de Planos con firmas y peritajes',
      'Calendario Ejecutivo con Ruta CrÃ­tica, Curva "S" y suspensiones',
      'Programa Financiero de Proyecto avanzado',
      'Cobranza de Honorarios Multi-Etapa con retenciones fiscales',
      'GestiÃ³n Integral de Especialistas, Calculistas y DRO',
      'Control de Contratos, Anticipos y Saldos a Especialistas',
      'Flujo de Caja del Despacho (Cash Flow: Cobrado vs Pagado)',
      'Expediente Documental y Generadores FotogrÃ¡ficos masivos',
      'Chat Colaborativo en tiempo real por partida',
      'Bloqueo y Seguridad de PestaÃ±as con ContraseÃ±a',
      'PersonalizaciÃ³n corporativa total con firmas y membretes',
      'Importador y exportador institucional masivo (Opus y Neodata)',
      'Soporte prioritario y sincronizaciÃ³n respaldada en la nube'
    ]
  }
};

// =========================================================================
// ESPECIFICACIONES SUITE COMBO (ARQ + CONST)
// =========================================================================
export const COMBO_TIERS = {
  free: {
    id: 'free',
    name: 'Gratuita Combo',
    badge: 'INICIAL',
    tagline: 'Acceso inicial gratuito a ambas aplicaciones para estudiantes y profesionales independientes.',
    monthlyPrice: 0,
    annualPrice: 0,
    originalMonthlyPrice: null,
    discountBadge: null,
    periodLabel: 'Siempre gratis',
    subtextMonthly: 'Sin tarjeta bancaria ni compromiso',
    subtextAnnual: 'Sin tarjeta bancaria ni compromiso',
    limits: { projects: '2 Arq + 2 Const', concepts: '15 Arq / 100 Const', members: 'Hasta 3 usuarios', storage: '250 MB combinados' },
    features: [
      'Acceso simultÃ¡neo a arq.cubikar.app y const.cubikar.app',
      '2 proyectos ejecutivos en Arq + 2 proyectos de obra en Const',
      'Single Sign-On (1 solo correo y contraseÃ±a para ambas apps)',
      'Herramientas esenciales de diseÃ±o y catÃ¡logo base APU',
      'Diagramas de Gantt bÃ¡sicos en ambas aplicaciones',
      'Respaldo organizado y exportaciÃ³n bÃ¡sica'
    ]
  },
  plus: {
    id: 'plus',
    name: 'Plus Combo',
    badge: 'MEJOR VALOR',
    tagline: 'El paquete integral para despachos que proyectan y construyen sus propias obras.',
    monthlyPrice: 449,
    annualPrice: 359,
    originalMonthlyPrice: 1298, // $799 + $499
    originalAnnualPrice: 1138,
    discountBadge: '65% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'Ahorras $849 MXN/mes comprando ambas juntas',
    subtextAnnual: 'Facturado al aÃ±o: $4,308 MXN â€¢ Ahorras 20% adicional',
    limits: { projects: '15 Arq + 15 Const (30 totales)', concepts: '160 Arq / 1,500 Const', members: '10 usuarios compartidos', storage: '3,000 MB (3 GB) totales' },
    features: [
      'ACCESO ILIMITADO A TODAS LAS FUNCIONES PLUS DE AMBAS APPS',
      '15 proyectos de Arquitectura + 15 proyectos de ConstrucciÃ³n (30 totales)',
      '1,500 conceptos APU por obra y 160 entregables ejecutivos',
      'Hasta 10 usuarios de equipo con acceso a ambas plataformas',
      '3 GB de almacenamiento combinado en la nube',
      'Matrices APU completas con bases oficiales + Honorarios Cost-Plus',
      'BitÃ¡cora Digital Legal de Obra + Control de Especialistas y DRO',
      'Doble Ruta CrÃ­tica Gantt (DiseÃ±o Ejecutivo y EjecuciÃ³n de Obra)',
      'Flujo de Caja completo del despacho y Dashboard ERP de obra',
      'ExportaciÃ³n en 1 clic de respaldo completo estructurado en ZIP'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro Combo',
    badge: 'SUITE EMPRESARIAL',
    tagline: 'SoluciÃ³n empresarial total para firmas constructoras y despachos multidisciplinarios de alto volumen.',
    monthlyPrice: 1190,
    annualPrice: 950,
    originalMonthlyPrice: 2898, // $1,799 + $1,099
    originalAnnualPrice: 2538,
    discountBadge: '59% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'Ahorras $1,708 MXN/mes en la suite completa',
    subtextAnnual: 'Facturado al aÃ±o: $11,400 MXN â€¢ Ahorras 20% adicional',
    limits: { projects: '30 Arq + 50 Const (80 totales)', concepts: '200 Arq / 3,500 Const', members: '30 usuarios corporativos', storage: '7,500 MB (7.5 GB) alta velocidad' },
    features: [
      'MÃXIMA CAPACIDAD EN TODO EL ECOSISTEMA CUBIKAR',
      '30 proyectos ejecutivos en Arq + 50 proyectos de obra en Const (80 totales)',
      'Hasta 3,500 lÃ­neas APU por obra para licitaciones magnas',
      'Hasta 30 colaboradores corporativos con permisos por rol y proyecto',
      '7.5 GB de almacenamiento empresarial de alta velocidad',
      'Control de Contratos de Especialistas, DRO, NÃ³mina/Rayas y Alertas ERP',
      'BitÃ¡cora Digital Legal con firmas periciales y compilaciÃ³n inmutable',
      'Marca blanca total en reportes ejecutivos para clientes y dependencias',
      'IA de alto volumen: 3,500 conceptos APU + 200 bÃºsquedas Google en vivo',
      'Soporte corporativo prioritario y respaldo sincronizado'
    ]
  }
};

export async function redirectToStripeCheckout(product = 'const', planId = 'plus', cycle = 'monthly') {
  const savePendingProductIntent = (prod) => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('cubikar_pending_product_intent', prod);
      }
      if (typeof window !== 'undefined') {
        window.__cubikarPendingProductIntent = prod;
      }
    } catch (_) {}
  };

  const resolveActiveUser = async () => {
    const state = typeof window.getCurrentState === 'function' ? window.getCurrentState() : null;
    if (state?.user) return state.user;
    try {
      const sb = getSupabase();
      const sess = sb ? await sb.auth.getSession() : null;
      return sess?.data?.session?.user || null;
    } catch (_) {
      return null;
    }
  };

  if (CUBIKAR_SUB_TEST_MODE) {
    if (planId === 'pro') {
      alert('El Plan Pro estarÃ¡ habilitado al concluir la fase de pruebas. Durante este periodo de evaluaciÃ³n, tienes acceso gratuito al Plan Plus.');
      savePendingProductIntent(product);
      if (window.openAuthModal) window.openAuthModal('register');
      return;
    }
    // Para Plus o Free durante la prueba: registrarse o lanzar la app de inmediato si ya tiene sesiÃ³n
    const user = await resolveActiveUser();
    if (user) {
      alert('Â¡Tu cuenta tiene acceso Plus gratuito activo por la fase de pruebas! Abriendo la aplicaciÃ³n...');
      if (window.launchApp) window.launchApp(product);
    } else {
      savePendingProductIntent(product);
      if (window.openAuthModal) window.openAuthModal('register');
    }
    return;
  }

  if (planId === 'free') {
    const user = await resolveActiveUser();
    if (!user) {
      savePendingProductIntent(product);
      if (window.openAuthModal) window.openAuthModal('register');
      return;
    }
    alert('Tu cuenta incluye acceso gratuito inicial. Puedes comenzar de inmediato.');
    if (window.launchApp) window.launchApp(product);
    return;
  }

  try {
    const sb = getSupabase();
    if (!sb) {
      alert('Servicio de autenticaciÃ³n no inicializado. Recarga la pÃ¡gina e intÃ©ntalo de nuevo.');
      return;
    }
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) {
      alert('Inicia sesiÃ³n o regÃ­strate antes de continuar al pago en Stripe.');
      savePendingProductIntent(product);
      if (window.openAuthModal) window.openAuthModal('login');
      return;
    }

    const normalizedProduct = (product === 'arq' || product === 'combo') ? product : 'const';
    const normalizedCycle = cycle === 'annual' ? 'annual' : 'monthly';
    const cleanBase = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';

    const { data, error } = await sb.functions.invoke('create-checkout', {
      body: {
        plan: planId,
        planId,
        ciclo: normalizedCycle,
        billingCycle: normalizedCycle,
        producto: product,
        returnUrl: cleanBase || undefined,
        successUrl: cleanBase ? `${cleanBase}?pago=exitoso` : undefined,
        cancelUrl: cleanBase ? `${cleanBase}?pago=cancelado` : undefined
      }
    });

    if (!error && data?.url) {
      window.location.href = data.url;
      return;
    }

    alert(data?.error || error?.message || 'No se pudo crear la sesiÃ³n de pago en Stripe. IntÃ©ntalo de nuevo.');
  } catch (err) {
    alert(err?.message || 'Error al iniciar el pago con Stripe.');
  }
}

export async function openCustomerPortal() {
  try {
    const sb = getSupabase();
    if (!sb) {
      alert('Servicio de autenticaciÃ³n no inicializado.');
      return;
    }
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) {
      alert('Inicia sesiÃ³n para gestionar tu suscripciÃ³n y facturaciÃ³n en Stripe.');
      if (window.openAuthModal) window.openAuthModal('login');
      return;
    }

    const { data, error } = await sb.functions.invoke('create-portal-link', {
      body: { returnUrl: typeof window !== 'undefined' ? window.location.href : '' }
    });
    if (!error && data?.url) {
      window.location.href = data.url;
      return;
    }

    alert(data?.error || error?.message || 'No se encontrÃ³ una suscripciÃ³n de Stripe activa asociada a tu cuenta.');
  } catch (err) {
    alert(err?.message || 'No se pudo conectar con el portal de facturaciÃ³n de Stripe.');
  }
}
