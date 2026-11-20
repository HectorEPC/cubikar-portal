// assets/js/cubikarAdmin.js
// Módulo de Administración Maestra de Cubikar para el Portal Central (cubikar.app)
// Supervisión integral de clientes, membresías, consumos técnicos de IA y margen SaaS de ambas aplicaciones

import { getSupabase } from './supabaseClient.js?v=20261119_cf43';
import { CONST_TIERS, ARQ_TIERS, COMBO_TIERS } from './checkout.js?v=20261119_cf43';
import { loadXLSX } from './libLoader.js?v=20261119_cf43';
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

function escapeAdminHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function escapeAdminAttr(value) {
  return escapeAdminHtml(value);
}

function escapeAdminJsString(value) {
  return escapeAdminAttr(
    String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
  );
}

async function getAdminSessionContext() {
  try {
    const sb = getSupabaseClient();
    if (sb?.auth?.getSession) {
      const { data: sessionData } = await sb.auth.getSession();
      const session = sessionData?.session || null;
      return {
        sb,
        token: session?.access_token || '',
        email: (session?.user?.email || '').toLowerCase().trim()
      };
    }
    return { sb, token: '', email: '' };
  } catch {
    return { sb: null, token: '', email: '' };
  }
}

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

async function syncCoAdminToBackend(email, name, isCoAdmin) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!cleanEmail || cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase()) return false;

  const { sb, token, email: callerEmail } = await getAdminSessionContext();
  if (token) {
    const endpoints = ['/api/admin-users', 'https://const.cubikar.app/api/admin-users'];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'set_coadmin',
            email: cleanEmail,
            name: String(name || '').trim() || cleanEmail.split('@')[0],
            isCoAdmin: Boolean(isCoAdmin)
          })
        });
        if (res.ok) return true;
      } catch (_) {}
    }
  }

  // Respaldo directo en Supabase cubikar_registros si es el Administrador Maestro
  try {
    if (sb && isUserMasterAdmin(callerEmail)) {
      const { data: existingRows } = await sb
        .from('cubikar_registros')
        .select('email, nombre, metadata')
        .ilike('email', cleanEmail)
        .limit(1);
      const prevRow = Array.isArray(existingRows) ? existingRows[0] : null;
      const prevMeta = (prevRow?.metadata && typeof prevRow.metadata === 'object') ? prevRow.metadata : {};
      const nextMeta = {
        ...prevMeta,
        is_co_admin: Boolean(isCoAdmin),
        isCoAdmin: Boolean(isCoAdmin),
        updated_by: callerEmail || MASTER_ADMIN_EMAIL,
        updated_at: new Date().toISOString()
      };
      const { error } = await sb.from('cubikar_registros').upsert({
        email: cleanEmail,
        nombre: prevRow?.nombre || String(name || '').trim() || cleanEmail.split('@')[0],
        metadata: nextMeta
      }, { onConflict: 'email' });
      if (!error) return true;
    }
  } catch (_) {}

  return false;
}

let verifiedAdminState = { email: '', isAdmin: false };

export async function hydrateCoAdminsFromCloud() {
  const { token, email } = await getAdminSessionContext();
  if (verifiedAdminState.email !== email) {
    verifiedAdminState = { email, isAdmin: false };
  }
  if (!token) {
    saveCoAdminsList([]);
    renderCoAdminsListUI();
    return [];
  }

  const endpoints = ['/api/admin-users?check_self=1', 'https://const.cubikar.app/api/admin-users?check_self=1'];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.isAdmin === true) {
        verifiedAdminState = { email, isAdmin: true };
        const coAdmins = Array.isArray(data.coAdmins) ? data.coAdmins : [];
        saveCoAdminsList(coAdmins);
        renderCoAdminsListUI();
        return coAdmins;
      }
      if (data?.isAdmin === false) {
        verifiedAdminState = { email, isAdmin: false };
        saveCoAdminsList([]);
        renderCoAdminsListUI();
        return [];
      }
    } catch (_) {}
  }

  return getCoAdminsList();
}

export function isUserMasterAdmin(email) {
  if (!email) return false;
  return email.toLowerCase().trim() === MASTER_ADMIN_EMAIL.toLowerCase().trim();
}

export function isUserAdmin(email) {
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!cleanEmail) return false;
  if (isUserMasterAdmin(cleanEmail)) return true;
  return verifiedAdminState.isAdmin && verifiedAdminState.email === cleanEmail;
}

function removeCoAdminLocally(cleanEmail) {
  saveCoAdminsList(getCoAdminsList().filter(a => (a.email || '').toLowerCase().trim() !== cleanEmail));
  renderCoAdminsListUI();
}

export async function addCoAdmin(email, name = '') {
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

  const cleanName = String(name || '').trim() || cleanEmail.split('@')[0];
  list.push({
    email: cleanEmail,
    name: cleanName,
    role: 'admin',
    canEdit: true,
    canWrite: true,
    canRead: true,
    invitedBy: MASTER_ADMIN_EMAIL,
    invitedAt: new Date().toISOString()
  });
  saveCoAdminsList(list);
  renderCoAdminsListUI();

  const synced = await syncCoAdminToBackend(cleanEmail, cleanName, true);
  if (!synced) {
    removeCoAdminLocally(cleanEmail);
    alert(`No se pudo registrar a "${cleanEmail}" como co-administrador en el servidor. No se aplicó ningún cambio.`);
    return false;
  }
  alert(`Administrador "${cleanEmail}" agregado con éxito.`);
  return true;
}

export async function removeCoAdmin(email) {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase().trim()) {
    alert('No puedes eliminar al Administrador Maestro.');
    return false;
  }

  const previous = getCoAdminsList().find(a => (a.email || '').toLowerCase().trim() === cleanEmail);
  if (!previous) return false;

  removeCoAdminLocally(cleanEmail);
  const synced = await syncCoAdminToBackend(cleanEmail, previous.name || '', false);
  if (!synced) {
    saveCoAdminsList([...getCoAdminsList(), previous]);
    renderCoAdminsListUI();
    alert(`No se pudo revocar el acceso de "${cleanEmail}" en el servidor. No se aplicó ningún cambio.`);
    return false;
  }
  alert(`Acceso de administración revocado a "${cleanEmail}".`);
  return true;
}

// =========================================================================
// 2. CONSUMOS TÉCNICOS Y MÉTRICAS POR USUARIO
// =========================================================================

export function getUserConsumptionData(userEmail) {
  if (!userEmail) return { tokensIA: 0, storageMB: 0, bandwidthMB: 0, lastActivity: null };
  const cleanEmail = userEmail.toLowerCase().trim();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_CONSUMPTION}_${cleanEmail}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        tokensIA: Number(parsed?.tokensIA) || 0,
        storageMB: Number(parsed?.storageMB) || 0,
        bandwidthMB: Number(parsed?.bandwidthMB) || 0,
        lastActivity: parsed?.lastActivity || null
      };
    }
  } catch (_) {}

  return {
    tokensIA: 0,
    storageMB: 0,
    bandwidthMB: 0,
    lastActivity: null
  };
}

export function evaluateUserActivity(user, consumption) {
  const now = new Date();
  const lastDateStr = consumption?.lastActivity || user?.lastLogin || user?.createdAt || null;
  if (!lastDateStr) return 'inactivo';

  const lastDate = new Date(lastDateStr);
  if (Number.isNaN(lastDate.getTime())) return 'inactivo';
  const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

  if (diffDays <= 15) return 'activo';
  if (diffDays <= 90) return 'reposo';
  return 'inactivo';
}

export function calculateUserMetrics(user) {
  const cleanEmail = (user.email || '').toLowerCase().trim();
  const rates = getMarketRates();
  const consumption = getUserConsumptionData(cleanEmail);

  const normalizePlan = (p) => {
    const v = String(p || 'free').toLowerCase().trim();
    return v === 'plus' || v === 'pro' ? v : 'free';
  };
  const normalizeCycle = (c) => (String(c || 'monthly').toLowerCase().trim() === 'annual' ? 'annual' : 'monthly');

  // Determinar planes reales de ambas apps o combo desde tiers oficiales
  const planConst = normalizePlan(user?.subscriptionConst?.planId || user?.subscription?.planId);
  const planArq = normalizePlan(user?.subscriptionArq?.planId || user?.subscription?.planId);
  const isSuiteCombo = Boolean(
    user?.subscription?.isCombo ||
    (planConst === 'pro' && planArq === 'pro') ||
    (planConst === 'plus' && planArq === 'plus')
  );

  const cycleConst = normalizeCycle(user?.subscriptionConst?.billingCycle || user?.subscription?.billingCycle);
  const cycleArq = normalizeCycle(user?.subscriptionArq?.billingCycle || user?.subscription?.billingCycle);
  const billingCycle = (cycleConst === 'annual' || cycleArq === 'annual') ? 'annual' : 'monthly';

  const expiryRaw = user?.periodoFin || user?.periodo_fin || user?.periodoFinConst || user?.periodo_fin_const || user?.periodoFinArq || user?.periodo_fin_arq || user?.vigenciaFin || null;
  const expiryParsed = expiryRaw ? new Date(expiryRaw) : null;
  const expiryValid = Boolean(expiryParsed && !Number.isNaN(expiryParsed.getTime()));
  const isPermanentExpiry = Boolean(expiryValid && expiryParsed.getFullYear() >= 2090);
  const isExpiredPlan = Boolean(expiryValid && !isPermanentExpiry && expiryParsed.getTime() < Date.now() && (planConst !== 'free' || planArq !== 'free'));

  const gastoConst = isExpiredPlan ? 0 : (CONST_TIERS[planConst]?.[cycleConst === 'annual' ? 'annualPrice' : 'monthlyPrice'] || 0);
  const gastoArq = isExpiredPlan ? 0 : (ARQ_TIERS[planArq]?.[cycleArq === 'annual' ? 'annualPrice' : 'monthlyPrice'] || 0);

  let totalGastoSub = gastoConst + gastoArq;
  if (isSuiteCombo && !isExpiredPlan) {
    const comboTier = (planConst === 'pro' || planArq === 'pro') ? 'pro' : ((planConst === 'plus' || planArq === 'plus') ? 'plus' : 'free');
    totalGastoSub = COMBO_TIERS[comboTier]?.[billingCycle === 'annual' ? 'annualPrice' : 'monthlyPrice'] || totalGastoSub;
  }

  // Costo real de recursos consumidos
  const costoIA = ((consumption.tokensIA || 0) / 1000) * rates.aiTokenPer1k;
  const costoStorage = (consumption.storageMB || 0) * rates.storageMbMonth;
  const costoBandwidth = (consumption.bandwidthMB || 0) * rates.bandwidthMb;
  const totalCostoRecursos = Number((costoIA + costoStorage + costoBandwidth).toFixed(2));

  const baseComparativa = totalGastoSub > 0 ? totalGastoSub : 15.0;
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
    billingCycle,
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

let adminUsersCache = null;
let adminUsersRequestSeq = 0;
let visibleAdminUserEmails = new Set();
let lastRenderedTbodyHtml = '';
let adminRealtimeChannel = null;
let adminAutoRefreshInterval = null;
let adminRealtimeDebounceTimer = null;
let adminRefreshInFlight = false;
let adminVisibilityHandler = null;
let adminFocusHandler = null;

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
  renderAdminTableFromCache();
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
  if (selectAll) {
    selectAll.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
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

function purgeEmailsFromLocalRegistries(targetEmails) {
  if (!Array.isArray(targetEmails) || targetEmails.length === 0) return;
  const targetSet = new Set(targetEmails.map(e => String(e || '').toLowerCase().trim()).filter(Boolean));
  const storageKeys = [
    STORAGE_KEY_REGISTERED_USERS,
    'control_obra_registered_accounts_v1',
    'control_obra_closed_sessions_v1'
  ];
  storageKeys.forEach(k => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      const filtered = list.filter(item => {
        const em = typeof item === 'string' ? item : item?.email;
        return !targetSet.has(String(em || '').toLowerCase().trim());
      });
      localStorage.setItem(k, JSON.stringify(filtered));
    } catch (_) {}
  });
}

export async function deleteSelectedAdminUsers() {
  const targets = Array.from(selectedAdminUserEmails)
    .filter(e => visibleAdminUserEmails.has(e) && !isUserMasterAdmin(e));
  if (targets.length === 0) {
    alert('Selecciona al menos un usuario visible para eliminar (el Administrador Maestro está protegido).');
    return;
  }

  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a estos ${targets.length} usuario(s)?\n\n${targets.join('\n')}`)) {
    return;
  }

  // 1. Eliminar primero en el backend seguro de la nube (auth.users y bases de datos) y verificar res.ok
  let deletedInCloud = false;
  let lastErrorMsg = '';
  try {
    const { token: bearerToken } = await getAdminSessionContext();

    const endpoints = ['/api/admin-users', 'https://const.cubikar.app/api/admin-users'];
    for (const ep of endpoints) {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

        const res = await fetch(ep, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'delete',
            emails: targets
          })
        });
        if (res.ok) {
          deletedInCloud = true;
          break;
        } else {
          const errPayload = await res.json().catch(() => ({}));
          lastErrorMsg = errPayload?.error || `HTTP ${res.status}`;
        }
      } catch (e) {
        lastErrorMsg = e?.message || String(e);
      }
    }
  } catch (err) {
    lastErrorMsg = err?.message || String(err);
    console.warn('[Cubikar Admin] Error al sincronizar eliminación con la nube:', err);
  }

  if (!deletedInCloud) {
    alert(`No se pudo eliminar en el servidor: ${lastErrorMsg || 'Error de conexión o permisos.'}`);
    return;
  }

  // 2. Eliminar localmente tras confirmar éxito en servidor (el registro en la nube ya no existe: no re-sincronizar)
  const targetSet = new Set(targets.map(e => e.toLowerCase().trim()));
  saveCoAdminsList(getCoAdminsList().filter(a => !targetSet.has((a.email || '').toLowerCase().trim())));
  targetSet.forEach(cleanEmail => {
    try {
      localStorage.removeItem(`${STORAGE_KEY_CONSUMPTION}_${cleanEmail}`);
    } catch (_) {}
  });
  purgeEmailsFromLocalRegistries(targets);

  selectedAdminUserEmails.clear();
  const selectAll = document.getElementById('admin-select-all-checkbox');
  if (selectAll) selectAll.checked = false;

  alert(`Usuario(s) eliminado(s) correctamente:\n\n${targets.join('\n')}`);
  renderCubikarAdminTable({ refresh: true });
}

export const deleteRegisteredUser = deleteSelectedAdminUsers;

export async function updateAdminUserPlan(emailOrOpts, plan = 'free', billingCycle = 'monthly', producto = 'combo') {
  const opts = (typeof emailOrOpts === 'object' && emailOrOpts !== null)
    ? emailOrOpts
    : { email: emailOrOpts, plan, billingCycle, producto };

  const cleanEmail = String(opts.email || '').toLowerCase().trim();
  if (!cleanEmail || isUserMasterAdmin(cleanEmail)) {
    throw new Error('Correo inválido o protegido.');
  }

  const normPlan = (v) => {
    const p = String(v || 'free').toLowerCase().trim();
    return (p === 'plus' || p === 'pro') ? p : 'free';
  };

  const planConst = opts.planConst != null ? normPlan(opts.planConst) : normPlan(opts.plan);
  const planArq = opts.planArq != null ? normPlan(opts.planArq) : normPlan(opts.plan);
  const normalizedCycle = String(opts.billingCycle || opts.ciclo || 'monthly').toLowerCase().trim() === 'annual' ? 'annual' : 'monthly';
  const vigenciaFin = opts.vigenciaFin !== undefined ? opts.vigenciaFin : (opts.vigencia_fin !== undefined ? opts.vigencia_fin : null);
  const clearExpiry = Boolean(opts.clearExpiry);
  const isCombo = Boolean(opts.isCombo || (planConst === 'pro' && planArq === 'pro') || (planConst === 'plus' && planArq === 'plus'));
  const overallPlan = (planConst === 'pro' || planArq === 'pro') ? 'pro' : ((planConst === 'plus' || planArq === 'plus') ? 'plus' : 'free');

  const { token: bearerToken } = await getAdminSessionContext();
  const endpoints = ['/api/admin-users', 'https://const.cubikar.app/api/admin-users'];
  let lastError = 'No se pudo conectar con el servidor.';

  for (const ep of endpoints) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
      const res = await fetch(ep, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'update_plan',
          email: cleanEmail,
          plan: overallPlan,
          plan_const: planConst,
          plan_arq: planArq,
          is_combo: isCombo,
          billingCycle: normalizedCycle,
          vigencia_fin: vigenciaFin,
          clearExpiry,
          producto: opts.producto || 'combo'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        await renderCubikarAdminTable({ refresh: true });
        return true;
      }
      lastError = data?.error || `Error del servidor (HTTP ${res.status})`;
      if (res.status === 400 || res.status === 401 || res.status === 403) break;
    } catch (err) {
      lastError = err?.message || 'Error de red.';
    }
  }
  throw new Error(lastError);
}

// =========================================================================
// 4. CARGA DE USUARIOS Y DATOS DESDE SUPABASE Y LOCAL
// =========================================================================

export async function fetchAllEcosystemUsers() {
  const usersMap = new Map();
  let cloudLoadedSuccessfully = false;

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
    const { token: bearerToken } = await getAdminSessionContext();

    const endpoints = ['/api/admin-users', 'https://const.cubikar.app/api/admin-users'];
    for (const url of endpoints) {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

        const res = await fetch(url, {
          method: 'GET',
          headers,
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.coAdmins)) {
            saveCoAdminsList(data.coAdmins);
          }
          if (data && Array.isArray(data.users) && data.users.length > 0) {
            cloudLoadedSuccessfully = true;
            data.users.forEach(u => {
              if (!u || !u.email) return;
              const em = u.email.toLowerCase().trim();
              const isMaster = em === MASTER_ADMIN_EMAIL.toLowerCase();

              const planConst = u.subscriptionConst?.planId || u.subscription?.planId || 'free';
              const planArq = u.subscriptionArq?.planId || u.subscription?.planId || 'free';
              const isCombo = u.subscription?.isCombo || (isMaster ? true : (planConst === 'pro' && planArq === 'pro'));
              const defaultCycle = u.subscription?.billingCycle || 'monthly';

              usersMap.set(em, {
                id: u.id,
                name: u.name || em.split('@')[0],
                email: em,
                createdAt: u.createdAt || '2026-02-01T00:00:00.000Z',
                lastLogin: u.lastLogin || u.createdAt || new Date().toISOString(),
                subscription: isMaster
                  ? { planId: 'pro', billingCycle: 'annual', isCombo: true }
                  : (u.subscription || { planId: 'free', billingCycle: defaultCycle, isCombo }),
                subscriptionConst: isMaster
                  ? { planId: 'pro', billingCycle: 'annual' }
                  : { planId: planConst, billingCycle: u.subscriptionConst?.billingCycle || defaultCycle },
                subscriptionArq: isMaster
                  ? { planId: 'pro', billingCycle: 'annual' }
                  : { planId: planArq, billingCycle: u.subscriptionArq?.billingCycle || defaultCycle },
                periodoFin: u.periodoFin || u.periodo_fin || u.periodoFinConst || u.periodo_fin_const || u.periodoFinArq || u.periodo_fin_arq || null,
                periodoFinConst: u.periodoFinConst || u.periodo_fin_const || null,
                periodoFinArq: u.periodoFinArq || u.periodo_fin_arq || null,
                appUsage: isMaster ? 'ambas' : (u.appUsage || (planConst !== 'free' && planArq !== 'free' ? 'ambas' : (planConst !== 'free' ? 'const' : (planArq !== 'free' ? 'arq' : 'ambas')))),
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

  // 3. Complementar desde Supabase (tabla perfiles join empresas) si está disponible
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data: profiles, error } = await sb.from('perfiles').select('*, empresas(*)');
      if (!error && Array.isArray(profiles) && profiles.length > 0) {
        cloudLoadedSuccessfully = true;
        profiles.forEach(p => {
          if (!p || !p.email) return;
          const em = p.email.toLowerCase().trim();
          const isMaster = em === MASTER_ADMIN_EMAIL.toLowerCase();
          const emp = p.empresas || {};
          const hasExplicitProd = emp.plan_const != null || emp.plan_arq != null || emp.acceso_const != null || emp.acceso_arq != null;
          const plan = isMaster ? 'pro' : (emp.plan || 'free');
          const legacyFallback = !hasExplicitProd ? plan : 'free';
          const planConst = isMaster ? 'pro' : ((emp.acceso_const === false && !emp.plan_const) ? 'free' : (emp.plan_const || legacyFallback || 'free'));
          const planArq = isMaster ? 'pro' : ((emp.acceso_arq === false && !emp.plan_arq) ? 'free' : (emp.plan_arq || legacyFallback || 'free'));
          const billingCycle = isMaster ? 'annual' : (emp.billing_cycle || 'monthly');
          const isCombo = isMaster || (planConst === 'pro' && planArq === 'pro') || (Boolean(emp.acceso_const) && Boolean(emp.acceso_arq) && planConst === planArq && planConst !== 'free');
          const appUsage = isCombo
            ? 'ambas'
            : (planConst !== 'free' && planArq !== 'free'
              ? 'ambas'
              : (planConst !== 'free' ? 'const' : (planArq !== 'free' ? 'arq' : 'ambas')));

          const empExpiry = emp.periodo_fin || emp.periodo_fin_const || emp.periodo_fin_arq || null;
          if (usersMap.has(em)) {
            const ex = usersMap.get(em);
            if (p.nombre_completo && (!ex.name || ex.name === em.split('@')[0])) {
              ex.name = p.nombre_completo;
            }
            if (!isMaster && p.empresas) {
              ex.subscription = { planId: plan, billingCycle, isCombo };
              ex.subscriptionConst = { planId: planConst, billingCycle };
              ex.subscriptionArq = { planId: planArq, billingCycle };
              ex.appUsage = appUsage;
              if (empExpiry || emp.periodo_fin_const || emp.periodo_fin_arq) {
                ex.periodoFin = empExpiry || ex.periodoFin || null;
                ex.periodoFinConst = emp.periodo_fin_const || ex.periodoFinConst || null;
                ex.periodoFinArq = emp.periodo_fin_arq || ex.periodoFinArq || null;
              }
            }
          } else {
            usersMap.set(em, {
              id: p.id,
              name: p.nombre_completo || p.name || em.split('@')[0],
              email: em,
              createdAt: p.created_at || '2026-02-01T00:00:00.000Z',
              lastLogin: p.updated_at || p.created_at || new Date().toISOString(),
              subscription: { planId: plan, billingCycle, isCombo },
              subscriptionConst: { planId: planConst, billingCycle },
              subscriptionArq: { planId: planArq, billingCycle },
              periodoFin: empExpiry,
              periodoFinConst: emp.periodo_fin_const || null,
              periodoFinArq: emp.periodo_fin_arq || null,
              appUsage
            });
          }
        });
      }
    }
  } catch (_) {}

  // 4. Solo usar localStorage como respaldo offline cuando la nube no pudo responder (evita reinyectar usuarios eliminados)
  if (!cloudLoadedSuccessfully) {
    try {
      const storageKeys = [
        STORAGE_KEY_REGISTERED_USERS,
        'control_obra_registered_accounts_v1'
      ];
      storageKeys.forEach(k => {
        const rawLocal = localStorage.getItem(k);
        if (rawLocal) {
          const list = JSON.parse(rawLocal);
          if (Array.isArray(list)) {
            list.forEach(u => {
              if (!u) return;
              const rawEmail = typeof u === 'string' ? u : u.email;
              if (!rawEmail) return;
              const em = rawEmail.toLowerCase().trim();
              if (!usersMap.has(em)) {
                const obj = typeof u === 'object' ? u : {};
                usersMap.set(em, {
                  ...obj,
                  name: obj.name || obj.fullName || em.split('@')[0],
                  email: em,
                  appUsage: obj.appUsage || 'ambas'
                });
              }
            });
          }
        }
      });
    } catch (_) {}
  }

  return Array.from(usersMap.values());
}

export const fetchCloudAdminUsers = fetchAllEcosystemUsers;

// =========================================================================
// 5. RENDERIZADO DE LA TABLA Y KPIS
// =========================================================================

export async function renderCubikarAdminTable({ refresh = false } = {}) {
  const tbody = document.getElementById('admin-cubikar-table-body');
  if (!tbody) return;

  if (refresh || !adminUsersCache) {
    const seq = ++adminUsersRequestSeq;
    if (!adminUsersCache) {
      lastRenderedTbodyHtml = '';
      tbody.innerHTML = `
        <tr>
          <td colspan="16" class="text-center py-12 text-slate-400 font-medium bg-slate-900/40">
            <i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-slate-500 block"></i>
            Cargando usuarios del ecosistema...
          </td>
        </tr>
      `;
    }
    const users = await fetchAllEcosystemUsers();
    if (seq !== adminUsersRequestSeq) return;
    adminUsersCache = users;
    updateAdminRealtimeBadge('live');
  }

  renderAdminTableFromCache();
}

function getFilteredAdminDataset() {
  if (!Array.isArray(adminUsersCache)) return [];

  const dataset = adminUsersCache.map((u, idx) => {
    const metrics = calculateUserMetrics(u);
    const regDate = u.createdAt ? new Date(u.createdAt) : new Date('2026-01-31');
    const inicioSub = regDate;
    const expiryRaw = u.periodoFin || u.periodo_fin || u.periodoFinConst || u.periodo_fin_const || u.periodoFinArq || u.periodo_fin_arq || u.vigenciaFin || null;
    let finSub = expiryRaw ? new Date(expiryRaw) : new Date(inicioSub.getTime() + 365 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(finSub.getTime())) finSub = new Date(inicioSub.getTime() + 365 * 24 * 60 * 60 * 1000);
    const isPermanent = finSub.getFullYear() >= 2090;
    const isExpired = !isPermanent && Boolean(expiryRaw) && finSub.getTime() < Date.now() && (metrics.planConst !== 'free' || metrics.planArq !== 'free');

    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const finMembresiaHtml = isPermanent
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase font-mono tracking-wider" title="Acceso Vitalicio / Permanente"><i class="fa-solid fa-infinity text-[9px]"></i> Vitalicio</span>`
      : (isExpired
        ? `<span class="text-rose-400 font-semibold">${formatDate(finSub)}</span> <span class="text-[9px] font-bold text-rose-400 uppercase">(Vencida)</span>`
        : (expiryRaw ? `<span class="text-cyan-300 font-semibold">${formatDate(finSub)}</span>` : formatDate(finSub)));

    // Determinar aplicaciones utilizadas
    const appUsage = u.appUsage || (metrics.planConst !== 'free' && metrics.planArq !== 'free' ? 'ambas' : (metrics.planConst !== 'free' ? 'const' : (metrics.planArq !== 'free' ? 'arq' : 'ambas')));

    return {
      no: String(idx + 1),
      nombre: u.name || u.email.split('@')[0],
      correo: u.email,
      fechaRegistro: formatDate(regDate),
      actividad: metrics.actividad,
      appUsage,
      planConst: metrics.planConst,
      planArq: metrics.planArq,
      cycleConst: metrics.cycleConst,
      cycleArq: metrics.cycleArq,
      billingCycle: metrics.billingCycle,
      isSuiteCombo: metrics.isSuiteCombo,
      inicioMembresia: formatDate(inicioSub),
      finMembresia: isPermanent ? 'Vitalicio' : (isExpired ? `${formatDate(finSub)} (Vencida)` : formatDate(finSub)),
      finMembresiaHtml,
      isPermanent,
      isExpired,
      tokensIANum: Number(metrics.tokensIA || 0),
      storageMBNum: Number(metrics.storageMB || 0),
      bandwidthMBNum: Number(metrics.bandwidthMB || 0),
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

  // Filtro por plan
  if (adminFilterPlan !== 'all') {
    if (adminFilterPlan === 'combo') {
      filtered = filtered.filter(d => d.isSuiteCombo);
    } else if (adminFilterAppScope === 'const') {
      filtered = filtered.filter(d => d.planConst === adminFilterPlan);
    } else if (adminFilterAppScope === 'arq') {
      filtered = filtered.filter(d => d.planArq === adminFilterPlan);
    } else if (adminFilterPlan === 'free') {
      filtered = filtered.filter(d => d.planConst === 'free' && d.planArq === 'free');
    } else {
      filtered = filtered.filter(d => d.planConst === adminFilterPlan || d.planArq === adminFilterPlan);
    }
  }

  // Filtro por ciclo de facturación
  if (adminFilterCycle !== 'all') {
    filtered = filtered.filter(d => d.billingCycle === adminFilterCycle || d.cycleConst === adminFilterCycle || d.cycleArq === adminFilterCycle);
  }

  return filtered;
}

function renderAdminTableFromCache() {
  const tbody = document.getElementById('admin-cubikar-table-body');
  if (!tbody || !adminUsersCache) return;

  const filtered = getFilteredAdminDataset();

  // Actualizar KPIs Superiores
  updateAdminKpisUI(filtered);

  visibleAdminUserEmails = new Set(filtered.map(d => d.correo));
  selectedAdminUserEmails.forEach(email => {
    if (!visibleAdminUserEmails.has(email)) selectedAdminUserEmails.delete(email);
  });

  if (filtered.length === 0) {
    const emptyHtml = `
      <tr>
        <td colspan="16" class="text-center py-12 text-slate-400 font-medium bg-slate-900/40">
          <i class="fa-solid fa-filter-circle-xmark text-3xl mb-2 text-slate-500 block"></i>
          No se encontraron registros con los filtros seleccionados.
        </td>
      </tr>
    `;
    if (emptyHtml !== lastRenderedTbodyHtml || tbody.innerHTML === '') {
      tbody.innerHTML = emptyHtml;
      lastRenderedTbodyHtml = emptyHtml;
    }
    updateAdminDeleteButtonUI();
    return;
  }

  const nextTbodyHtml = filtered.map(row => {
    const safeEmailHtml = escapeAdminHtml(row.correo);
    const safeEmailAttr = escapeAdminAttr(row.correo);
    const safeEmailJs = escapeAdminJsString(row.correo);
    const safeNameHtml = escapeAdminHtml(row.nombre);
    const safeNameAttr = escapeAdminAttr(row.nombre);
    const safeInitialHtml = escapeAdminHtml((row.nombre || row.correo || '?').charAt(0).toUpperCase());
    const safePlanConstHtml = escapeAdminHtml(row.planConst);
    const safePlanArqHtml = escapeAdminHtml(row.planArq);

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
      const isProSuite = row.planConst === 'pro' && row.planArq === 'pro';
      badgeSuscripciones = isProSuite
        ? `<span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase whitespace-nowrap"><i class="fa-solid fa-crown text-[9px] mr-1"></i>Suite Completa Pro</span>`
        : `<span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/40 uppercase whitespace-nowrap"><i class="fa-solid fa-bolt text-[9px] mr-1"></i>Suite Completa Plus</span>`;
    } else {
      const bConst = row.planConst === 'pro' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : (row.planConst === 'plus' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40');
      const bArq = row.planArq === 'pro' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : (row.planArq === 'plus' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40');
      const iconConst = row.planConst === 'pro' ? '<i class="fa-solid fa-crown mr-1 text-[8.5px]"></i>' : (row.planConst === 'plus' ? '<i class="fa-solid fa-bolt mr-1 text-[8.5px]"></i>' : '<i class="fa-solid fa-seedling mr-1 text-[8.5px]"></i>');
      const iconArq = row.planArq === 'pro' ? '<i class="fa-solid fa-crown mr-1 text-[8.5px]"></i>' : (row.planArq === 'plus' ? '<i class="fa-solid fa-bolt mr-1 text-[8.5px]"></i>' : '<i class="fa-solid fa-seedling mr-1 text-[8.5px]"></i>');
      badgeSuscripciones = `
        <div class="flex items-center justify-center gap-1.5 flex-wrap">
          <span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold border uppercase flex items-center ${bConst}" title="Cubikar Construcción">${iconConst}Const: ${safePlanConstHtml}</span>
          <span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold border uppercase flex items-center ${bArq}" title="Cubikar Arquitectura">${iconArq}Arq: ${safePlanArqHtml}</span>
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
            <input type="checkbox" value="${safeEmailAttr}" ${selectedAdminUserEmails.has(row.correo) ? 'checked' : ''} onchange="onAdminUserCheckboxChange(this)"
                   class="admin-user-checkbox rounded border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4">
          `}
        </td>
        <!-- No -->
        <td class="px-3 py-2.5 text-center font-mono text-slate-400 font-bold">${row.no}</td>
        <!-- Nombre -->
        <td class="px-3.5 py-2.5 font-semibold text-white whitespace-nowrap">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
              ${safeInitialHtml}
            </div>
            <span class="truncate max-w-[150px]" title="${safeNameAttr}">${safeNameHtml}</span>
          </div>
        </td>
        <!-- Correo -->
        <td class="px-3.5 py-2.5 font-mono text-slate-300 whitespace-nowrap">
          <div class="flex items-center justify-between gap-1.5">
            <span class="truncate max-w-[170px] block" title="${safeEmailAttr}">${safeEmailHtml}</span>
            <button type="button" onclick="openS3BackupsAdminModal('${safeEmailJs}')"
                    class="text-slate-500 hover:text-emerald-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer shrink-0"
                    title="Ver respaldos S3 de ${safeEmailAttr}">
              <i class="fa-solid fa-cloud-arrow-down text-[11px]"></i>
            </button>
          </div>
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
        <td class="px-3 py-2.5 text-center font-mono text-slate-400 whitespace-nowrap">${row.finMembresiaHtml}</td>
        <!-- Gestión -->
        <td class="px-3 py-2.5 text-center whitespace-nowrap">
          ${isUserMasterAdmin(row.correo) ? `
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400/70 border border-amber-500/20 text-[10px] font-bold font-mono" title="Administrador Maestro protegido">
              <i class="fa-solid fa-shield-halved text-[9px]"></i> Maestro
            </span>
          ` : `
            <button type="button" onclick="openEditMembershipModal('${safeEmailJs}')"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/35 text-[11px] font-bold transition shadow-xs cursor-pointer"
                    title="Editar membresías y vigencia de ${safeEmailAttr}">
              <i class="fa-solid fa-pen-to-square text-[10px]"></i>
              <span>Editar</span>
            </button>
          `}
        </td>
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

  const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
  const hasSelectionInside = Boolean(sel && !sel.isCollapsed && sel.anchorNode && tbody.contains(sel.anchorNode));
  if (!hasSelectionInside && (nextTbodyHtml !== lastRenderedTbodyHtml || tbody.innerHTML === '')) {
    tbody.innerHTML = nextTbodyHtml;
    lastRenderedTbodyHtml = nextTbodyHtml;
  }

  updateAdminDeleteButtonUI();
  updateSelectAllCheckboxState();
}

function updateAdminKpisUI(dataset) {
  const totalUsers = dataset.length;
  const activeUsers = dataset.filter(d => d.actividad === 'activo').length;
  const totalRevenue = dataset.reduce((acc, curr) => {
    if (adminFilterAppScope === 'const') return acc + (curr.gastoConst || 0);
    if (adminFilterAppScope === 'arq') return acc + (curr.gastoArq || 0);
    return acc + (curr.gastoSuscripcion || 0);
  }, 0);
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
// 5B. SINCRONIZACIÓN AUTOMÁTICA EN TIEMPO REAL DEL PANEL SUPERADMIN
// =========================================================================

function isAdminModalOpen() {
  const modal = document.getElementById('modal-admin-cubikar');
  return Boolean(modal && !modal.classList.contains('hidden') && modal.style.display !== 'none');
}

function updateAdminRealtimeBadge(status = 'live') {
  const el = document.getElementById('admin-realtime-status');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  if (status === 'syncing') {
    el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span><span class="text-cyan-300">Sincronizando...</span>`;
    return;
  }
  el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span>En tiempo real • ${hh}:${mm}:${ss}</span>`;
}

function scheduleAdminRealtimeRefresh(delayMs = 500) {
  if (!isAdminModalOpen()) return;
  if (adminRealtimeDebounceTimer) clearTimeout(adminRealtimeDebounceTimer);
  adminRealtimeDebounceTimer = setTimeout(async () => {
    if (!isAdminModalOpen() || document.hidden || adminRefreshInFlight) return;
    adminRefreshInFlight = true;
    try {
      updateAdminRealtimeBadge('syncing');
      await renderCubikarAdminTable({ refresh: true });
    } catch (_) {
    } finally {
      adminRefreshInFlight = false;
      updateAdminRealtimeBadge('live');
    }
  }, delayMs);
}

export function stopAdminRealtimeSync() {
  if (adminAutoRefreshInterval) {
    clearInterval(adminAutoRefreshInterval);
    adminAutoRefreshInterval = null;
  }
  if (adminRealtimeDebounceTimer) {
    clearTimeout(adminRealtimeDebounceTimer);
    adminRealtimeDebounceTimer = null;
  }
  if (adminVisibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', adminVisibilityHandler);
    adminVisibilityHandler = null;
  }
  if (adminFocusHandler && typeof window !== 'undefined') {
    window.removeEventListener('focus', adminFocusHandler);
    adminFocusHandler = null;
  }
  if (adminRealtimeChannel) {
    try {
      const sb = getSupabaseClient();
      if (sb && typeof sb.removeChannel === 'function') {
        sb.removeChannel(adminRealtimeChannel);
      } else if (typeof adminRealtimeChannel.unsubscribe === 'function') {
        adminRealtimeChannel.unsubscribe();
      }
    } catch (_) {}
    adminRealtimeChannel = null;
  }
}

export function startAdminRealtimeSync() {
  stopAdminRealtimeSync();

  // 1. Suscripción push instantánea via Supabase Realtime
  try {
    const sb = getSupabaseClient();
    if (sb && typeof sb.channel === 'function') {
      adminRealtimeChannel = sb
        .channel('cubikar-superadmin-realtime', { config: { private: true } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => scheduleAdminRealtimeRefresh(450))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'empresas' }, () => scheduleAdminRealtimeRefresh(450))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cubikar_registros' }, () => scheduleAdminRealtimeRefresh(450))
        .subscribe();
    }
  } catch (_) {}

  // 2. Respaldo automático en segundo plano cada 12 segundos (cubre cambios directos en auth.users o sin Realtime)
  adminAutoRefreshInterval = setInterval(() => {
    if (!isAdminModalOpen() || document.hidden || adminRefreshInFlight) return;
    scheduleAdminRealtimeRefresh(50);
  }, 12000);

  // 3. Refresco inmediato al regresar a la pestaña o enfocar la ventana
  if (typeof document !== 'undefined') {
    adminVisibilityHandler = () => {
      if (!document.hidden && isAdminModalOpen()) scheduleAdminRealtimeRefresh(150);
    };
    document.addEventListener('visibilitychange', adminVisibilityHandler);
  }
  if (typeof window !== 'undefined') {
    adminFocusHandler = () => {
      if (isAdminModalOpen()) scheduleAdminRealtimeRefresh(150);
    };
    window.addEventListener('focus', adminFocusHandler);
  }
}

// =========================================================================
// 6. APERTURA / CIERRE DE MODALES SUPERADMIN
// =========================================================================

export function openCubikarAdminModal() {
  const modal = document.getElementById('modal-admin-cubikar');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  renderCubikarAdminTable({ refresh: true });
  startAdminRealtimeSync();
}

export function closeCubikarAdminModal() {
  stopAdminRealtimeSync();
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
  hydrateCoAdminsFromCloud().catch(() => {});
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
        Actualmente no hay co-administradores invitados. Solo el Administrador Maestro (${escapeAdminHtml(MASTER_ADMIN_EMAIL)}) tiene acceso.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(admin => {
    const safeName = escapeAdminHtml(admin.name || admin.email);
    const safeEmailHtml = escapeAdminHtml(admin.email);
    const safeEmailAttr = escapeAdminAttr(admin.email);
    const safeEmailJsArg = escapeAdminJsString(admin.email);
    return `
    <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-xs shrink-0">
          <i class="fa-solid fa-shield"></i>
        </div>
        <div class="min-w-0">
          <div class="font-bold text-white truncate">${safeName}</div>
          <div class="text-[11px] font-mono text-slate-400 truncate">${safeEmailHtml}</div>
          <div class="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
            <i class="fa-solid fa-check text-[8px]"></i> Permisos: Acceso SuperAdmin
          </div>
        </div>
      </div>
      <button type="button" data-coadmin-email="${safeEmailAttr}" onclick="removeCoAdmin(this.getAttribute('data-coadmin-email') || '${safeEmailJsArg}')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer">
        Eliminar
      </button>
    </div>
  `;
  }).join('');
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
  renderAdminTableFromCache();
}

export async function exportCubikarDatabaseToExcel() {
  const table = document.getElementById('admin-cubikar-table');
  if (!table) return;
  let XLSX;
  try {
    XLSX = await loadXLSX();
  } catch (err) {
    alert(err?.message || 'No se pudo cargar la librería de exportación a Excel.');
    return;
  }
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Bases de Datos Cubikar' });
  XLSX.writeFile(wb, `Cubikar_Ecosistema_Admin_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function printCubikarAdminTable() {
  const rows = getFilteredAdminDataset();
  const totalUsers = rows.length;
  const activeUsers = rows.filter(d => d.actividad === 'activo').length;
  const totalRevenue = rows.reduce((acc, c) => acc + (c.gastoSuscripcion || 0), 0);
  const totalResourceCost = rows.reduce((acc, c) => acc + (c.costoRecursos || 0), 0);
  const grossMargin = totalRevenue > 0 ? Number((((totalRevenue - totalResourceCost) / totalRevenue) * 100).toFixed(1)) : 0;
  const totalTokens = rows.reduce((acc, c) => acc + (c.tokensIANum || 0), 0);
  const totalStorageMB = rows.reduce((acc, c) => acc + (c.storageMBNum || 0), 0);
  const totalBandwidthMB = rows.reduce((acc, c) => acc + (c.bandwidthMBNum || 0), 0);

  const scopeLabels = { all: 'Todo el Ecosistema', const: 'Cubikar Construcción', arq: 'Cubikar Arquitectura' };
  const activityLabels = { all: 'Todas', activo: 'Activo (≤15d)', reposo: 'Reposo (>15d)', inactivo: 'Inactivo' };
  const planLabels = { all: 'Todos', free: 'Gratis', plus: 'Plus', pro: 'Pro', combo: 'Suite Combo' };
  const cycleLabels = { all: 'Todos', monthly: 'Mensual', annual: 'Anual' };

  const filterSummaryParts = [
    `Alcance: ${scopeLabels[adminFilterAppScope] || 'Todo el Ecosistema'}`,
    `Actividad: ${activityLabels[adminFilterActivity] || 'Todas'}`,
    `Plan: ${planLabels[adminFilterPlan] || 'Todos'}`,
    `Ciclo: ${cycleLabels[adminFilterCycle] || 'Todos'}`
  ];
  if (adminTableFilterText) {
    filterSummaryParts.push(`Búsqueda: "${adminTableFilterText}"`);
  }

  const now = new Date();
  const printedAt = now.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  let logoUrl = 'assets/branding/cubikar_icon_transparent.png';
  try {
    logoUrl = new URL('assets/branding/cubikar_icon_transparent.png', window.location.href).href;
  } catch (_) {}

  const formatMoney = (n) => `$ ${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const tableRowsHtml = rows.length === 0
    ? `<tr><td colspan="15" style="text-align:center; padding:18px; color:#64748b;">No hay registros para imprimir con los filtros seleccionados.</td></tr>`
    : rows.map((r, idx) => {
        const appLabel = r.appUsage === 'ambas' ? 'Ambas Apps' : (r.appUsage === 'const' ? 'Construcción' : 'Arquitectura');
        const actText = r.actividad === 'activo' ? 'ACTIVO' : (r.actividad === 'reposo' ? 'REPOSO' : 'INACTIVO');
        const actClass = r.actividad === 'activo' ? 'badge-active' : (r.actividad === 'reposo' ? 'badge-rest' : 'badge-inactive');
        const memHtml = r.isSuiteCombo
          ? ((r.planConst === 'pro' && r.planArq === 'pro')
              ? `<span class="badge-pro">SUITE COMPLETA PRO</span>`
              : `<span class="badge-plan">SUITE COMPLETA PLUS</span>`)
          : `<span class="badge-plan">Const: ${escapeAdminHtml(String(r.planConst || 'free').toUpperCase())}</span> <span class="badge-plan">Arq: ${escapeAdminHtml(String(r.planArq || 'free').toUpperCase())}</span>`;
        const cycleText = r.billingCycle === 'annual' ? 'Anual' : 'Mensual';
        const rowBg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
        const expClass = r.isExpired ? 'color:#dc2626; font-weight:700;' : (r.isPermanent ? 'color:#b45309; font-weight:700;' : '');

        return `
          <tr style="background:${rowBg};">
            <td class="num center">${escapeAdminHtml(r.no)}</td>
            <td class="bold">${escapeAdminHtml(r.nombre)}</td>
            <td class="mono">${escapeAdminHtml(r.correo)}</td>
            <td class="center">${escapeAdminHtml(appLabel)}</td>
            <td class="center mono">${escapeAdminHtml(r.fechaRegistro)}</td>
            <td class="center"><span class="${actClass}">${actText}</span></td>
            <td class="center">${memHtml}</td>
            <td class="center">${cycleText}</td>
            <td class="center mono" style="${expClass}">${escapeAdminHtml(r.finMembresia)}</td>
            <td class="right mono">${escapeAdminHtml(r.tokensIA)}</td>
            <td class="right mono">${escapeAdminHtml(r.storageMB)}</td>
            <td class="right mono">${escapeAdminHtml(r.bandwidthMB)}</td>
            <td class="right mono bold" style="color:#047857;">${formatMoney(r.gastoSuscripcion)}</td>
            <td class="right mono">${formatMoney(r.costoRecursos)}</td>
            <td class="right mono bold">${Number(r.pctConsumo || 0)}%</td>
          </tr>
        `;
      }).join('');

  const printDocHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Administrativo Cubikar - ${escapeAdminHtml(now.toISOString().slice(0, 10))}</title>
  <style>
    @page { size: letter landscape; margin: 9mm 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 10px;
      margin-bottom: 14px;
      font-size: 12px;
    }
    .toolbar-actions { display: flex; gap: 8px; }
    .btn {
      border: 0;
      border-radius: 7px;
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-print { background: #0284c7; color: #ffffff; }
    .btn-close { background: #334155; color: #e2e8f0; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #1b506f;
      padding-bottom: 10px;
      margin-bottom: 12px;
      gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand img { width: 38px; height: 38px; object-fit: contain; }
    .brand-title { font-size: 15px; font-weight: 900; color: #1b506f; letter-spacing: 0.02em; text-transform: uppercase; }
    .brand-sub { font-size: 10.5px; color: #475569; margin-top: 2px; }
    .meta { text-align: right; font-size: 9.5px; color: #334155; line-height: 1.45; }
    .meta strong { color: #0f172a; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 7px 10px;
      background: #f8fafc;
    }
    .kpi-label { font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-val { font-size: 13px; font-weight: 900; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-top: 2px; }
    .kpi-green { color: #047857; }
    .kpi-amber { color: #b45309; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
      margin-bottom: 10px;
    }
    thead tr { background: #1b506f; color: #ffffff; }
    th {
      padding: 6px 5px;
      border: 1px solid #153e56;
      font-weight: 800;
      text-align: left;
      white-space: nowrap;
    }
    td {
      padding: 5px 5px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    tfoot tr { background: #e2e8f0; font-weight: 800; }
    tfoot td { border: 1px solid #94a3b8; padding: 6px 5px; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; font-weight: 700; }
    .badge-active { display:inline-block; padding:1px 5px; border-radius:4px; background:#dcfce7; color:#166534; font-weight:800; font-size:7.5px; border:1px solid #86efac; }
    .badge-rest { display:inline-block; padding:1px 5px; border-radius:4px; background:#fef3c7; color:#92400e; font-weight:800; font-size:7.5px; border:1px solid #fcd34d; }
    .badge-inactive { display:inline-block; padding:1px 5px; border-radius:4px; background:#fee2e2; color:#991b1b; font-weight:800; font-size:7.5px; border:1px solid #fca5a5; }
    .badge-pro { display:inline-block; padding:1px 6px; border-radius:999px; background:#fef3c7; color:#92400e; font-weight:800; font-size:7.5px; border:1px solid #f59e0b; }
    .badge-plan { display:inline-block; padding:1px 4px; border-radius:3px; background:#f1f5f9; color:#1e293b; font-weight:700; font-size:7.5px; border:1px solid #cbd5e1; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      color: #64748b;
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <span><strong>Vista Previa de Impresión</strong> — Formato Carta Horizontal (${totalUsers} usuario(s))</span>
    <div class="toolbar-actions">
      <button type="button" class="btn btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
      <button type="button" class="btn btn-close" onclick="window.close()">Cerrar</button>
    </div>
  </div>

  <div class="header">
    <div class="brand">
      <img src="${escapeAdminAttr(logoUrl)}" alt="Cubikar">
      <div>
        <div class="brand-title">Bases de Datos Cubikar — Reporte Administrativo</div>
        <div class="brand-sub">Supervisión Integral de Clientes, Membresías, Consumos Técnicos y Margen SaaS</div>
      </div>
    </div>
    <div class="meta">
      <div><strong>Fecha de emisión:</strong> ${escapeAdminHtml(printedAt)}</div>
      <div><strong>Registros incluidos:</strong> ${totalUsers} usuario(s)</div>
      <div><strong>Filtros:</strong> ${escapeAdminHtml(filterSummaryParts.join(' | '))}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Total Usuarios</div><div class="kpi-val">${totalUsers}</div></div>
    <div class="kpi"><div class="kpi-label">Usuarios Activos (≤15d)</div><div class="kpi-val kpi-green">${activeUsers}</div></div>
    <div class="kpi"><div class="kpi-label">Ingreso Suscripción</div><div class="kpi-val kpi-green">${formatMoney(totalRevenue)}</div></div>
    <div class="kpi"><div class="kpi-label">Costo Técnico Recursos</div><div class="kpi-val kpi-amber">${formatMoney(totalResourceCost)}</div></div>
    <div class="kpi"><div class="kpi-label">Margen Bruto</div><div class="kpi-val kpi-green">${grossMargin}%</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center">No.</th>
        <th>Nombre de usuario</th>
        <th>Correo</th>
        <th class="center">Aplicación</th>
        <th class="center">Registro</th>
        <th class="center">Actividad</th>
        <th class="center">Membresías Ecosistema</th>
        <th class="center">Ciclo</th>
        <th class="center">Vigencia Fin</th>
        <th class="right">Tokens IA</th>
        <th class="right">Almacenamiento</th>
        <th class="right">Ancho Banda</th>
        <th class="right">Facturación</th>
        <th class="right">Costo Tec.</th>
        <th class="right">% Consumo</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="9" class="right">TOTALES DEL REPORTE (${totalUsers} USUARIOS):</td>
        <td class="right mono">${totalTokens.toLocaleString('es-MX')}</td>
        <td class="right mono">${totalStorageMB.toFixed(1)} MB</td>
        <td class="right mono">${totalBandwidthMB.toFixed(1)} MB</td>
        <td class="right mono" style="color:#047857;">${formatMoney(totalRevenue)}</td>
        <td class="right mono">${formatMoney(totalResourceCost)}</td>
        <td class="right mono">Margen ${grossMargin}%</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>Estados: Activo (≤15 días) • Reposo (>15 días) • Inactivo (>90 días) • Documento de uso administrativo interno</span>
    <span>Cubikar Admin Engine v2.0 • Master Superadmin</span>
  </div>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;

  const printWin = window.open('', '_blank', 'width=1280,height=850');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(printDocHtml);
    printWin.document.close();
    return;
  }

  // Respaldo con iframe oculto si el navegador bloqueó ventanas emergentes
  const existingFrame = document.getElementById('cubikar-admin-print-frame');
  if (existingFrame) existingFrame.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'cubikar-admin-print-frame';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(printDocHtml);
    frameDoc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (_) {}
      setTimeout(() => iframe.remove(), 3000);
    }, 300);
  }
}

let adminSearchDebounceTimer = null;

export function setAdminTableSearch(text) {
  adminTableFilterText = text;
  if (adminSearchDebounceTimer) clearTimeout(adminSearchDebounceTimer);
  adminSearchDebounceTimer = setTimeout(renderAdminTableFromCache, 150);
}

export function copySupabaseSqlScript() {
  const sql = `CREATE POLICY "conceptos_select" ON public.catalogo_conceptos FOR SELECT USING (public.check_user_project_access(proyecto_id::text));`;
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(sql).catch(() => {});
  }
  return sql;
}

export function setAdminFilterActivity(val) {
  adminFilterActivity = val;
  renderAdminTableFromCache();
}

export function setAdminFilterPlan(val) {
  adminFilterPlan = val;
  renderAdminTableFromCache();
}

export function setAdminFilterCycle(val) {
  adminFilterCycle = val;
  renderAdminTableFromCache();
}

let currentS3BackupEmail = '';
let currentS3BackupDate = '';

function formatBytesShort(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function fetchS3BackupManifestFromApi(email, dateStr = '') {
  const bodyEl = document.getElementById('s3-backup-manifest-body');
  const statusEl = document.getElementById('s3-backup-status-area');
  const dateSelect = document.getElementById('s3-backup-date-select');
  if (!bodyEl) return;

  if (statusEl) {
    statusEl.classList.add('hidden');
    statusEl.innerHTML = '';
  }
  bodyEl.innerHTML = `
    <div class="py-10 text-center text-slate-400 space-y-2">
      <i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-400"></i>
      <p>Consultando respaldos en AWS S3 para <strong>${escapeAdminHtml(email)}</strong>...</p>
    </div>
  `;

  const { token } = await getAdminSessionContext();
  if (!token) {
    bodyEl.innerHTML = `<div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">Se requiere sesión activa verificada para consultar S3.</div>`;
    return;
  }

  try {
    const qs = new URLSearchParams({ action: 's3_backups', email });
    if (dateStr) qs.set('date', dateStr);
    const endpoints = ['/api/admin-users', 'https://const.cubikar.app/api/admin-users'];
    let res = null;
    let data = {};
    for (const ep of endpoints) {
      try {
        res = await fetch(`${ep}?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        data = await res.json().catch(() => ({}));
        if (res.ok || res.status === 401 || res.status === 403 || res.status === 400) break;
      } catch (_) {}
    }
    if (!res || !res.ok) {
      bodyEl.innerHTML = `<div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">${escapeAdminHtml(data?.error || 'Error consultando respaldos S3.')}</div>`;
      return;
    }

    if (!data.configured) {
      if (dateSelect) dateSelect.innerHTML = '<option value="">Sin S3 configurado</option>';
      bodyEl.innerHTML = `
        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
          <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation text-amber-400"></i>Faltan variables AWS S3 en cubikar-portal</div>
          <p class="text-[11px] text-amber-100/80">Agrega <code>AWS_S3_BUCKET</code>, <code>AWS_REGION</code>, <code>AWS_ACCESS_KEY_ID</code> y <code>AWS_SECRET_ACCESS_KEY</code> como Secretos en el Worker <code>cubikar-portal</code> para inspeccionar y descargar respaldos desde aquí.</p>
        </div>
      `;
      return;
    }

    const dates = Array.isArray(data.dates) ? data.dates : [];
    currentS3BackupDate = data.selectedDate || dates[0] || '';
    if (dateSelect) {
      dateSelect.innerHTML = dates.length > 0
        ? dates.map(d => `<option value="${escapeAdminAttr(d)}" ${d === currentS3BackupDate ? 'selected' : ''}>${escapeAdminHtml(d)}</option>`).join('')
        : '<option value="">Sin respaldos aún</option>';
    }

    if (dates.length === 0 || !data.manifest) {
      bodyEl.innerHTML = `
        <div class="py-10 text-center text-slate-400 space-y-2">
          <i class="fa-solid fa-folder-open text-2xl text-slate-500"></i>
          <p class="font-semibold text-white">No hay snapshots S3 registrados aún para ${escapeAdminHtml(email)}</p>
          <p class="text-[11px] text-slate-500">Se generan automáticamente cada día vía GitHub Actions (<code>scripts/backup_users_to_s3.py</code>).</p>
        </div>
      `;
      return;
    }

    const m = data.manifest;
    const projects = Array.isArray(m.projects) ? m.projects : [];
    const safeCuentaKeyJs = escapeAdminJsString(m.cuentaKey || '');
    const safeEmailArg = escapeAdminAttr(email);

    bodyEl.innerHTML = `
      <div class="grid grid-cols-3 gap-2">
        <div class="p-3 rounded-xl bg-[#07080c] border border-white/10">
          <div class="text-[10px] text-slate-400 uppercase">Fecha UTC</div>
          <div class="font-mono font-bold text-white mt-0.5">${escapeAdminHtml(m.backupDate || currentS3BackupDate)}</div>
        </div>
        <div class="p-3 rounded-xl bg-[#07080c] border border-white/10">
          <div class="text-[10px] text-slate-400 uppercase">Proyectos</div>
          <div class="font-mono font-bold text-emerald-300 mt-0.5">${Number(m.totalProjects || 0)} <span class="text-[10px] text-slate-400">(${Number(m.trashedProjects || 0)} papelera)</span></div>
        </div>
        <div class="p-3 rounded-xl bg-[#07080c] border border-white/10">
          <div class="text-[10px] text-slate-400 uppercase">Datos Cuenta</div>
          <div class="font-mono font-bold text-sky-300 mt-0.5">${formatBytesShort(m.cuentaBytes)}</div>
        </div>
      </div>

      ${safeCuentaKeyJs ? `
        <div class="p-3.5 rounded-xl bg-[#07080c] border border-white/10 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="font-bold text-white flex items-center gap-1.5">
              <i class="fa-solid fa-id-card text-sky-400"></i>
              <span>Cuenta, Perfil, Plan e Invitaciones</span>
            </div>
            <div class="text-[10.5px] font-mono text-slate-400 truncate mt-0.5">${escapeAdminHtml(m.cuentaKey)} (${formatBytesShort(m.cuentaBytes)})</div>
          </div>
          <button type="button" onclick="downloadS3BackupObject('${safeCuentaKeyJs}', this)"
                  class="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 font-bold text-xs transition shrink-0 cursor-pointer flex items-center gap-1.5">
            <i class="fa-solid fa-download"></i>
            <span>cuenta.json.gz</span>
          </button>
        </div>
      ` : ''}

      <div class="space-y-2">
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Proyectos respaldados (${projects.length})</div>
        ${projects.length === 0 ? '<div class="p-3 rounded-xl bg-[#07080c] border border-white/10 text-slate-400">Este usuario no tiene obras propias en esta fecha.</div>' : projects.map(p => `
          <div class="p-3 rounded-xl bg-[#07080c] border border-white/10 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-bold text-white flex items-center gap-2 flex-wrap">
                <span class="truncate max-w-[300px]">${escapeAdminHtml(p.nombre || 'Proyecto')}</span>
                ${p.isTrashed ? '<span class="px-1.5 py-0.5 rounded text-[9.5px] bg-rose-500/15 text-rose-300 border border-rose-500/30">En Papelera</span>' : '<span class="px-1.5 py-0.5 rounded text-[9.5px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Activo</span>'}
              </div>
              <div class="text-[10.5px] text-slate-400 mt-0.5 font-mono truncate">
                ${escapeAdminHtml(p.id)} • ${formatBytesShort(p.compressedBytes)} • ${(p.counts?.catalogo_conceptos || 0)} conceptos • ${(p.counts?.bitacora_notas || 0)} bitácora
              </div>
            </div>
            <button type="button" onclick="downloadS3BackupObject('${escapeAdminJsString(p.s3Key || '')}', this)"
                    class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-bold text-xs transition shrink-0 cursor-pointer flex items-center gap-1.5">
              <i class="fa-solid fa-download"></i>
              <span>.json.gz</span>
            </button>
          </div>
        `).join('')}
      </div>

      <div class="p-3 rounded-xl bg-slate-900/90 border border-white/10 text-[10.5px] text-slate-400 space-y-1">
        <div class="font-bold text-slate-300">Comando para restaurar en Supabase desde este snapshot:</div>
        <code class="block font-mono text-[10px] text-emerald-300 break-all">python3 scripts/restore_user_from_s3.py --email ${safeEmailArg} --date ${escapeAdminHtml(currentS3BackupDate)} --clear-deleted --apply</code>
      </div>
    `;
  } catch (err) {
    bodyEl.innerHTML = `<div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">Error de red consultando respaldos: ${escapeAdminHtml(err?.message || err)}</div>`;
  }
}

export async function openS3BackupsAdminModal(targetEmail = '') {
  const modal = document.getElementById('modal-admin-s3-backups');
  const userSelect = document.getElementById('s3-backup-user-select');
  if (!modal) return;

  let users = Array.isArray(adminUsersCache) && adminUsersCache.length > 0
    ? adminUsersCache
    : [];
  if (users.length === 0) {
    try {
      users = await fetchAllEcosystemUsers();
      if (Array.isArray(users) && users.length > 0) adminUsersCache = users;
    } catch (_) {
      users = [];
    }
  }
  const chosenEmail = String(targetEmail || currentS3BackupEmail || users[0]?.email || MASTER_ADMIN_EMAIL).toLowerCase().trim();
  currentS3BackupEmail = chosenEmail;
  currentS3BackupDate = '';

  if (userSelect) {
    const emailSet = new Map();
    users.forEach(u => {
      const em = String(u?.email || '').toLowerCase().trim();
      if (em) emailSet.set(em, u.name || em);
    });
    if (chosenEmail && !emailSet.has(chosenEmail)) {
      emailSet.set(chosenEmail, chosenEmail);
    }
    userSelect.innerHTML = Array.from(emailSet.entries())
      .map(([em, nm]) => `<option value="${escapeAdminAttr(em)}" ${em === chosenEmail ? 'selected' : ''}>${escapeAdminHtml(nm)} (${escapeAdminHtml(em)})</option>`)
      .join('');
  }

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  await fetchS3BackupManifestFromApi(chosenEmail, '');
}

export function closeS3BackupsAdminModal() {
  const modal = document.getElementById('modal-admin-s3-backups');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

export function onS3BackupUserChange(email) {
  const clean = String(email || '').toLowerCase().trim();
  if (!clean) return Promise.resolve();
  currentS3BackupEmail = clean;
  currentS3BackupDate = '';
  return fetchS3BackupManifestFromApi(clean, '');
}

export function onS3BackupDateChange(dateStr) {
  if (!currentS3BackupEmail || !dateStr) return Promise.resolve();
  currentS3BackupDate = dateStr;
  return fetchS3BackupManifestFromApi(currentS3BackupEmail, dateStr);
}

export async function downloadS3BackupObject(s3Key, btnEl = null) {
  if (!s3Key) return;
  if (btnEl) btnEl.disabled = true;
  try {
    const { token } = await getAdminSessionContext();
    const endpoints = ['/api/admin-users', 'https://const.cubikar.app/api/admin-users'];
    let res = null;
    let data = {};
    for (const ep of endpoints) {
      try {
        res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'presign_s3_backup', s3Key })
        });
        data = await res.json().catch(() => ({}));
        if (res.ok || res.status === 401 || res.status === 403 || res.status === 400) break;
      } catch (_) {}
    }
    if (!res || !res.ok || !data?.downloadUrl) {
      alert(data?.error || 'No se pudo obtener el enlace temporal de descarga S3.');
      return;
    }
    window.open(data.downloadUrl, '_blank', 'noopener');
  } catch (err) {
    alert(err?.message || 'Error generando descarga S3.');
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
}

// =========================================================================
// 7. GESTIÓN DE MEMBRESÍAS Y VIGENCIA POR USUARIO (SUPERADMIN)
// =========================================================================

let editingMembershipEmail = '';

function formatDateInputYYYYMMDD(dateObj) {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function updateEditModalDaysRemaining() {
  const dateInput = document.getElementById('edit-member-expiry-date');
  const badgeEl = document.getElementById('edit-member-days-remaining');
  if (!dateInput || !badgeEl) return;

  const val = dateInput.value;
  if (!val) {
    badgeEl.textContent = 'Sin fecha definida';
    badgeEl.className = 'text-[10px] text-slate-400 font-mono font-bold';
    return;
  }

  const target = new Date(`${val}T23:59:59`);
  if (Number.isNaN(target.getTime())) {
    badgeEl.textContent = '--';
    return;
  }

  if (target.getFullYear() >= 2090) {
    badgeEl.textContent = 'Vitalicio (Permanente)';
    badgeEl.className = 'text-[10px] text-amber-300 font-mono font-bold';
    return;
  }

  const diffDays = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    badgeEl.textContent = `Vencida hace ${Math.abs(diffDays)} día(s)`;
    badgeEl.className = 'text-[10px] text-rose-400 font-mono font-bold';
  } else if (diffDays === 0) {
    badgeEl.textContent = 'Vence hoy';
    badgeEl.className = 'text-[10px] text-amber-400 font-mono font-bold';
  } else {
    badgeEl.textContent = `${diffDays} día(s) restantes`;
    badgeEl.className = 'text-[10px] text-emerald-400 font-mono font-bold';
  }
}

export function openEditMembershipModal(userEmail) {
  const cleanEmail = String(userEmail || '').toLowerCase().trim();
  if (!cleanEmail || isUserMasterAdmin(cleanEmail)) return;

  const modal = document.getElementById('modal-admin-edit-membership');
  if (!modal) return;

  const user = (adminUsersCache || []).find(u => (u.email || '').toLowerCase().trim() === cleanEmail);
  if (!user) return;

  editingMembershipEmail = cleanEmail;
  const metrics = calculateUserMetrics(user);

  const nameEl = document.getElementById('edit-member-user-name');
  const emailEl = document.getElementById('edit-member-user-email');
  const avatarEl = document.getElementById('edit-member-user-avatar');
  const regEl = document.getElementById('edit-member-user-regdate');
  const badgesEl = document.getElementById('edit-member-current-badges');
  const selConst = document.getElementById('edit-member-plan-const');
  const selArq = document.getElementById('edit-member-plan-arq');
  const radioMonthly = document.getElementById('edit-member-cycle-monthly');
  const radioAnnual = document.getElementById('edit-member-cycle-annual');
  const dateInput = document.getElementById('edit-member-expiry-date');
  const statusEl = document.getElementById('edit-member-status');

  const displayName = user.name || cleanEmail.split('@')[0];
  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = cleanEmail;
  if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();

  const regDate = user.createdAt ? new Date(user.createdAt) : new Date('2026-01-31');
  const pad = (n) => String(n).padStart(2, '0');
  if (regEl && !Number.isNaN(regDate.getTime())) {
    regEl.textContent = `Registrado: ${pad(regDate.getDate())}/${pad(regDate.getMonth() + 1)}/${regDate.getFullYear()}`;
  }

  if (badgesEl) {
    if (metrics.isSuiteCombo) {
      const isProSuite = metrics.planConst === 'pro' && metrics.planArq === 'pro';
      badgesEl.innerHTML = isProSuite
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase">Suite Pro</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/40 uppercase">Suite Plus</span>`;
    } else {
      badgesEl.innerHTML = `
        <span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-800 text-amber-300 border border-amber-500/30 uppercase">C: ${escapeAdminHtml(metrics.planConst)}</span>
        <span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-800 text-blue-300 border border-blue-500/30 uppercase">A: ${escapeAdminHtml(metrics.planArq)}</span>
      `;
    }
  }

  if (selConst) selConst.value = metrics.planConst || 'free';
  if (selArq) selArq.value = metrics.planArq || 'free';

  const isAnnual = metrics.billingCycle === 'annual';
  if (radioAnnual) radioAnnual.checked = isAnnual;
  if (radioMonthly) radioMonthly.checked = !isAnnual;

  const expiryRaw = user.periodoFin || user.periodo_fin || user.periodoFinConst || user.periodo_fin_const || user.periodoFinArq || user.periodo_fin_arq || user.vigenciaFin;
  let targetDate = expiryRaw ? new Date(expiryRaw) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(targetDate.getTime())) {
    targetDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }
  if (dateInput) {
    dateInput.value = formatDateInputYYYYMMDD(targetDate);
    dateInput.oninput = updateEditModalDaysRemaining;
    dateInput.onchange = updateEditModalDaysRemaining;
  }
  updateEditModalDaysRemaining();

  if (statusEl) {
    statusEl.className = 'hidden p-3 rounded-xl text-xs font-semibold';
    statusEl.textContent = '';
  }

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

export function closeEditMembershipModal() {
  const modal = document.getElementById('modal-admin-edit-membership');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  editingMembershipEmail = '';
}

export function setEditModalPresetDate(months) {
  const dateInput = document.getElementById('edit-member-expiry-date');
  if (!dateInput) return;

  if (Number(months) >= 999) {
    dateInput.value = '2099-12-31';
    updateEditModalDaysRemaining();
    return;
  }

  const m = Number(months) || 1;
  const base = new Date();
  base.setMonth(base.getMonth() + m);
  dateInput.value = formatDateInputYYYYMMDD(base);
  updateEditModalDaysRemaining();
}

export function applyComboProToEditModal() {
  const selConst = document.getElementById('edit-member-plan-const');
  const selArq = document.getElementById('edit-member-plan-arq');
  const radioAnnual = document.getElementById('edit-member-cycle-annual');
  const dateInput = document.getElementById('edit-member-expiry-date');
  if (selConst) selConst.value = 'pro';
  if (selArq) selArq.value = 'pro';
  if (radioAnnual) radioAnnual.checked = true;
  if (dateInput) {
    const parsed = dateInput.value ? new Date(`${dateInput.value}T23:59:59.000Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now()) {
      setEditModalPresetDate(12);
    }
  }
}

export async function saveUserMembershipFromModal() {
  if (!editingMembershipEmail) return;

  const selConst = document.getElementById('edit-member-plan-const');
  const selArq = document.getElementById('edit-member-plan-arq');
  const radioAnnual = document.getElementById('edit-member-cycle-annual');
  const dateInput = document.getElementById('edit-member-expiry-date');
  const statusEl = document.getElementById('edit-member-status');
  const saveBtn = document.getElementById('edit-member-save-btn');

  const planConst = selConst?.value || 'free';
  const planArq = selArq?.value || 'free';
  const billingCycle = radioAnnual?.checked ? 'annual' : 'monthly';
  const dateVal = dateInput?.value || '';
  const vigenciaFin = dateVal ? new Date(`${dateVal}T23:59:59.000Z`).toISOString() : null;
  const isCombo = (planConst === 'pro' && planArq === 'pro') || (planConst === 'plus' && planArq === 'plus');

  if (statusEl) {
    statusEl.className = 'hidden p-3 rounded-xl text-xs font-semibold';
    statusEl.textContent = '';
  }
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Guardando...</span>';
  }

  try {
    const targetEmail = editingMembershipEmail;
    await updateAdminUserPlan({
      email: targetEmail,
      planConst,
      planArq,
      isCombo,
      billingCycle,
      vigenciaFin,
      clearExpiry: !dateVal
    });

    closeEditMembershipModal();
    if (typeof window !== 'undefined' && typeof window.showPortalNotification === 'function') {
      window.showPortalNotification(`Membresía y vigencia de ${targetEmail} actualizadas en la nube.`, 'success');
    } else {
      alert(`Membresía y vigencia de ${targetEmail} actualizadas con éxito.`);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err?.message || 'No se pudo actualizar la membresía en la nube.';
      statusEl.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-200 block';
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Guardar Cambios</span>';
    }
  }
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
  window.printCubikarAdminTable = printCubikarAdminTable;
  window.setAdminAppScope = setAdminAppScope;
  window.setAdminTableSearch = setAdminTableSearch;
  window.setAdminFilterActivity = setAdminFilterActivity;
  window.setAdminFilterPlan = setAdminFilterPlan;
  window.setAdminFilterCycle = setAdminFilterCycle;
  window.onAdminUserCheckboxChange = onAdminUserCheckboxChange;
  window.toggleSelectAllAdminUsers = toggleSelectAllAdminUsers;
  window.deleteSelectedAdminUsers = deleteSelectedAdminUsers;
  window.updateAdminUserPlan = updateAdminUserPlan;
  window.addCoAdmin = addCoAdmin;
  window.removeCoAdmin = removeCoAdmin;
  window.openS3BackupsAdminModal = openS3BackupsAdminModal;
  window.closeS3BackupsAdminModal = closeS3BackupsAdminModal;
  window.onS3BackupUserChange = onS3BackupUserChange;
  window.onS3BackupDateChange = onS3BackupDateChange;
  window.downloadS3BackupObject = downloadS3BackupObject;
  window.openEditMembershipModal = openEditMembershipModal;
  window.closeEditMembershipModal = closeEditMembershipModal;
  window.setEditModalPresetDate = setEditModalPresetDate;
  window.applyComboProToEditModal = applyComboProToEditModal;
  window.saveUserMembershipFromModal = saveUserMembershipFromModal;
}
