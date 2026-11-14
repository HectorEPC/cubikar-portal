// assets/js/checkout.js
// Configuración exacta y completa de suscripciones de ADM_CONST y ADM_ARQ

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
    tagline: 'Ideal para estudiantes, docentes y profesionales que quieren presupuestar y organizar obras pequeñas.',
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
      'Colaboración de 1 a 3 (hasta 3 usuarios) por cuenta para trabajar en equipo',
      'Almacenamiento en Nube de 200 MB para proyectos y evidencias',
      'Espacio de 6 MB para importar catálogos maestros',
      'Catálogo Base, Matrices APU esenciales y Explosión de Insumos',
      'Copiado de conceptos con Matriz APU entre obras',
      'Importador universal (Excel, CSV, JSON y Opus)',
      'Calendario de Obra con Diagrama de Gantt básico',
      'Estimaciones, Bitácora y Control de Gastos básicos',
      'Impresión con logotipo y nombre de la aplicación',
      'IA Estándar: hasta 10 conceptos APU / mes'
    ]
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    badge: 'MÁS POPULAR',
    tagline: 'Para arquitectos independientes, contratistas, residentes y despachos en crecimiento.',
    monthlyPrice: 350,
    annualPrice: 280,
    originalMonthlyPrice: 799,
    originalAnnualPrice: 639,
    discountBadge: '56% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'Facturación mensual flexible • Cancela cuando quieras',
    subtextAnnual: 'Facturado anualmente ($3,360 MXN/año • Ahorras 20%)',
    limits: { projects: '15 proyectos activos', concepts: '1,500 conceptos/obra', members: '10 usuarios incluidos', storage: '2 GB en nube' },
    features: [
      'Hasta 15 proyectos activos en la nube con sincronización en tiempo real',
      'Hasta 1,500 líneas/conceptos por proyecto',
      'Hasta 10 usuarios incluidos bajo la misma suscripción (invitados gratis)',
      'Almacenamiento en Nube de 2 GB con compresión inteligente',
      'Espacio de 50 MB para catálogos maestros personalizados',
      'Calendario Gantt avanzado con Ruta Crítica, Financiero y Curva S',
      'Control de Compras, Gastos, Órdenes y Dashboard ERP (Presupuesto vs. Real)',
      'Bitácora Digital Legal con firmas digitales y PDF inmutable',
      'Impresión profesional en todas las pestañas con tu propio logotipo',
      'Motor IA + Catálogo Inteligente: 1,500 conceptos APU / mes',
      'Cotizador Web en Vivo (Google Search): 70 consultas / mes'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    badge: 'EMPRESARIAL',
    tagline: 'Para empresas constructoras, gerencias de obra, despachos de ingeniería de costos y licitadores.',
    monthlyPrice: 950,
    annualPrice: 760,
    originalMonthlyPrice: 1799,
    originalAnnualPrice: 1439,
    discountBadge: '47% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'Facturación mensual flexible • Cancela cuando quieras',
    subtextAnnual: 'Facturado anualmente ($9,120 MXN/año • Ahorras 20%)',
    limits: { projects: '50 proyectos activos', concepts: '3,500 conceptos/obra', members: '30 usuarios incluidos', storage: '5 GB de alta velocidad' },
    features: [
      'Hasta 50 proyectos activos en la nube con sincronización en tiempo real',
      'Hasta 3,500 líneas/conceptos por proyecto (ideal para licitaciones)',
      'Hasta 30 usuarios incluidos con control granular de permisos por rol',
      'Almacenamiento en Nube de 5 GB de alta velocidad',
      'Espacio de 200 MB para grandes catálogos maestros (Opus, Neodata, BIMSA)',
      'Control de Compras, Nómina/Rayas y Dashboard Ejecutivo con alertas',
      'Bitácora Digital Legal: libro completo foliado en PDF con firmas y archivo',
      'Marca blanca institucional para reportes ejecutivos',
      'Generación APU con Motor IA: 3,500 conceptos / mes',
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
    tagline: 'Ideal para conocer la plataforma y gestionar proyectos ejecutivos pequeños.',
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
      '50 MB en servidor (con compresor de imágenes para PDF a ~150 KB)',
      'Árbol de Alcances (planos arquitectónicos, memorias y estudios)',
      'Catálogo Base y Presupuesto de Honorarios esenciales',
      'Copiado de conceptos y partidas entre proyectos',
      'Explosión básica de insumos de proyecto',
      'Cronograma de Planeación con Diagrama de Gantt básico',
      'Impresión institucional básica con carátula de proyecto',
      'Subida de notas y cotizaciones básicas',
      'Importador universal (Excel, CSV, JSON y Opus)',
      'Vista de Día y Modo Nocturno incluidos'
    ]
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    badge: 'MÁS POPULAR',
    tagline: 'Para arquitectos, despachos y proyectistas que coordinan equipo y entregas pre-construcción.',
    monthlyPrice: 199,
    annualPrice: 159,
    originalMonthlyPrice: 499,
    originalAnnualPrice: 499,
    discountBadge: '60% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'Facturación mensual flexible • Cancela cuando quieras',
    subtextAnnual: 'Facturado al año: $1,908.00 MXN • Ahorras 20%',
    limits: { projects: '15 proyectos ejecutivos', concepts: '160 entregables/obra', members: '5 colaboradores', storage: '1,000 MB (1 GB)' },
    features: [
      '100% DE LAS FUNCIONES Y MÓDULOS ACTIVOS',
      'Hasta 15 proyectos ejecutivos activos',
      'Hasta 160 conceptos entregables por obra',
      'Hasta 5 colaboradores incluidos con roles (Editor, Escribir, Leer)',
      '1,000 MB (1 GB) de almacenamiento en servidor',
      'Seguimiento de Revisiones de Planos (Pendiente, En Revisión, Aprobado)',
      'Calendario de Planeación con Ruta Crítica (CPM) y Festivos oficiales',
      'Programa Financiero de Proyecto y Curva "S"',
      'Módulo de Cobranza de Honorarios con amortización al 100% e IVA',
      'Módulo de Especialistas e Ingenierías Externas',
      'Control de Contratos y Pagos a Especialistas',
      'Resumen Ejecutivo de Flujo de Caja (Cash Flow)',
      'Expediente Documental y Fotográfico (facturas PDF/XML y cotizaciones)',
      'Chat de Proyecto por Partida y Plano en tiempo real',
      'Bloqueo y Seguridad de Pestañas con Contraseña',
      'Logotipo y Membrete Oficial de tu despacho en PDF y Excel (sin marcas de agua)',
      'Importador universal avanzado (Excel, CSV, JSON, Opus y Neodata)'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    badge: 'EMPRESARIAL / MULTIDISCIPLINARIO',
    tagline: 'Máxima capacidad y escala para firmas de arquitectura, ingenierías y gerencias.',
    monthlyPrice: 499,
    annualPrice: 399,
    originalMonthlyPrice: 1099,
    originalAnnualPrice: 1099,
    discountBadge: '55% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'Facturación mensual flexible • Cancela cuando quieras',
    subtextAnnual: 'Facturado al año: $4,788.00 MXN • Ahorras 20%',
    limits: { projects: '30 proyectos ejecutivos', concepts: '200 entregables/obra', members: '20 colaboradores', storage: '2,500 MB (2.5 GB)' },
    features: [
      '100% DE LAS FUNCIONES Y MÓDULOS ACTIVOS CON MÁXIMA ESCALA',
      'Hasta 30 proyectos ejecutivos activos',
      'Hasta 200 conceptos entregables por obra',
      'Hasta 20 colaboradores incluidos bajo la misma empresa',
      '2,500 MB (2.5 GB) de almacenamiento en servidor',
      'Seguimiento de Revisiones de Planos con firmas y peritajes',
      'Calendario Ejecutivo con Ruta Crítica, Curva "S" y suspensiones',
      'Programa Financiero de Proyecto avanzado',
      'Cobranza de Honorarios Multi-Etapa con retenciones fiscales',
      'Gestión Integral de Especialistas, Calculistas y DRO',
      'Control de Contratos, Anticipos y Saldos a Especialistas',
      'Flujo de Caja del Despacho (Cash Flow: Cobrado vs Pagado)',
      'Expediente Documental y Generadores Fotográficos masivos',
      'Chat Colaborativo en tiempo real por partida',
      'Bloqueo y Seguridad de Pestañas con Contraseña',
      'Personalización corporativa total con firmas y membretes',
      'Importador y exportador institucional masivo (Opus y Neodata)',
      'Soporte prioritario y sincronización respaldada en la nube'
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
      'Acceso simultáneo a arq.cubikar.app y const.cubikar.app',
      '2 proyectos ejecutivos en Arq + 2 proyectos de obra en Const',
      'Single Sign-On (1 solo correo y contraseña para ambas apps)',
      'Herramientas esenciales de diseño y catálogo base APU',
      'Diagramas de Gantt básicos en ambas aplicaciones',
      'Respaldo organizado y exportación básica'
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
    subtextAnnual: 'Facturado al año: $4,308 MXN • Ahorras 20% adicional',
    limits: { projects: '15 Arq + 15 Const (30 totales)', concepts: '160 Arq / 1,500 Const', members: '10 usuarios compartidos', storage: '3,000 MB (3 GB) totales' },
    features: [
      'ACCESO ILIMITADO A TODAS LAS FUNCIONES PLUS DE AMBAS APPS',
      '15 proyectos de Arquitectura + 15 proyectos de Construcción (30 totales)',
      '1,500 conceptos APU por obra y 160 entregables ejecutivos',
      'Hasta 10 usuarios de equipo con acceso a ambas plataformas',
      '3 GB de almacenamiento combinado en la nube',
      'Matrices APU completas con bases BIMSA + Honorarios Cost-Plus',
      'Bitácora Digital Legal de Obra + Control de Especialistas y DRO',
      'Doble Ruta Crítica Gantt (Diseño Ejecutivo y Ejecución de Obra)',
      'Flujo de Caja completo del despacho y Dashboard ERP de obra',
      'Exportación en 1 clic de respaldo completo estructurado en ZIP'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro Combo',
    badge: 'SUITE EMPRESARIAL',
    tagline: 'Solución empresarial total para firmas constructoras y despachos multidisciplinarios de alto volumen.',
    monthlyPrice: 1190,
    annualPrice: 950,
    originalMonthlyPrice: 2898, // $1,799 + $1,099
    originalAnnualPrice: 2538,
    discountBadge: '59% OFF',
    periodLabel: '/ mes',
    subtextMonthly: 'Ahorras $1,708 MXN/mes en la suite completa',
    subtextAnnual: 'Facturado al año: $11,400 MXN • Ahorras 20% adicional',
    limits: { projects: '30 Arq + 50 Const (80 totales)', concepts: '200 Arq / 3,500 Const', members: '30 usuarios corporativos', storage: '7,500 MB (7.5 GB) alta velocidad' },
    features: [
      'MÁXIMA CAPACIDAD EN TODO EL ECOSISTEMA CUBIKAR',
      '30 proyectos ejecutivos en Arq + 50 proyectos de obra en Const (80 totales)',
      'Hasta 3,500 líneas APU por obra para licitaciones magnas',
      'Hasta 30 colaboradores corporativos con permisos por rol y proyecto',
      '7.5 GB de almacenamiento empresarial de alta velocidad',
      'Control de Contratos de Especialistas, DRO, Nómina/Rayas y Alertas ERP',
      'Bitácora Digital Legal con firmas periciales y compilación inmutable',
      'Marca blanca total en reportes ejecutivos para clientes y dependencias',
      'IA de alto volumen: 3,500 conceptos APU + 200 búsquedas Google en vivo',
      'Soporte corporativo prioritario y respaldo sincronizado'
    ]
  }
};

export async function redirectToStripeCheckout(product = 'const', planId = 'plus', cycle = 'monthly') {
  if (planId === 'free') {
    alert('Tu cuenta incluye acceso gratuito inicial. Puedes comenzar de inmediato.');
    if (window.launchApp) window.launchApp(product);
    return;
  }

  const productLinks = STRIPE_PAYMENT_LINKS[product] || STRIPE_PAYMENT_LINKS.const;
  const planLinks = productLinks[planId] || productLinks.plus;
  const targetUrl = planLinks[cycle] || planLinks.monthly;

  if (targetUrl) {
    window.location.href = targetUrl;
  } else {
    alert('Enlace de pago no disponible temporalmente. Inténtalo de nuevo.');
  }
}

export async function openCustomerPortal() {
  alert('Redirigiendo a tu panel de suscripciones...');
}
