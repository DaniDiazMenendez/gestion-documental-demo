import type { ActivityEntry, Area, Confidentiality, DemoState, DocStatus, DocType, DocumentItem } from '../types';
import { daysAgoIso, getExtension } from '../lib/utils';
import { simulateValidation, toValidationInput } from '../lib/validation';

export const STATE_VERSION = 1;
export const SYSTEM_USER = 'Sistema (IA)';
export const REVIEWER = 'Javier Méndez';

interface SeedDoc {
  title: string;
  type: DocType;
  area: Area;
  status: DocStatus;
  confidentiality: Confidentiality;
  owner: string;
  created: number;
  updated: number;
  sizeKb: number;
  fileName: string;
  tags: string[];
  summary: string;
  content: string;
  confidence: number;
  fields: [string, string, number][];
  version?: number;
  comment?: string;
}

const SEED_DOCS: SeedDoc[] = [
  {
    title: 'Contrato marco de servicios de nube – Contoso Cloud',
    type: 'Contrato', area: 'Tecnología', status: 'Aprobado', confidentiality: 'Confidencial', owner: 'Lucía Fernández',
    created: 16, updated: 12, sizeKb: 2480, fileName: 'contrato-marco-contoso-cloud.pdf',
    tags: ['nube', 'proveedor', 'SLA', 'renovación automática'],
    summary: 'Contrato marco de infraestructura en la nube con SLA de disponibilidad del 99,9 % y penalidades por incumplimiento.',
    content: 'Contrato marco de prestación de servicios de infraestructura en la nube entre la Compañía y Contoso Cloud S.A. Firmado el 01/03/2026 con vigencia de 36 meses; vence el 28/02/2029 con renovación automática. Incluye SLA de disponibilidad del 99,9 %, soporte 24x7 y penalidades por incumplimiento. Proveedor: Contoso Cloud S.A.',
    confidence: 0.97,
    fields: [['Contraparte', 'Contoso Cloud S.A.', 0.98], ['Fecha de firma', '01/03/2026', 0.96], ['Vence', '28/02/2029', 0.94], ['Monto anual', 'USD 480.000', 0.91]],
    version: 2,
  },
  {
    title: 'Factura A 0003-00012457 – Contoso Cloud',
    type: 'Factura', area: 'Finanzas', status: 'En revisión', confidentiality: 'Interna', owner: 'Sofía Herrera',
    created: 3, updated: 3, sizeKb: 312, fileName: 'FC-A-0003-00012457.pdf',
    tags: ['factura', 'proveedor', 'nube', 'octubre 2026'],
    summary: 'Factura por servicios de nube de octubre 2026, pendiente de conciliación con la orden de compra OC-8841.',
    content: 'Factura A N° 0003-00012457 emitida por Contoso Cloud S.A., CUIT 30-71234567-8, el 05/11/2026. Servicios de infraestructura en la nube correspondientes a octubre 2026. Importe total ARS 12.450.300,00. Pendiente de conciliación con la orden de compra OC-8841.',
    confidence: 0.99,
    fields: [['Proveedor', 'Contoso Cloud S.A.', 0.99], ['CUIT', '30-71234567-8', 0.97], ['N° de comprobante', '0003-00012457', 0.98], ['Fecha de emisión', '05/11/2026', 0.96], ['Importe total', 'ARS 12.450.300,00', 0.93]],
  },
  {
    title: 'Política de seguridad de la información v3.2',
    type: 'Política', area: 'Tecnología', status: 'Aprobado', confidentiality: 'Interna', owner: 'Diego Romero',
    created: 15, updated: 10, sizeKb: 1140, fileName: 'politica-seguridad-informacion-v3.2.docx',
    tags: ['seguridad', 'ISO 27001', 'accesos', 'contraseñas'],
    summary: 'Lineamientos de seguridad de la información alineados con ISO 27001: control de accesos, clasificación y gestión de incidentes.',
    content: 'Política de seguridad de la información versión 3.2. Establece el control de accesos con mínimo privilegio, autenticación multifactor obligatoria, clasificación de la información (Pública, Interna, Confidencial) y el procedimiento de gestión de incidentes. Próxima revisión: 30/06/2027.',
    confidence: 0.95,
    fields: [['Versión', '3.2', 0.99], ['Responsable', 'Diego Romero', 0.93], ['Próxima revisión', '30/06/2027', 0.9]],
    version: 3,
  },
  {
    title: 'Acta de Directorio N° 145',
    type: 'Acta', area: 'Legal', status: 'Aprobado', confidentiality: 'Confidencial', owner: 'Lucía Fernández',
    created: 14, updated: 11, sizeKb: 860, fileName: 'acta-directorio-145.pdf',
    tags: ['directorio', 'gobierno corporativo', 'presupuesto 2027'],
    summary: 'Acta de la reunión de Directorio que aprueba el presupuesto 2027 y la renovación del contrato de nube.',
    content: 'Acta de Directorio N° 145. En la reunión del 30/10/2026 el Directorio aprobó el presupuesto 2027, ratificó la renovación del contrato marco con Contoso Cloud y designó al Comité de Riesgos para el seguimiento del plan de continuidad.',
    confidence: 0.96,
    fields: [['Órgano', 'Directorio', 0.99], ['Fecha de reunión', '30/10/2026', 0.95], ['Participantes', '7', 0.88]],
  },
  {
    title: 'Informe de gestión trimestral Q3 2026',
    type: 'Informe', area: 'Operaciones', status: 'Aprobado', confidentiality: 'Interna', owner: 'Javier Méndez',
    created: 13, updated: 9, sizeKb: 3560, fileName: 'informe-gestion-q3-2026.pdf',
    tags: ['indicadores', 'trimestral', 'gestión'],
    summary: 'Resultados operativos del tercer trimestre 2026: productividad, tiempos de respuesta y cumplimiento de objetivos.',
    content: 'Informe de gestión del tercer trimestre 2026. La productividad creció un 8 %, el tiempo promedio de respuesta bajó a 2,1 días y se cumplió el 92 % de los objetivos operativos. Se recomienda ampliar la digitalización de expedientes.',
    confidence: 0.92,
    fields: [['Autor', 'Javier Méndez', 0.94], ['Período', 'Q3 2026', 0.97], ['Páginas', '28', 0.99]],
  },
  {
    title: 'Contrato de locación de oficinas – Torre Norte',
    type: 'Contrato', area: 'Legal', status: 'En revisión', confidentiality: 'Confidencial', owner: 'Lucía Fernández',
    created: 5, updated: 4, sizeKb: 1720, fileName: 'contrato-locacion-torre-norte.pdf',
    tags: ['inmueble', 'locación', 'vencimiento'],
    summary: 'Contrato de locación de los pisos 12 y 13 de Torre Norte; vence el 31/12/2026 y requiere decisión de renovación.',
    content: 'Contrato de locación de oficinas en Torre Norte, pisos 12 y 13. Locador: Inversiones Torre Norte S.A. Canon mensual ARS 18.500.000 con actualización trimestral. El contrato vence el 31/12/2026 y requiere preaviso de 60 días para su renovación.',
    confidence: 0.94,
    fields: [['Contraparte', 'Inversiones Torre Norte S.A.', 0.95], ['Vence', '31/12/2026', 0.97], ['Canon mensual', 'ARS 18.500.000', 0.9]],
  },
  {
    title: 'Factura B 0001-00004589 – Fabrikam Logística',
    type: 'Factura', area: 'Compras', status: 'Rechazado', confidentiality: 'Interna', owner: 'Sofía Herrera',
    created: 9, updated: 7, sizeKb: 228, fileName: 'FC-B-0001-00004589.pdf',
    tags: ['factura', 'logística', 'proveedor'],
    summary: 'Factura de servicios logísticos rechazada: el importe no coincide con la orden de compra OC-8790.',
    content: 'Factura B N° 0001-00004589 emitida por Fabrikam Logística S.R.L. el 28/10/2026 por servicios de distribución. Importe total ARS 3.870.000,00. Orden de compra asociada OC-8790 por ARS 3.540.000,00.',
    confidence: 0.98,
    fields: [['Proveedor', 'Fabrikam Logística S.R.L.', 0.97], ['N° de comprobante', '0001-00004589', 0.98], ['Importe total', 'ARS 3.870.000,00', 0.92]],
    comment: 'El importe facturado no coincide con la orden de compra OC-8790. Se solicitó nota de crédito al proveedor.',
  },
  {
    title: 'Legajo – Alta de personal Martín Sosa',
    type: 'Legajo', area: 'Recursos Humanos', status: 'En revisión', confidentiality: 'Confidencial', owner: 'Carolina Ruiz',
    created: 2, updated: 2, sizeKb: 940, fileName: 'legajo-alta-martin-sosa.pdf',
    tags: ['alta', 'personal', 'onboarding'],
    summary: 'Documentación de alta del colaborador Martín Sosa para el puesto de Analista de Datos.',
    content: 'Legajo de alta de personal. Colaborador: Martín Sosa, DNI 34.567.890. Puesto: Analista de Datos en el área de Tecnología. Fecha de ingreso: 01/12/2026. Incluye contrato laboral, constancia de CUIL y apto médico.',
    confidence: 0.93,
    fields: [['Colaborador', 'Martín Sosa', 0.98], ['Puesto', 'Analista de Datos', 0.94], ['Fecha de ingreso', '01/12/2026', 0.95]],
  },
  {
    title: 'Procedimiento de compras y contrataciones',
    type: 'Política', area: 'Compras', status: 'Borrador', confidentiality: 'Interna', owner: 'Sofía Herrera',
    created: 1, updated: 1, sizeKb: 640, fileName: 'procedimiento-compras-v1.docx',
    tags: ['compras', 'aprobaciones', 'proveedores'],
    summary: 'Borrador del procedimiento que define niveles de aprobación, cotizaciones mínimas y alta de proveedores.',
    content: 'Procedimiento de compras y contrataciones. Toda compra superior a ARS 5.000.000 requiere tres cotizaciones y aprobación de la Gerencia de Finanzas. El alta de proveedores exige constancia de inscripción y verificación de antecedentes.',
    confidence: 0.88,
    fields: [['Versión', '1.0 (borrador)', 0.96], ['Responsable', 'Sofía Herrera', 0.9]],
  },
  {
    title: 'Informe de auditoría interna – Proceso de pagos',
    type: 'Informe', area: 'Finanzas', status: 'En revisión', confidentiality: 'Confidencial', owner: 'Javier Méndez',
    created: 4, updated: 3, sizeKb: 2110, fileName: 'auditoria-interna-pagos-2026.pdf',
    tags: ['auditoría', 'pagos', 'controles'],
    summary: 'Auditoría del proceso de pagos a proveedores con tres hallazgos de riesgo medio y un plan de acción.',
    content: 'Informe de auditoría interna sobre el proceso de pagos a proveedores. Se identificaron tres hallazgos de riesgo medio: falta de doble firma en pagos urgentes, conciliaciones bancarias con demora y facturas sin orden de compra. Se acordó un plan de acción con vencimiento en marzo 2027.',
    confidence: 0.9,
    fields: [['Autor', 'Javier Méndez', 0.95], ['Hallazgos', '3 (riesgo medio)', 0.89], ['Plan de acción', 'Marzo 2027', 0.86]],
  },
  {
    title: 'Acuerdo de confidencialidad (NDA) – Northwind Traders',
    type: 'Contrato', area: 'Legal', status: 'Aprobado', confidentiality: 'Confidencial', owner: 'Lucía Fernández',
    created: 12, updated: 8, sizeKb: 410, fileName: 'nda-northwind-traders.pdf',
    tags: ['NDA', 'confidencialidad', 'proveedor'],
    summary: 'Acuerdo de confidencialidad bilateral con Northwind Traders para el proyecto de integración logística.',
    content: 'Acuerdo de confidencialidad bilateral entre la Compañía y Northwind Traders S.A., firmado el 15/09/2026. Protege la información intercambiada durante el proyecto de integración logística. Vence en septiembre 2028.',
    confidence: 0.96,
    fields: [['Contraparte', 'Northwind Traders S.A.', 0.97], ['Fecha de firma', '15/09/2026', 0.95], ['Vence', '15/09/2028', 0.93]],
  },
  {
    title: 'Factura A 0005-00078812 – Northwind Traders',
    type: 'Factura', area: 'Compras', status: 'Aprobado', confidentiality: 'Interna', owner: 'Sofía Herrera',
    created: 10, updated: 6, sizeKb: 274, fileName: 'FC-A-0005-00078812.pdf',
    tags: ['factura', 'insumos', 'proveedor'],
    summary: 'Factura de insumos de embalaje conciliada con la orden de compra OC-8812 y aprobada para pago.',
    content: 'Factura A N° 0005-00078812 emitida por Northwind Traders S.A. el 20/10/2026 por insumos de embalaje. Importe total ARS 2.315.480,00. Conciliada con la orden de compra OC-8812.',
    confidence: 0.99,
    fields: [['Proveedor', 'Northwind Traders S.A.', 0.98], ['Fecha de emisión', '20/10/2026', 0.97], ['Importe total', 'ARS 2.315.480,00', 0.95]],
  },
  {
    title: 'Acta de Comité de Riesgos – Octubre 2026',
    type: 'Acta', area: 'Operaciones', status: 'Borrador', confidentiality: 'Interna', owner: 'Diego Romero',
    created: 0, updated: 0, sizeKb: 520, fileName: 'acta-comite-riesgos-oct-2026.docx',
    tags: ['riesgos', 'comité', 'continuidad'],
    summary: 'Borrador del acta del Comité de Riesgos con la revisión del plan de continuidad del negocio.',
    content: 'Acta del Comité de Riesgos de octubre 2026. Se revisó el plan de continuidad del negocio, la matriz de riesgos tecnológicos y el estado de las acciones correctivas de la auditoría de pagos.',
    confidence: 0.91,
    fields: [['Órgano', 'Comité de Riesgos', 0.97], ['Participantes', '6', 0.86]],
  },
  {
    title: 'Política de retención documental v1.0',
    type: 'Política', area: 'Legal', status: 'Archivado', confidentiality: 'Pública', owner: 'Lucía Fernández',
    created: 17, updated: 15, sizeKb: 380, fileName: 'politica-retencion-documental-v1.pdf',
    tags: ['retención', 'archivo', 'normativa'],
    summary: 'Versión anterior de la política de retención documental, reemplazada por la versión 2.0.',
    content: 'Política de retención documental versión 1.0. Define plazos de conservación de 10 años para documentación contable y 5 años para documentación comercial. Reemplazada por la versión 2.0.',
    confidence: 0.9,
    fields: [['Versión', '1.0', 0.99], ['Estado normativo', 'Reemplazada', 0.85]],
  },
  {
    title: 'Informe anual de capacitación 2025',
    type: 'Informe', area: 'Recursos Humanos', status: 'Archivado', confidentiality: 'Interna', owner: 'Carolina Ruiz',
    created: 17, updated: 14, sizeKb: 1890, fileName: 'informe-capacitacion-2025.pdf',
    tags: ['capacitación', 'anual', 'RRHH'],
    summary: 'Resumen de horas de capacitación, satisfacción y cobertura del plan de formación 2025.',
    content: 'Informe anual de capacitación 2025. Se dictaron 4.200 horas de formación con una cobertura del 87 % de la plantilla y una satisfacción promedio de 4,5 sobre 5.',
    confidence: 0.89,
    fields: [['Período', '2025', 0.99], ['Horas dictadas', '4.200', 0.93], ['Cobertura', '87 %', 0.91]],
  },
  {
    title: 'Contrato de mantenimiento de equipos – Adventure Works',
    type: 'Contrato', area: 'Operaciones', status: 'En revisión', confidentiality: 'Interna', owner: 'Diego Romero',
    created: 6, updated: 5, sizeKb: 1350, fileName: 'contrato-mantenimiento-adventure-works.pdf',
    tags: ['mantenimiento', 'equipos', 'proveedor'],
    summary: 'Contrato de mantenimiento preventivo y correctivo de equipos industriales; vence el 15/01/2027.',
    content: 'Contrato de mantenimiento preventivo y correctivo de equipos industriales con Adventure Works S.A., firmado el 15/01/2026. Vence el 15/01/2027. Tiempo de respuesta máximo de 4 horas para fallas críticas.',
    confidence: 0.93,
    fields: [['Contraparte', 'Adventure Works S.A.', 0.96], ['Fecha de firma', '15/01/2026', 0.94], ['Vence', '15/01/2027', 0.95]],
  },
  {
    title: 'Factura A 0002-00009931 – Adventure Works',
    type: 'Factura', area: 'Operaciones', status: 'Borrador', confidentiality: 'Interna', owner: 'María González',
    created: 0, updated: 0, sizeKb: 196, fileName: 'FC-A-0002-00009931.jpg',
    tags: ['factura', 'mantenimiento'],
    summary: 'Factura escaneada por servicios de mantenimiento de noviembre, pendiente de validación.',
    content: 'Factura A N° 0002-00009931 de Adventure Works S.A. por servicios de mantenimiento de noviembre 2026. Importe total ARS 1.248.000,00.',
    confidence: 0.82,
    fields: [['Proveedor', 'Adventure Works S.A.', 0.88], ['Importe total', 'ARS 1.248.000,00', 0.79]],
  },
  {
    title: 'Legajo – Evaluación de desempeño 2026 Carolina Ruiz',
    type: 'Legajo', area: 'Recursos Humanos', status: 'Aprobado', confidentiality: 'Confidencial', owner: 'Carolina Ruiz',
    created: 11, updated: 7, sizeKb: 450, fileName: 'evaluacion-desempeno-2026-cruiz.pdf',
    tags: ['desempeño', 'evaluación', 'personal'],
    summary: 'Evaluación anual de desempeño con objetivos cumplidos y plan de desarrollo para 2027.',
    content: 'Evaluación de desempeño 2026. Colaboradora: Carolina Ruiz, legajo 2045. Calificación global: supera expectativas. Plan de desarrollo 2027 orientado a liderazgo de equipos.',
    confidence: 0.92,
    fields: [['Colaborador', 'Carolina Ruiz', 0.97], ['Legajo N°', '2045', 0.95], ['Calificación', 'Supera expectativas', 0.9]],
  },
];

function buildDocuments(): DocumentItem[] {
  const docs: DocumentItem[] = SEED_DOCS.map((s, i) => {
    const createdAt = daysAgoIso(s.created, 9 + (i % 7), (i * 7) % 60);
    const updatedAt = s.updated === s.created ? createdAt : daysAgoIso(s.updated, 11 + (i % 6), (i * 13) % 60);
    return {
      id: `doc-${String(i + 1).padStart(3, '0')}`,
      code: `GD-2026-${String(101 + i).padStart(4, '0')}`,
      title: s.title,
      type: s.type,
      area: s.area,
      status: s.status,
      confidentiality: s.confidentiality,
      owner: s.owner,
      createdAt,
      updatedAt,
      sizeKb: s.sizeKb,
      extension: getExtension(s.fileName),
      fileName: s.fileName,
      tags: s.tags,
      summary: s.summary,
      content: s.content,
      classificationConfidence: s.confidence,
      fields: s.fields.map(([label, value, confidence]) => ({ label, value, confidence })),
      version: s.version ?? 1,
      validation: null,
      comments: s.comment ? [{ id: `c-seed-${i}`, author: REVIEWER, date: updatedAt, text: s.comment }] : [],
    };
  });
  return docs.map((doc) => {
    if (doc.status === 'Borrador') return doc;
    const others = docs.filter((d) => d.id !== doc.id).map((d) => d.title);
    const executedAt = new Date(new Date(doc.createdAt).getTime() + 4 * 60000).toISOString();
    return { ...doc, validation: simulateValidation(toValidationInput(doc), others, executedAt) };
  });
}

function buildActivity(docs: DocumentItem[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  let n = 0;
  const push = (e: Omit<ActivityEntry, 'id'>) => entries.push({ ...e, id: `act-seed-${++n}` });
  const shift = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

  docs.forEach((doc) => {
    push({ timestamp: doc.createdAt, user: doc.owner, action: 'Carga', documentId: doc.id, documentCode: doc.code, detail: `Carga del archivo "${doc.fileName}"`, result: 'Éxito' });
    if (doc.validation) {
      const warn = doc.validation.checks.some((c) => c.status !== 'ok');
      push({
        timestamp: doc.validation.executedAt, user: SYSTEM_USER, action: 'Validación', documentId: doc.id, documentCode: doc.code,
        detail: `Validación automática · puntaje ${doc.validation.score}/100`, result: warn ? 'Advertencia' : 'Éxito',
      });
    }
    if (doc.status === 'Aprobado') {
      push({ timestamp: doc.updatedAt, user: REVIEWER, action: 'Cambio de estado', documentId: doc.id, documentCode: doc.code, detail: 'En revisión → Aprobado', result: 'Éxito' });
    } else if (doc.status === 'Rechazado') {
      push({ timestamp: doc.updatedAt, user: REVIEWER, action: 'Cambio de estado', documentId: doc.id, documentCode: doc.code, detail: `En revisión → Rechazado. Motivo: ${doc.comments[0]?.text ?? 'sin detalle'}`, result: 'Advertencia' });
    } else if (doc.status === 'Archivado') {
      push({ timestamp: shift(doc.updatedAt, -120), user: REVIEWER, action: 'Cambio de estado', documentId: doc.id, documentCode: doc.code, detail: 'En revisión → Aprobado', result: 'Éxito' });
      push({ timestamp: doc.updatedAt, user: 'Lucía Fernández', action: 'Cambio de estado', documentId: doc.id, documentCode: doc.code, detail: 'Aprobado → Archivado', result: 'Éxito' });
    } else if (doc.status === 'En revisión') {
      push({ timestamp: shift(doc.createdAt, 10), user: doc.owner, action: 'Cambio de estado', documentId: doc.id, documentCode: doc.code, detail: 'Borrador → En revisión', result: 'Éxito' });
    }
  });

  const byCode = (code: string) => docs.find((d) => d.code === code);
  const extra: [number, number, number, string, ActivityEntry['action'], string | null, string, ActivityEntry['result']][] = [
    [0, 8, 52, 'María González', 'Inicio de sesión', null, 'Inicio de sesión con Microsoft Entra ID (MFA)', 'Éxito'],
    [0, 9, 14, 'Javier Méndez', 'Consulta', 'GD-2026-0102', 'Consulta del documento', 'Éxito'],
    [0, 9, 31, 'Sofía Herrera', 'Búsqueda', null, '"facturas pendientes" · 3 resultados', 'Éxito'],
    [1, 10, 5, 'Lucía Fernández', 'Descarga', 'GD-2026-0101', 'Descarga de la ficha del documento', 'Éxito'],
    [1, 11, 42, 'Diego Romero', 'Inicio de sesión', null, 'Intento de acceso fallido: MFA no completado', 'Error'],
    [1, 11, 45, 'Diego Romero', 'Inicio de sesión', null, 'Inicio de sesión con Microsoft Entra ID (MFA)', 'Éxito'],
    [2, 15, 20, 'Carolina Ruiz', 'Comentario', 'GD-2026-0108', 'Comentario: falta adjuntar apto médico firmado', 'Éxito'],
    [3, 16, 8, 'Javier Méndez', 'Búsqueda', null, '"contratos que vencen en 2026" · 2 resultados', 'Éxito'],
    [4, 12, 33, 'Lucía Fernández', 'Consulta', 'GD-2026-0106', 'Consulta del documento', 'Éxito'],
    [6, 14, 50, 'Sofía Herrera', 'Descarga', 'GD-2026-0112', 'Descarga de la ficha del documento', 'Éxito'],
    [8, 9, 12, 'Javier Méndez', 'Consulta', 'GD-2026-0104', 'Consulta del documento', 'Éxito'],
    [10, 17, 25, 'Diego Romero', 'Búsqueda', null, '"políticas de seguridad" · 1 resultado', 'Éxito'],
  ];
  extra.forEach(([days, h, m, user, action, code, detail, result]) => {
    const doc = code ? byCode(code) : undefined;
    push({ timestamp: daysAgoIso(days, h, m), user, action, documentId: doc?.id ?? null, documentCode: doc?.code ?? null, detail, result });
  });

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function createSeedState(): DemoState {
  const documents = buildDocuments();
  return {
    version: STATE_VERSION,
    documents,
    activity: buildActivity(documents),
    recentSearches: ['proveedor Contoso', 'facturas pendientes'],
  };
}
