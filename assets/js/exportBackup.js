// assets/js/exportBackup.js
// Motor de Exportación y Descarga de Respaldo Completo del Ecosistema Cubikar (datos reales nube + local)

import { getSupabase } from './supabaseClient.js?v=20261116_cf10';

function csvEscape(val) {
  const s = String(val ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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

export async function downloadFullEcosystemBackup(userName = 'Usuario', userEmail = '', companyName = 'Mi Estudio') {
  if (typeof JSZip === 'undefined') {
    alert('Cargando librería de compresión. Por favor intenta en 3 segundos.');
    return;
  }

  const zip = new JSZip();
  const safeName = (companyName || userName || 'Usuario').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const root = zip.folder(`Cubikar_${safeName}`);
  const dateStr = new Date().toISOString().split('T')[0];
  const cleanEmail = (userEmail || '').toLowerCase().trim();

  // 1. Obtener proyectos reales desde Supabase (si hay sesión autenticada)
  let cloudProjects = [];
  let cloudConceptsByProj = new Map();
  let cloudInsumosByProj = new Map();
  let cloudEstimacionesByProj = new Map();
  let cloudComprasByProj = new Map();
  let cloudCronoByProj = new Map();
  let cloudBitacoraByProj = new Map();

  try {
    const sb = getSupabase();
    if (sb) {
      const { data: sessData } = await sb.auth.getSession();
      if (sessData?.session?.user) {
        const { data: projs } = await sb
          .from('proyectos')
          .select('*, proyecto_colaboradores(*)')
          .order('updated_at', { ascending: false });

        if (Array.isArray(projs) && projs.length > 0) {
          cloudProjects = projs;
          const projIds = projs.map(p => p.id).filter(Boolean);
          const groupByProj = (rows) => {
            const m = new Map();
            if (!Array.isArray(rows)) return m;
            for (const r of rows) {
              if (!m.has(r.proyecto_id)) m.set(r.proyecto_id, []);
              m.get(r.proyecto_id).push(r);
            }
            return m;
          };

          const [resConceptos, eRes, comRes, crRes, bRes] = await Promise.all([
            sb.from('catalogo_conceptos').select('*').in('proyecto_id', projIds),
            sb.from('estimaciones').select('*').in('proyecto_id', projIds),
            sb.from('compras_gastos').select('*').in('proyecto_id', projIds),
            sb.from('cronograma_actividades').select('*').in('proyecto_id', projIds),
            sb.from('bitacora_notas').select('*').in('proyecto_id', projIds)
          ]);

          const conceptIds = (resConceptos?.data || []).map(c => c.id).filter(Boolean);
          const conceptToProj = new Map((resConceptos?.data || []).map(c => [c.id, c.proyecto_id]));
          const iRes = conceptIds.length > 0
            ? await sb.from('insumos_apu').select('*').in('concepto_id', conceptIds)
            : { data: [] };

          cloudConceptsByProj = groupByProj(resConceptos?.data);
          cloudInsumosByProj = new Map();
          for (const ins of (iRes?.data || [])) {
            const pid = ins.proyecto_id || conceptToProj.get(ins.concepto_id);
            if (!pid) continue;
            if (!cloudInsumosByProj.has(pid)) cloudInsumosByProj.set(pid, []);
            cloudInsumosByProj.get(pid).push(ins);
          }
          cloudEstimacionesByProj = groupByProj(eRes?.data);
          cloudComprasByProj = groupByProj(comRes?.data);
          cloudCronoByProj = groupByProj(crRes?.data);
          cloudBitacoraByProj = groupByProj(bRes?.data);
        }
      }
    }
  } catch (err) {
    console.warn('[ExportBackup] Aviso consultando datos en nube:', err?.message || err);
  }

  // 2. Complementar con proyectos locales offline si existen en este navegador
  const localProjects = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const deletedIds = new Set(JSON.parse(localStorage.getItem('cubikar_deleted_projects_v1') || '[]'));
      const rawProjects = JSON.parse(localStorage.getItem('control_obra_projects_v1') || '[]');
      if (Array.isArray(rawProjects)) {
        for (const p of rawProjects) {
          if (!p || !p.id || deletedIds.has(p.id) || (p.cloudId && deletedIds.has(p.cloudId))) continue;
          const isOwnedOrMember = !cleanEmail ||
            (p.ownerEmail || '').toLowerCase().trim() === cleanEmail ||
            (Array.isArray(p.members) && p.members.some(m => (m.email || '').toLowerCase().trim() === cleanEmail));
          if (isOwnedOrMember) {
            localProjects.push(p);
          }
        }
      }
    }
  } catch (_) {}

  // Combinar por ID sin duplicar
  const seenIds = new Set(cloudProjects.map(p => p.id));
  const summaryRows = [
    'Origen,ID,Nombre,Tipo_Obra,Ubicacion,Empresa,Moneda,Propietario,Actualizado'
  ];

  const projectsFolder = root.folder('Proyectos_Reales');

  for (const cp of cloudProjects) {
    const folderSlug = `${(cp.nombre || cp.clave || cp.id).replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 45) || 'Proyecto'}_${String(cp.id).slice(0, 8)}`;
    const pDir = projectsFolder.folder(folderSlug);
    summaryRows.push([
      'Nube',
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

    const concepts = cloudConceptsByProj.get(cp.id) || [];
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

    const insumos = cloudInsumosByProj.get(cp.id) || [];
    if (insumos.length > 0) pDir.file('insumos_apu.json', JSON.stringify(insumos, null, 2));

    const ests = cloudEstimacionesByProj.get(cp.id) || [];
    if (ests.length > 0) pDir.file('estimaciones.json', JSON.stringify(ests, null, 2));

    const compras = cloudComprasByProj.get(cp.id) || [];
    if (compras.length > 0) pDir.file('compras_gastos.json', JSON.stringify(compras, null, 2));

    const crono = cloudCronoByProj.get(cp.id) || [];
    if (crono.length > 0) pDir.file('cronograma_actividades.json', JSON.stringify(crono, null, 2));

    const bitacora = cloudBitacoraByProj.get(cp.id) || [];
    if (bitacora.length > 0) pDir.file('bitacora_notas.json', JSON.stringify(bitacora, null, 2));
  }

  for (const lp of localProjects) {
    if (seenIds.has(lp.id) || (lp.cloudId && seenIds.has(lp.cloudId))) continue;
    const folderSlug = `${(lp.projectName || lp.id).replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 45) || 'Proyecto'}_${String(lp.id).slice(0, 8)}`;
    const pDir = projectsFolder.folder(folderSlug);
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
      const rawCompras = localStorage.getItem(`compras_data_${lp.id}`);
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
    `Usuario: ${userName} (${userEmail})\n` +
    `Proyectos reales exportados: ${totalExported} (Nube: ${cloudProjects.length}, Locales adicionales: ${Math.max(0, totalExported - cloudProjects.length)})\n` +
    `========================================================================\n\n` +
    (totalExported > 0
      ? `Cada carpeta dentro de Proyectos_Reales/ contiene los metadatos JSON,\ncatálogo CSV/JSON, insumos APU, estimaciones, compras, cronograma y bitácora del proyecto.\n`
      : `No se encontraron proyectos reales registrados para esta cuenta en la sesión actual.\nInicia sesión o crea/abre proyectos antes de generar el respaldo.\n`)
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `Cubikar_${safeName}_Respaldo_${dateStr}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
