// assets/js/exportBackup.js
// Motor de Exportación y Descarga de Respaldo Completo del Ecosistema Cubikar (datos reales nube + local)

import { getSupabase } from './supabaseClient.js?v=20261119_cf43';
import { loadJSZip } from './libLoader.js?v=20261119_cf43';

export const BACKUP_PAGE_SIZE = 1000;
export const BACKUP_ID_BATCH_SIZE = 150;
const OBJECT_URL_TTL_MS = 30000;
const PROJECT_DETAIL_TABLES = [
  'estimaciones', 'compras_gastos', 'proveedores', 'bitacora_notas', 'bitacora_config',
  'cronograma_config', 'cronograma_actividades', 'chat_mensajes', 'archivos_almacen'
];
// Tablas cuya llave primaria es proyecto_id (no tienen columna id)
const TABLE_ORDER_COLUMN = { bitacora_config: 'proyecto_id', cronograma_config: 'proyecto_id' };
// Tablas opcionales: si no existen o fallan, el respaldo continúa y se reporta en el LEEME
const OPTIONAL_TABLES = new Set(['proveedores', 'bitacora_config', 'cronograma_config', 'cronograma_actividades', 'chat_mensajes', 'archivos_almacen']);
export const backupWarnings = [];

let backupInProgress = false;

function csvEscape(val) {
  const s = String(val ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toFolderSlug(name, id) {
  const base = String(name ?? '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 45) || 'Proyecto';
  return `${base}_${String(id).slice(0, 8)}`;
}

function flattenTreeConceptsToCsv(nodes, parentPath = '', out = []) {
  if (!Array.isArray(nodes)) return out;
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    const isConcept = n.type === 'concept' || (!Array.isArray(n.children) || n.children.length === 0);
    if (isConcept && (n.code || n.clave || n.description || n.descripcion || n.title)) {
      const qty = Number(n.quantity ?? n.cantidad ?? 0);
      const pu = Number(n.unitPrice ?? n.precioUnitario ?? n.precio_unitario ?? 0);
      const imp = Number(n.total ?? n.importe ?? (qty * pu)) || 0;
      out.push([
        csvEscape(parentPath || n.partida || ''),
        csvEscape(n.code || n.clave || n.id || ''),
        csvEscape(n.description || n.descripcion || n.title || n.name || ''),
        csvEscape(n.unit || n.unidad || ''),
        qty.toFixed(4),
        pu.toFixed(4),
        imp.toFixed(2)
      ].join(','));
    }
    if (Array.isArray(n.children) && n.children.length > 0) {
      const label = n.code ? `${n.code} ${n.description || n.title || ''}`.trim() : (n.description || n.title || parentPath);
      flattenTreeConceptsToCsv(n.children, label, out);
    }
  }
  return out;
}

function chunkList(list, size) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
  return chunks;
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

export async function fetchAllPages(buildQuery, pageSize = BACKUP_PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function fetchRowsByIds(sb, table, column, ids, batchSize = BACKUP_ID_BATCH_SIZE) {
  const rows = [];
  const orderCol = TABLE_ORDER_COLUMN[table] || 'id';
  for (const batch of chunkList(ids, batchSize)) {
    const batchRows = await fetchAllPages(() => sb.from(table).select('*').in(column, batch).order(orderCol, { ascending: true }));
    rows.push(...batchRows);
  }
  return rows;
}

async function fetchCloudBackupData(sb) {
  const projects = await fetchAllPages(() => sb
    .from('proyectos')
    .select('*, proyecto_colaboradores(*)')
    .order('id', { ascending: true }));
  projects.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));

  const projIds = projects.map(p => p.id).filter(Boolean);
  const byTable = {};
  backupWarnings.length = 0;
  for (const table of ['catalogo_conceptos', ...PROJECT_DETAIL_TABLES]) {
    let rows = [];
    try {
      rows = projIds.length ? await fetchRowsByIds(sb, table, 'proyecto_id', projIds) : [];
    } catch (err) {
      if (!OPTIONAL_TABLES.has(table)) throw err;
      backupWarnings.push(`${table}: ${err?.message || err}`);
      rows = [];
    }
    byTable[table] = groupBy(rows, r => r.proyecto_id);
  }

  const concepts = Array.from(byTable.catalogo_conceptos.values()).flat();
  const conceptToProj = new Map(concepts.map(c => [c.id, c.proyecto_id]));
  const conceptIds = concepts.map(c => c.id).filter(Boolean);
  const insumos = conceptIds.length ? await fetchRowsByIds(sb, 'insumos_apu', 'concepto_id', conceptIds) : [];
  byTable.insumos_apu = groupBy(insumos, ins => ins.proyecto_id || conceptToProj.get(ins.concepto_id));

  return { projects, byTable };
}

function readLocalProjects(cleanEmail) {
  if (typeof localStorage === 'undefined') return [];
  const deletedIds = new Set(JSON.parse(localStorage.getItem('cubikar_deleted_projects_v1') || '[]'));
  const rawProjects = JSON.parse(localStorage.getItem('control_obra_projects_v1') || '[]');
  if (!Array.isArray(rawProjects)) return [];
  return rawProjects.filter(p => {
    if (!p || !p.id || deletedIds.has(p.id) || (p.cloudId && deletedIds.has(p.cloudId))) return false;
    const owner = String(p.ownerEmail || '').toLowerCase().trim();
    return !cleanEmail ||
      !owner ||
      owner === cleanEmail ||
      (Array.isArray(p.members) && p.members.some(m => String(m?.email || '').toLowerCase().trim() === cleanEmail));
  });
}

function triggerZipDownload(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), OBJECT_URL_TTL_MS);
}

export async function downloadFullEcosystemBackup(userName = 'Usuario', userEmail = '', companyName = 'Mi Estudio') {
  if (backupInProgress) {
    alert('Ya se está generando un respaldo. Espera a que termine la descarga.');
    return false;
  }
  backupInProgress = true;
  try {
    const JSZip = await loadJSZip();
    const cleanEmail = String(userEmail || '').toLowerCase().trim();

    let cloudProjects = [];
    let cloudByTable = {};
    const sb = getSupabase();
    if (sb) {
      const { data: sessData, error: sessError } = await sb.auth.getSession();
      if (sessError) throw sessError;
      if (sessData?.session?.user) {
        const cloud = await fetchCloudBackupData(sb);
        cloudProjects = cloud.projects;
        cloudByTable = cloud.byTable;
      }
    }
    const cloudRows = (table, projectId) => cloudByTable[table]?.get(projectId) || [];

    const localProjects = readLocalProjects(cleanEmail);

    const zip = new JSZip();
    const safeName = String(companyName || userName || 'Usuario').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const root = zip.folder(`Cubikar_${safeName}`);
    const dateStr = new Date().toISOString().split('T')[0];

    const seenIds = new Set(cloudProjects.map(p => p.id));
    const summaryRows = [
      'Origen,ID,Nombre,Tipo_Obra,Ubicacion,Empresa,Moneda,Propietario,Actualizado'
    ];

    const projectsFolder = root.folder('Proyectos_Reales');
    let trashProjectsFolder = null;

    for (const cp of cloudProjects) {
      const isTrashed = Boolean(cp.deleted_at);
      const parentDir = isTrashed
        ? (trashProjectsFolder || (trashProjectsFolder = root.folder('Papelera_7_Dias')))
        : projectsFolder;
      const pDir = parentDir.folder(toFolderSlug(cp.nombre || cp.clave || cp.id, cp.id));
      summaryRows.push([
        isTrashed ? 'Papelera (7 días)' : 'Nube',
        csvEscape(cp.id),
        csvEscape(cp.nombre),
        csvEscape(cp.tipo_obra),
        csvEscape(cp.ubicacion),
        csvEscape(cp.configuracion?.companyName || companyName),
        csvEscape(cp.moneda || 'MXN'),
        csvEscape(cp.owner_email || userEmail),
        csvEscape(cp.updated_at || '')
      ].join(','));

      pDir.file('proyecto_metadata.json', JSON.stringify(cp, null, 2));

      const concepts = cloudRows('catalogo_conceptos', cp.id);
      pDir.file('catalogo_conceptos.json', JSON.stringify(concepts, null, 2));
      const cRows = ['Partida,Clave,Descripcion,Unidad,Cantidad,Precio_Unitario,Importe'];
      for (const c of concepts) {
        const qty = Number(c.cantidad ?? 0);
        const pu = Number(c.precio_unitario ?? c.costo_directo ?? 0);
        cRows.push([
          csvEscape(c.partida || c.parent_id || ''),
          csvEscape(c.clave || ''),
          csvEscape(c.descripcion || ''),
          csvEscape(c.unidad || ''),
          qty.toFixed(4),
          pu.toFixed(4),
          (qty * pu).toFixed(2)
        ].join(','));
      }
      pDir.file('catalogo_conceptos.csv', '\uFEFF' + cRows.join('\n'));

      for (const table of ['insumos_apu', ...PROJECT_DETAIL_TABLES]) {
        const rows = cloudRows(table, cp.id);
        if (rows.length > 0) pDir.file(`${table}.json`, JSON.stringify(rows, null, 2));
      }
    }

    if (backupWarnings.length > 0) {
      projectsFolder.file('ADVERTENCIAS_RESPALDO.txt', 'Tablas que no pudieron incluirse en este respaldo:\n' + backupWarnings.join('\n'));
    }

    for (const lp of localProjects) {
      if (seenIds.has(lp.id) || (lp.cloudId && seenIds.has(lp.cloudId))) continue;
      const pDir = projectsFolder.folder(toFolderSlug(lp.projectName || lp.id, lp.id));
      summaryRows.push([
        'Local',
        csvEscape(lp.id),
        csvEscape(lp.projectName),
        csvEscape(lp.tipoObra || ''),
        csvEscape(lp.projectLocation || ''),
        csvEscape(lp.companyName || companyName),
        csvEscape(lp.currency || 'MXN'),
        csvEscape(lp.ownerEmail || userEmail),
        csvEscape(lp.createdAt || '')
      ].join(','));

      pDir.file('proyecto_metadata.json', JSON.stringify(lp, null, 2));
      try {
        const rawTree = localStorage.getItem(`control_obra_treeData_${lp.id}`);
        const rawSettings = localStorage.getItem(`control_obra_settings_${lp.id}`);
        const rawEst = localStorage.getItem(`estimaciones_data_${lp.id}`);
        const rawCompras = localStorage.getItem(`expenses_control_${lp.id}`) || localStorage.getItem(`compras_data_${lp.id}`);
        if (rawSettings) pDir.file('configuracion.json', rawSettings);
        if (rawEst) pDir.file('estimaciones.json', rawEst);
        if (rawCompras) pDir.file('compras_gastos.json', rawCompras);
        if (rawTree) {
          pDir.file('presupuesto_tree.json', rawTree);
          const treeLines = ['Partida,Clave,Descripcion,Unidad,Cantidad,Precio_Unitario,Importe'];
          flattenTreeConceptsToCsv(JSON.parse(rawTree), '', treeLines);
          pDir.file('catalogo_conceptos.csv', '\uFEFF' + treeLines.join('\n'));
        }
      } catch (_) {}
    }

    const totalExported = summaryRows.length - 1;
    root.file('RESUMEN_PROYECTOS.csv', '\uFEFF' + summaryRows.join('\n'));
    root.file(
      'LEEME_RESPALDO_CUBIKAR.txt',
      `========================================================================\n` +
      `RESPALDO COMPLETO DEL ECOSISTEMA CUBIKAR\n` +
      `Generado el: ${new Date().toLocaleString()}\n` +
      `Empresa / Titular: ${companyName}\n` +
      `Usuario: ${userName} (${userEmail || 'sin sesión'})\n` +
      `Proyectos reales exportados: ${totalExported} (Nube: ${cloudProjects.length}, Locales adicionales: ${Math.max(0, totalExported - cloudProjects.length)})\n` +
      `========================================================================\n\n` +
      (totalExported > 0
        ? `Cada carpeta dentro de Proyectos_Reales/ contiene los metadatos JSON,\ncatálogo CSV/JSON, insumos APU, estimaciones, compras, cronograma y bitácora del proyecto.\n`
        : `No se encontraron proyectos reales registrados para esta cuenta en la sesión actual.\nInicia sesión o crea/abre proyectos antes de generar el respaldo.\n`)
    );

    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', streamFiles: true });
    triggerZipDownload(content, `Cubikar_${safeName}_Respaldo_${dateStr}.zip`);
    return true;
  } catch (err) {
    console.error('[ExportBackup] Respaldo cancelado:', err);
    alert(`No se pudo generar el respaldo completo: ${err?.message || err}.\nNo se descargó ningún archivo para evitar un respaldo incompleto. Inténtalo de nuevo.`);
    return false;
  } finally {
    backupInProgress = false;
  }
}
