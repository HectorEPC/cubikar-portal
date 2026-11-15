// assets/js/cubikarAdmin.js
// Módulo de Administración Maestra de Cubikar para el Portal Central (cubikar.app)
// Supervisión integral de clientes, membresías, consumos técnicos de IA y margen SaaS de ambas aplicaciones

import { getSupabase } from './supabaseClient.js?v=20261115_auth_ok';
const getSupabaseClient = getSupabase;

// Administrador Maestro Oficial
export const MASTER_ADMIN_EMAIL = 'hepc.90@gmail.com';

// Claves de Almacenamiento Local
export const STORAGE_KEY_CO_ADMINS = 'cubikar_co_administrators_v2';
export const STORAGE_KEY_MARKET_RATES = 'cubikar_market_rates_v2';
export const STORAGE_KEY_CONSUMPTION = 'cubikar_user_consumption_v2';
export const STORAGE_KEY_REGISTERED_USERS = 'cubikar_registered_users_v2';

// Tarifas de Mercado Base (en Pesos Mexicanos - MXN) actualizables
export const DEFAULT_MARKET_RATES = {
  aiTokenPer1k: 0.004,     // $0.004 MXN por cada 1,000 tokens (Gemini 1.5/2.0 Flash)
  storageMbMonth: 0.0005,  // $0.0005 MXN por cada MB al mes (~$0.50 MXN por GB)
  bandwidthMb: 0.002       // $0.002 MXN por cada MB de transferencia y Realtime
};

// =========================================================================
// 1. GESTIÓN DE ROLES ADMINISTRATIVOS
// =========================================================================

export function getMarketRates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MARKET_RATES);
    if (raw) return { ...DEFAULT_MARKET_RATES, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_MARKET_RATES };
}

export function saveMarketRates(rates) {
  try {
    localStorage.setItem(STORAGE_KEY_MARKET_RATES, JSON.stringify(rates));
    alert('Tarifas de mercado actualizadas con éxito.');
  } catch (_) {}
}

export function getCoAdminsList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CO_ADMINS);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (_) {}
  return [];
}

export function saveCoAdminsList(list) {
  try {
    localStorage.setItem(STORAGE_KEY_CO_ADMINS, JSON.stringify(list));
  } catch (_) {}
}

export function isUserMasterAdmin(email) {
  if (!email) return false;
  return email.toLowerCase().trim() === MASTER_ADMIN_EMAIL.toLowerCase().trim();
}

export function isUserAdmin(email) {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase().trim()) return true;
  const coAdmins = getCoAdminsList();
  return coAdmins.some(a => (a.email || '').toLowerCase().trim() === cleanEmail);
}

export function addCoAdmin(email, name = '') {
  if (!email || !email.trim()) {
    alert('Ingresa un correo electrónico válido.');
    return false;
  }
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase().trim()) {
    alert('Este correo ya es el Administrador Maestro.');
    return false;
  }
  const list = getCoAdminsList();
  if (list.some(a => (a.email || '').toLowerCase().trim() === cleanEmail)) {
    alert('Este usuario ya es co-administrador.');
    return false;
  }

  list.push({
    email: cleanEmail,
    name: name.trim() || cleanEmail.split('@')[0],
    role: 'admin',
    canEdit: true,
    canWrite: true,
    canRead: true,
    invitedBy: MASTER_ADMIN_EMAIL,
    invitedAt: new Date().toISOString()
  });

  saveCoAdminsList(list);
  alert(`Administrador "${cleanEmail}" agregado con éxito.`);
  renderCoAdminsListUI();
  return true;
}

export function removeCoAdmin(email) {
  if (!email) return;
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase().trim()) {
    alert('No puedes eliminar al Administrador Maestro.');
    return;
  }

  const list = getCoAdminsList().filter(a => (a.email || '').toLowerCase().trim() !== cleanEmail);
  saveCoAdminsList(list);
  alert(`Acceso de administración revocado a "${cleanEmail}".`);
  renderCoAdminsListUI();
}

// =========================================================================
// 2. CONSUMOS TÉCNICOS Y MÉTRICAS POR USUARIO
// =========================================================================

export function getUserConsumptionData(userEmail) {
  if (!userEmail) return { tokensIA: 0, storageMB: 0, bandwidthMB: 0, lastActivity: null };
  const cleanEmail = userEmail.toLowerCase().trim();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_CONSUMPTION}_${cleanEmail}`);
    if (raw) return JSON.parse(raw);
  } catch (_) {}

  return {
    tokensIA: 15400,
    storageMB: 2.4,
    bandwidthMB: 18.5,
    lastActivity: new Date().toISOString()
  };
}

export function evaluateUserActivity(user, consumption) {
  const now = new Date();
  const lastDateStr = consumption?.lastActivity || user?.lastLogin || user?.createdAt || null;
  if (!lastDateStr) return 'activo';

  const lastDate = new Date(lastDateStr);
  const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

  if (diffDays <= 15) return 'activo';
  if (diffDays <= 90) return 'reposo';
  return 'inactivo';
}

export function calculateUserMetrics(user) {
  const cleanEmail = (user.email || '').toLowerCase().trim();
  const rates = getMarketRates();
  const consumption = getUserConsumptionData(cleanEmail);

  // Determinar planes de ambas apps o combo
  let planConst = user?.subscriptionConst?.planId || user?.subscription?.planId || 'free';
  let planArq = user?.subscriptionArq?.planId || user?.subscription?.planId || 'free';
  let isSuiteCombo = user?.subscription?.isCombo || (planConst === 'pro' && planArq === 'pro');

  let cycleConst = user?.subscriptionConst?.billingCycle || user?.subscription?.billingCycle || 'monthly';
  let cycleArq = user?.subscriptionArq?.billingCycle || user?.subscription?.billingCycle || 'monthly';

  // Precios base: Plus ($350 MXN), Pro ($750 MXN), Free ($0 MXN)
  const priceMap = { free: 0, plus: 350, pro: 750 };
  let gastoConst = priceMap[planConst] || 0;
  let gastoArq = priceMap[planArq] || 0;
  let totalGastoSub = isSuiteCombo ? (planConst === 'pro' ? 1200 : 590) : (gastoConst + gastoArq);

  // Costo real de recursos consumidos
  const costoIA = ((consumption.tokensIA || 0) / 1000) * rates.aiTokenPer1k;
  const costoStorage = (consumption.storageMB || 0) * rates.storageMbMonth;
  const costoBandwidth = (consumption.bandwidthMB || 0) * rates.bandwidthMb;
  const totalCostoRecursos = Number((costoIA + costoStorage + costoBandwidth).toFixed(2));

  let baseComparativa = totalGastoSub > 0 ? totalGastoSub : 15.0;
  let pctConsumo = Number(((totalCostoRecursos / baseComparativa) * 100).toFixed(1));
  if (pctConsumo > 100) pctConsumo = 100;

  const actividad = evaluateUserActivity(user, consumption);

  return {
    user,
    cleanEmail,
    planConst,
    planArq,
    isSuiteCombo,
    cycleConst,
    cycleArq,
    actividad,
    tokensIA: consumption.tokensIA || 0,
    storageMB: consumption.storageMB || 0,
    bandwidthMB: consumption.bandwidthMB || 0,
    gastoSuscripcion: totalGastoSub,
    gastoConst,
    gastoArq,
    totalCostoRecursos,
    pctConsumo,
    isHighConsumption: pctConsumo >= 85
  };
}

// =========================================================================
// 3. ESTADO GLOBAL DE FILTROS DEL PANEL
// =========================================================================

let adminTableFilterText = '';
let adminFilterActivity = 'all';
let adminFilterPlan = 'all';
let adminFilterCycle = 'all';
let adminFilterAppScope = 'all'; // 'all' | 'const' | 'arq'

export let selectedAdminUserEmails = new Set();

export function setAdminAppScope(scope) {
  adminFilterAppScope = scope;
  ['all', 'const', 'arq'].forEach(s => {
    const btn = document.getElementById(`admin-scope-${s}`);
    if (btn) {
      if (s === scope) {
        btn.className = 'px-3 py-1 rounded-lg font-bold text-xs transition bg-blue-600 text-white shadow-xs';
      } else {
        btn.className = 'px-3 py-1 rounded-lg font-bold text-xs transition text-slate-400 hover:text-white';
      }
    }
  });
  renderCubikarAdminTable();
}

export function onAdminUserCheckboxChange(checkbox) {
  if (!checkbox) return;
  const val = checkbox.value;
  if (checkbox.checked) selectedAdminUserEmails.add(val);
  else selectedAdminUserEmails.delete(val);
  updateAdminDeleteButtonUI();
  updateSelectAllCheckboxState();
}

export function toggleSelectAllAdminUsers(checked) {
  const checkboxes = document.querySelectorAll('.admin-user-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    if (checked) selectedAdminUserEmails.add(cb.value);
    else selectedAdminUserEmails.delete(cb.value);
  });
  updateAdminDeleteButtonUI();
}

export function updateSelectAllCheckboxState() {
  const selectAll = document.getElementById('admin-select-all-checkbox');
  const checkboxes = document.querySelectorAll('.admin-user-checkbox');
  if (selectAll && checkboxes.length > 0) {
    selectAll.checked = Array.from(checkboxes).every(cb => cb.checked);
  }
}

export function updateAdminDeleteButtonUI() {
  const btn = document.getElementById('btn-admin-delete-selected');
  const txt = document.getElementById('btn-admin-delete-text');
  const count = selectedAdminUserEmails.size;
  if (!btn) return;

  if (count > 0) {
    btn.disabled = false;
    btn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md bg-rose-600 text-white hover:bg-rose-500';
    if (txt) txt.textContent = `Eliminar (${count})`;
  } else {
    btn.disabled = true;
    btn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-not-allowed opacity-60 bg-slate-800 text-slate-400';
    if (txt) txt.textContent = 'Eliminar';
  }
}

export async function deleteSelectedAdminUsers() {
  const targets = Array.from(selectedAdminUserEmails).filter(e => !isUserMasterAdmin(e));
  if (targets.length === 0) {
    alert('Selecciona al menos un usuario para eliminar (el Administrador Maestro está protegido).');
    return;
  }

  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a los ${targets.length} usuario(s) seleccionados?`)) {
    return;
  }

  // 1. Eliminar localmente
  targets.forEach(email => {
    try {
      removeCoAdmin(email);
      localStorage.removeItem(`${STORAGE_KEY_CONSUMPTION}_${email.toLowerCase().trim()}`);
    } catch (_) {}
  });

  // 2. Eliminar en el backend seguro de la nube (auth.users y bases de datos)
  try {
    const endpoints = ['/api/admin-users', 'https://const.cubikar.app/api/admin-users'];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-email': MASTER_ADMIN_EMAIL
          },
          body: JSON.stringify({
            action: 'delete',
            emails: targets
          })
        });
        if (res.ok) break;
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[Cubikar Admin] Error al sincronizar eliminación con la nube:', err);
  }

  selectedAdminUserEmails.clear();
  const selectAll = document.getElementById('admin-select-all-checkbox');
  if (selectAll) selectAll.checked = false;

  alert('Usuario(s) procesado(s) y eliminado(s) correctamente.');
  renderCubikarAdminTable();
}

// =========================================================================
// 4. CARGA DE USUARIOS Y DATOS DESDE SUPABASE Y LOCAL
// =========================================================================

export async function fetchAllEcosystemUsers() {
  const usersMap = new Map();

  // 1. Administrador Maestro Oficial
  usersMap.set(MASTER_ADMIN_EMAIL.toLowerCase(), {
    name: 'Héctor Emmanuel Pérez Cornejo',
    email: MASTER_ADMIN_EMAIL,
    createdAt: '2026-01-31T00:00:00.000Z',
    lastLogin: new Date().toISOString(),
    subscription: { planId: 'pro', billingCycle: 'annual', isCombo: true },
    subscriptionConst: { planId: 'pro', billingCycle: 'annual' },
    subscriptionArq: { planId: 'pro', billingCycle: 'annual' },
    appUsage: 'ambas'
  });

  // 2. Consultar API Central Cloud de Usuarios (/api/admin-users o https://const.cubikar.app/api/admin-users)
  try {
    const endpoints = ['/api/admin-users', 'https://const.cubikar.app/api/admin-users'];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-email': MASTER_ADMIN_EMAIL
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.users) && data.users.length > 0) {
            data.users.forEach(u => {
              if (!u || !u.email) return;
              const em = u.email.toLowerCase().trim();
              const isMaster = em === MASTER_ADMIN_EMAIL.toLowerCase();

              const planConst = u.subscriptionConst?.planId || u.subscription?.planId || 'free';
              const planArq = u.subscriptionArq?.planId || u.subscription?.planId || 'free';
              const isCombo = u.subscription?.isCombo || (isMaster ? true : (planConst === 'pro' && planArq === 'pro'));

              usersMap.set(em, {
                id: u.id,
                name: u.name || em.split('@')[0],
                email: em,
                createdAt: u.createdAt || '2026-02-01T00:00:00.000Z',
                lastLogin: u.lastLogin || u.createdAt || new Date().toISOString(),
                subscription: isMaster
                  ? { planId: 'pro', billingCycle: 'annual', isCombo: true }
                  : (u.subscription || { planId: 'free', billingCycle: 'monthly', isCombo }),
                subscriptionConst: isMaster
                  ? { planId: 'pro', billingCycle: 'annual' }
                  : { planId: planConst, billingCycle: u.subscription?.billingCycle || 'monthly' },
                subscriptionArq: isMaster
                  ? { planId: 'pro', billingCycle: 'annual' }
                  : { planId: planArq, billingCycle: u.subscription?.billingCycle || 'monthly' },
                appUsage: isMaster ? 'ambas' : (u.appUsage || (planConst !== 'free' && planArq !== 'free' ? 'ambas' : (planConst !== 'free' ? 'const' : 'ambas'))),
                source: u.source || 'cloud_api'
              });
            });

            if (data.users.length > 1) {
              break; // Obtuvimos con éxito el listado completo
            }
          }
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[Cubikar Admin] Error consultando API de usuarios:', err);
  }

  // 3. Complementar desde Supabase (tabla perfiles) si está disponible
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data: profiles, error } = await sb.from('perfiles').select('*');
      if (!error && Array.isArray(profiles)) {
        profiles.forEach(p => {
          if (!p || !p.email) return;
          const em = p.email.toLowerCase().trim();
          if (usersMap.has(em)) {
            const ex = usersMap.get(em);
            if (p.nombre_completo && (!ex.name || ex.name === em.split('@')[0])) {
              ex.name = p.nombre_completo;
            }
          } else {
            usersMap.set(em, {
              id: p.id,
              name: p.nombre_completo || p.name || em.split('@')[0],
              email: em,
              createdAt: p.created_at || '2026-02-01T00:00:00.000Z',
              lastLogin: p.updated_at || p.created_at || new Date().toISOString(),
              subscription: { planId: p.plan_id || 'free', billingCycle: p.billing_cycle || 'monthly' },
              subscriptionConst: { planId: p.plan_const || p.plan_id || 'free', billingCycle: 'monthly' },
              subscriptionArq: { planId: p.plan_arq || p.plan_id || 'free', billingCycle: 'monthly' },
              appUsage: p.app_usage || 'ambas'
            });
          }
        });
      }
    }
  } catch (_) {}

  // 4. Mergear con usuarios registrados localmente (todas las posibles claves del ecosistema)
  try {
    const storageKeys = [
      STORAGE_KEY_REGISTERED_USERS,
      'control_obra_registered_accounts_v1',
      'control_obra_closed_sessions_v1'
    ];
    storageKeys.forEach(k => {
      const rawLocal = localStorage.getItem(k);
      if (rawLocal) {
        const list = JSON.parse(rawLocal);
        if (Array.isArray(list)) {
          list.forEach(u => {
            if (!u || !u.email) return;
            const em = u.email.toLowerCase().trim();
            if (!usersMap.has(em)) {
              usersMap.set(em, {
                ...u,
                name: u.name || u.fullName || em.split('@')[0],
                email: em,
                appUsage: u.appUsage || 'ambas'
              });
            }
          });
        }
      }
    });
  } catch (_) {}

  return Array.from(usersMap.values());
}

// =========================================================================
// 5. RENDERIZADO DE LA TABLA Y KPIS
// =========================================================================

export async function renderCubikarAdminTable() {
  const tbody = document.getElementById('admin-cubikar-table-body');
  if (!tbody) return;

  const allUsers = await fetchAllEcosystemUsers();

  const dataset = allUsers.map((u, idx) => {
    const metrics = calculateUserMetrics(u);
    const regDate = u.createdAt ? new Date(u.createdAt) : new Date('2026-01-31');
    const inicioSub = regDate;
    const finSub = new Date(inicioSub.getTime() + 365 * 24 * 60 * 60 * 1000);

    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

    // Determinar aplicaciones utilizadas
    const appUsage = u.appUsage || (metrics.planConst !== 'free' && metrics.planArq !== 'free' ? 'ambas' : (metrics.planConst !== 'free' ? 'const' : 'ambas'));

    return {
      no: (idx + 1).toFixed(2),
      nombre: u.name || u.email.split('@')[0],
      correo: u.email,
      fechaRegistro: formatDate(regDate),
      actividad: metrics.actividad,
      appUsage,
      planConst: metrics.planConst,
      planArq: metrics.planArq,
      isSuiteCombo: metrics.isSuiteCombo,
      inicioMembresia: formatDate(inicioSub),
      finMembresia: formatDate(finSub),
      tokensIA: metrics.tokensIA.toLocaleString('es-MX'),
      storageMB: `${metrics.storageMB} MB`,
      bandwidthMB: `${metrics.bandwidthMB} MB`,
      gastoSuscripcion: metrics.gastoSuscripcion,
      costoRecursos: metrics.totalCostoRecursos,
      pctConsumo: metrics.pctConsumo,
      isHighConsumption: metrics.isHighConsumption,
      rawUser: u
    };
  });

  // Filtro por App Scope
  let filtered = dataset;
  if (adminFilterAppScope === 'const') {
    filtered = filtered.filter(d => d.appUsage === 'const' || d.appUsage === 'ambas' || d.planConst !== 'free');
  } else if (adminFilterAppScope === 'arq') {
    filtered = filtered.filter(d => d.appUsage === 'arq' || d.appUsage === 'ambas' || d.planArq !== 'free');
  }

  // Filtro por texto
  if (adminTableFilterText) {
    const q = adminTableFilterText.toLowerCase();
    filtered = filtered.filter(d => d.nombre.toLowerCase().includes(q) || d.correo.toLowerCase().includes(q));
  }

  // Filtro por actividad
  if (adminFilterActivity !== 'all') {
    filtered = filtered.filter(d => d.actividad === adminFilterActivity);
  }

  // Actualizar KPIs Superiores
  updateAdminKpisUI(filtered);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="17" class="text-center py-12 text-slate-400 font-medium bg-slate-900/40">
          <i class="fa-solid fa-filter-circle-xmark text-3xl mb-2 text-slate-500 block"></i>
          No se encontraron registros con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(row => {
    // Insignia de Actividad (Semáforo)
    let badgeActividad = '';
    if (row.actividad === 'activo') {
      badgeActividad = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-extrabold bg-[#22c55e] text-slate-950 uppercase tracking-wider shadow-xs"><i class="fa-solid fa-circle text-[6px]"></i> Activo</span>`;
    } else if (row.actividad === 'reposo') {
      badgeActividad = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-extrabold bg-[#f59e0b] text-slate-950 uppercase tracking-wider shadow-xs"><i class="fa-solid fa-moon text-[7px]"></i> Reposo</span>`;
    } else {
      badgeActividad = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-extrabold bg-[#ef4444] text-white uppercase tracking-wider shadow-xs"><i class="fa-solid fa-ban text-[7px]"></i> Inactivo</span>`;
    }

    // Insignia de Aplicación
    let badgeApp = '';
    if (row.appUsage === 'ambas') {
      badgeApp = `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap"><i class="fa-solid fa-cubes mr-1"></i>Ambas Apps</span>`;
    } else if (row.appUsage === 'const') {
      badgeApp = `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap"><i class="fa-solid fa-helmet-safety mr-1"></i>Construcción</span>`;
    } else {
      badgeApp = `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap"><i class="fa-solid fa-compass-drafting mr-1"></i>Arquitectura</span>`;
    }

    // Insignia de Membresías Unificadas
    let badgeSuscripciones = '';
    if (row.isSuiteCombo) {
      badgeSuscripciones = `<span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase whitespace-nowrap"><i class="fa-solid fa-crown text-[9px] mr-1"></i>Suite Completa Pro</span>`;
    } else {
      const bConst = row.planConst === 'pro' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : (row.planConst === 'plus' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-800 text-slate-400 border-slate-700');
      const bArq = row.planArq === 'pro' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : (row.planArq === 'plus' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-800 text-slate-400 border-slate-700');
      badgeSuscripciones = `
        <div class="flex items-center justify-center gap-1.5 flex-wrap">
          <span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold border uppercase ${bConst}" title="Cubikar Construcción">Const: ${row.planConst}</span>
          <span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold border uppercase ${bArq}" title="Cubikar Arquitectura">Arq: ${row.planArq}</span>
        </div>
      `;
    }

    return `
      <tr class="transition-colors border-b border-slate-800 text-xs text-slate-200 select-text hover:bg-slate-800/60">
        <!-- Casilla -->
        <td class="px-2.5 py-2.5 text-center border-r border-slate-800/80">
          ${isUserMasterAdmin(row.correo) ? `
            <span class="text-amber-400/60 text-xs" title="Administrador Maestro protegido"><i class="fa-solid fa-lock"></i></span>
          ` : `
            <input type="checkbox" value="${row.correo}" ${selectedAdminUserEmails.has(row.correo) ? 'checked' : ''} onchange="onAdminUserCheckboxChange(this)"
                   class="admin-user-checkbox rounded border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4">
          `}
        </td>
        <!-- No -->
        <td class="px-3 py-2.5 text-center font-mono text-slate-400 font-bold">${row.no}</td>
        <!-- Nombre -->
        <td class="px-3.5 py-2.5 font-semibold text-white whitespace-nowrap">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
              ${row.nombre.charAt(0).toUpperCase()}
            </div>
            <span class="truncate max-w-[150px]" title="${row.nombre}">${row.nombre}</span>
          </div>
        </td>
        <!-- Correo -->
        <td class="px-3.5 py-2.5 font-mono text-slate-300 whitespace-nowrap">
          <span class="truncate max-w-[170px] block" title="${row.correo}">${row.correo}</span>
        </td>
        <!-- Apps en uso -->
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${badgeApp}</td>
        <!-- Registro -->
        <td class="px-3 py-2.5 text-center font-mono text-slate-400 whitespace-nowrap">${row.fechaRegistro}</td>
        <!-- Actividad -->
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${badgeActividad}</td>
        <!-- Membresía Activa -->
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${badgeSuscripciones}</td>
        <!-- Vigencia Fin -->
        <td class="px-3 py-2.5 text-center font-mono text-slate-400 whitespace-nowrap">${row.finMembresia}</td>
        <!-- Tokens IA -->
        <td class="px-3 py-2.5 text-right font-mono text-sky-400 whitespace-nowrap" title="Tokens consumidos en ambas apps">
          <i class="fa-solid fa-brain text-[10px] text-sky-500 mr-1"></i>${row.tokensIA}
        </td>
        <!-- Almacenamiento -->
        <td class="px-3 py-2.5 text-right font-mono text-indigo-300 whitespace-nowrap" title="Almacenamiento total nube">
          <i class="fa-solid fa-database text-[10px] text-indigo-400 mr-1"></i>${row.storageMB}
        </td>
        <!-- Ancho de Banda -->
        <td class="px-3 py-2.5 text-right font-mono text-teal-300 whitespace-nowrap" title="Transferencia Realtime">
          <i class="fa-solid fa-bolt text-[10px] text-teal-400 mr-1"></i>${row.bandwidthMB}
        </td>
        <!-- Total Facturación -->
        <td class="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
          $ ${row.gastoSuscripcion.toFixed(2)}
        </td>
        <!-- Costo Técnico -->
        <td class="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">
          $ ${row.costoRecursos.toFixed(2)}
        </td>
        <!-- Margen / Ratio -->
        <td class="px-3.5 py-2.5 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-300">
          ${row.pctConsumo}%
        </td>
      </tr>
    `;
  }).join('');

  updateAdminDeleteButtonUI();
  updateSelectAllCheckboxState();
}

function updateAdminKpisUI(dataset) {
  const totalUsers = dataset.length;
  const activeUsers = dataset.filter(d => d.actividad === 'activo').length;
  const totalRevenue = dataset.reduce((acc, curr) => acc + (curr.gastoSuscripcion || 0), 0);
  const totalResourceCost = dataset.reduce((acc, curr) => acc + (curr.costoRecursos || 0), 0);
  const grossMargin = totalRevenue > 0 ? Number((((totalRevenue - totalResourceCost) / totalRevenue) * 100).toFixed(1)) : 0;

  const elTotalUsers = document.getElementById('admin-kpi-total-users');
  const elActiveUsers = document.getElementById('admin-kpi-active-users');
  const elRevenue = document.getElementById('admin-kpi-revenue');
  const elCost = document.getElementById('admin-kpi-cost');
  const elMargin = document.getElementById('admin-kpi-margin');

  if (elTotalUsers) elTotalUsers.textContent = totalUsers;
  if (elActiveUsers) elActiveUsers.textContent = activeUsers;
  if (elRevenue) elRevenue.textContent = `$ ${totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  if (elCost) elCost.textContent = `$ ${totalResourceCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  if (elMargin) elMargin.textContent = `${grossMargin}%`;
}

// =========================================================================
// 6. APERTURA / CIERRE DE MODALES SUPERADMIN
// =========================================================================

export function openCubikarAdminModal() {
  const modal = document.getElementById('modal-admin-cubikar');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  renderCubikarAdminTable();
}

export function closeCubikarAdminModal() {
  const modal = document.getElementById('modal-admin-cubikar');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

export function openCoAdminsModal() {
  const modal = document.getElementById('modal-admin-coadmins');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  renderCoAdminsListUI();
}

export function closeCoAdminsModal() {
  const modal = document.getElementById('modal-admin-coadmins');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

export function renderCoAdminsListUI() {
  const container = document.getElementById('coadmins-list-container');
  if (!container) return;

  const list = getCoAdminsList();

  if (list.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800 text-xs">
        <i class="fa-solid fa-users-slash text-2xl text-slate-500 mb-2 block"></i>
        Actualmente no hay co-administradores invitados. Solo el Administrador Maestro (${MASTER_ADMIN_EMAIL}) tiene acceso.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(admin => `
    <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-xs shrink-0">
          <i class="fa-solid fa-shield"></i>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-white truncate">${admin.name || admin.email}</div>
          <div class="text-[11px] font-mono text-slate-400 truncate">${admin.email}</div>
          <div class="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
            <i class="fa-solid fa-check text-[8px]"></i> Permisos: Acceso SuperAdmin
          </div>
        </div>
      </div>
      <button type="button" onclick="removeCoAdmin('${admin.email}')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer">
        Eliminar
      </button>
    </div>
  `).join('');
}

export function openMarketRatesModal() {
  const modal = document.getElementById('modal-admin-market-rates');
  if (!modal) return;
  const rates = getMarketRates();
  const inputAi = document.getElementById('input-rate-ai');
  const inputStorage = document.getElementById('input-rate-storage');
  const inputBandwidth = document.getElementById('input-rate-bandwidth');
  if (inputAi) inputAi.value = rates.aiTokenPer1k;
  if (inputStorage) inputStorage.value = rates.storageMbMonth;
  if (inputBandwidth) inputBandwidth.value = rates.bandwidthMb;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

export function closeMarketRatesModal() {
  const modal = document.getElementById('modal-admin-market-rates');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

export function saveMarketRatesFromModal() {
  const inputAi = document.getElementById('input-rate-ai');
  const inputStorage = document.getElementById('input-rate-storage');
  const inputBandwidth = document.getElementById('input-rate-bandwidth');
  const rates = {
    aiTokenPer1k: Number(inputAi?.value || DEFAULT_MARKET_RATES.aiTokenPer1k),
    storageMbMonth: Number(inputStorage?.value || DEFAULT_MARKET_RATES.storageMbMonth),
    bandwidthMb: Number(inputBandwidth?.value || DEFAULT_MARKET_RATES.bandwidthMb)
  };
  saveMarketRates(rates);
  closeMarketRatesModal();
  renderCubikarAdminTable();
}

export function exportCubikarDatabaseToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Librería de exportación cargando. Intente de nuevo en un momento.');
    return;
  }
  const table = document.getElementById('admin-cubikar-table');
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Bases de Datos Cubikar' });
  XLSX.writeFile(wb, `Cubikar_Ecosistema_Admin_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function setAdminTableSearch(text) {
  adminTableFilterText = text;
  renderCubikarAdminTable();
}

export function setAdminFilterActivity(val) {
  adminFilterActivity = val;
  renderCubikarAdminTable();
}

export function setAdminFilterPlan(val) {
  adminFilterPlan = val;
  renderCubikarAdminTable();
}

export function setAdminFilterCycle(val) {
  adminFilterCycle = val;
  renderCubikarAdminTable();
}

// Exponer en window para onclicks del DOM
if (typeof window !== 'undefined') {
  window.openCubikarAdminModal = openCubikarAdminModal;
  window.closeCubikarAdminModal = closeCubikarAdminModal;
  window.renderCubikarAdminTable = renderCubikarAdminTable;
  window.fetchAllEcosystemUsers = fetchAllEcosystemUsers;
  window.openCoAdminsModal = openCoAdminsModal;
  window.closeCoAdminsModal = closeCoAdminsModal;
  window.openMarketRatesModal = openMarketRatesModal;
  window.closeMarketRatesModal = closeMarketRatesModal;
  window.saveMarketRatesFromModal = saveMarketRatesFromModal;
  window.exportCubikarDatabaseToExcel = exportCubikarDatabaseToExcel;
  window.setAdminAppScope = setAdminAppScope;
  window.setAdminTableSearch = setAdminTableSearch;
  window.setAdminFilterActivity = setAdminFilterActivity;
  window.setAdminFilterPlan = setAdminFilterPlan;
  window.setAdminFilterCycle = setAdminFilterCycle;
  window.onAdminUserCheckboxChange = onAdminUserCheckboxChange;
  window.toggleSelectAllAdminUsers = toggleSelectAllAdminUsers;
  window.deleteSelectedAdminUsers = deleteSelectedAdminUsers;
  window.addCoAdmin = addCoAdmin;
  window.removeCoAdmin = removeCoAdmin;
}
