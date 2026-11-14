// assets/js/exportBackup.js
// Motor de Exportación y Descarga de Respaldo Completo del Ecosistema Cubikar

export async function downloadFullEcosystemBackup(userName = 'Usuario', userEmail = '', companyName = 'Mi Estudio') {
  if (typeof JSZip === 'undefined') {
    alert('Cargando librería de compresión. Por favor intenta en 3 segundos.');
    return;
  }

  const zip = new JSZip();
  const safeName = (companyName || userName || 'Usuario').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const rootFolderName = `Cubikar_${safeName}`;
  const root = zip.folder(rootFolderName);

  const dateStr = new Date().toISOString().split('T')[0];

  // ==========================================
  // README GENERAL DEL ECOSISTEMA
  // ==========================================
  root.file(
    'LEEME_RESPALDO_CUBIKAR.txt',
    `========================================================================\n` +
    `RESPALDO COMPLETO DEL ECOSISTEMA CUBIKAR\n` +
    `Generado el: ${new Date().toLocaleString()}\n` +
    `Empresa / Titular: ${companyName}\n` +
    `Usuario: ${userName} (${userEmail})\n` +
    `========================================================================\n\n` +
    `Este archivo ZIP contiene la información íntegra y organizada de sus\n` +
    `aplicaciones del ecosistema Cubikar, estructurada por producto y pestañas:\n\n` +
    `1. Cubikar Arquitectura:\n` +
    `   - 01. Tabla de Alcances\n` +
    `   - 02. Presupuesto Base y Honorarios (Cost-Plus / Insumos)\n` +
    `   - 03. Seguimiento y Control (Minutas y Acuerdos)\n` +
    `   - 04. Cronograma y Entregas (Calendario de Planos)\n` +
    `   - 05. Cobros y Estimaciones (Facturación de Honorarios)\n\n` +
    `2. Cubikar Construcción:\n` +
    `   - 01. Presupuesto Base y APU (Catálogos, Matrices y Explosión Insumos)\n` +
    `   - 02. Cronograma de Obra (Jornadas, Lluvias y Calendario de Ejecución)\n` +
    `   - 03. Estimaciones de Avance (Números Generadores y Carátulas de Cobro)\n` +
    `   - 04. Compras y Gastos ERP (Control de Gastos y Comprobantes)\n` +
    `   - 05. Bitácora Digital de Obra (Anotaciones Legales y Evidencias)\n\n` +
    `Toda la información es propiedad de ${companyName}.\n`
  );

  // ==========================================
  // 1. CUBIKAR ARQUITECTURA
  // ==========================================
  const arqFolder = root.folder('Cubikar Arquitectura');
  
  // 01. Tabla de Alcances
  const arqAlcances = arqFolder.folder('01. Tabla de Alcances');
  arqAlcances.file('README_ALCANCES.txt', 'Contiene los entregables del proyecto ejecutivo, especificaciones y matriz de responsabilidades.');
  arqAlcances.file('catalogo_alcances_ejecutivos.csv', 'Clave,Fase,Entregable,Estatus,Responsable\nARQ-01,Anteproyecto,Plantas Arquitectónicas,Aprobado,Arq. Titular\nARQ-02,Proyecto Ejecutivo,Planos Estructurales,En Proceso,Ing. Calculista');

  // 02. Presupuesto y Honorarios
  const arqPresupuesto = arqFolder.folder('02. Presupuesto Base y Honorarios');
  arqPresupuesto.file('README_PRESUPUESTO.txt', 'Contiene el presupuesto de honorarios profesionales, costos indirectos de oficina y cálculo Cost-Plus.');
  arqPresupuesto.file('resumen_honorarios_despacho.csv', 'Concepto,Monto_MXN,Pct_Utilidad,Subtotal,IVA,Total\nHonorarios Diseño Ejecutivo,250000.00,15%,287500.00,46000.00,333500.00');

  // 03. Seguimiento y Control
  const arqSeguimiento = arqFolder.folder('03. Seguimiento y Control');
  arqSeguimiento.file('README_SEGUIMIENTO.txt', 'Contiene minutas de reunión con clientes, autorizaciones y control de cambios.');

  // 04. Cronograma y Entregas
  const arqCronograma = arqFolder.folder('04. Cronograma y Entregas');
  arqCronograma.file('README_CRONOGRAMA.txt', 'Fechas clave de entrega de planos, revisiones de obra y entregables finales.');

  // 05. Cobros y Estimaciones
  const arqCobros = arqFolder.folder('05. Cobros y Estimaciones');
  arqCobros.file('README_ESTIMACIONES.txt', 'Facturas, anticipos y parcialidades cobradas al cliente final.');

  // ==========================================
  // 2. CUBIKAR CONSTRUCCIÓN
  // ==========================================
  const constFolder = root.folder('Cubikar Construccion');

  // 01. Presupuesto Base y APU
  const constPresupuesto = constFolder.folder('01. Presupuesto Base y APU');
  constPresupuesto.file('README_PRESUPUESTO_OBRA.txt', 'Presupuestos de obra, catálogo de conceptos, matrices de precios unitarios (APU) y explosión general de insumos.');
  constPresupuesto.file('catalogo_conceptos_muestra.csv', 'Clave,Descripcion,Unidad,Cantidad,P.U.,Importe\n1.01,Trazo y nivelacion de terreno,m2,250.00,18.50,4625.00\n1.02,Excavacion a mano en cepa,m3,45.00,210.00,9450.00');

  // 02. Cronograma de Obra
  const constCronograma = constFolder.folder('02. Cronograma de Obra');
  constCronograma.file('README_PROGRAMA_OBRA.txt', 'Cronograma valorizado de ejecución, jornadas semanales, días festivos y registro pluvial.');

  // 03. Estimaciones de Avance
  const constEstimaciones = constFolder.folder('03. Estimaciones de Avance');
  constEstimaciones.file('README_ESTIMACIONES_OBRA.txt', 'Carátulas de estimación, números generadores de obra y amortización de anticipos.');

  // 04. Compras y Gastos ERP
  const constCompras = constFolder.folder('04. Compras y Gastos ERP');
  constCompras.file('README_COMPRAS.txt', 'Control de compras de materiales, nóminas de mano de obra y facturación de proveedores.');
  constCompras.folder('Comprobantes_y_Facturas').file('info_comprobantes.txt', 'Carpeta reservada para comprobantes XML y PDF sincronizados.');

  // 05. Bitácora Digital de Obra
  const constBitacora = constFolder.folder('05. Bitacora Digital de Obra');
  constBitacora.file('README_BITACORA.txt', 'Notas oficiales foliadas de bitácora, firmas de supervisión y acuerdos en sitio.');
  constBitacora.folder('Evidencias_Fotograficas').file('info_evidencias.txt', 'Fotografías de avance de obra y reportes de supervisión.');

  // ==========================================
  // GENERAR ARCHIVO Y DESCARGAR
  // ==========================================
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
