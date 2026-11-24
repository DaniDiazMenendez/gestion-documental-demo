import type {
  Area,
  CheckStatus,
  Confidentiality,
  DocType,
  DocumentItem,
  ExtractedField,
  ValidationCheck,
  ValidationResult,
} from '../types';
import { daysAgoIso, formatCurrency, formatDate, formatSize, hashString, normalizeText } from './utils';

export const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'txt', 'csv', 'md', 'json'];
export const TEXT_EXTENSIONS = ['txt', 'csv', 'md', 'json'];
export const MAX_FILE_MB = 20;

export const VALIDATION_STEPS = [
  { id: 'formato', label: 'Verificación de formato' },
  { id: 'tamano', label: 'Control de tamaño e integridad' },
  { id: 'ocr', label: 'Extracción de texto (OCR)' },
  { id: 'clasificacion', label: 'Clasificación automática' },
  { id: 'metadatos', label: 'Metadatos obligatorios' },
  { id: 'duplicados', label: 'Detección de duplicados' },
  { id: 'sensibles', label: 'Detección de datos sensibles' },
];

export interface ValidationInput {
  fileName: string;
  extension: string;
  sizeKb: number;
  title: string;
  type: DocType;
  area: string;
  tags: string[];
  content: string;
  confidentiality: Confidentiality;
  classificationConfidence: number;
}

export function toValidationInput(doc: DocumentItem): ValidationInput {
  return {
    fileName: doc.fileName,
    extension: doc.extension,
    sizeKb: doc.sizeKb,
    title: doc.title,
    type: doc.type,
    area: doc.area,
    tags: doc.tags,
    content: doc.content,
    confidentiality: doc.confidentiality,
    classificationConfidence: doc.classificationConfidence,
  };
}

function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeText(title)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / (ta.size + tb.size - inter);
}

export function detectSensitiveData(content: string): string[] {
  const found: string[] = [];
  if (/\b\d{2}-\d{8}-\d\b/.test(content)) found.push('CUIT');
  if (/\bDNI\b\D{0,5}\d{1,2}\.?\d{3}\.?\d{3}/i.test(content)) found.push('DNI');
  if (/\b\d{22}\b/.test(content)) found.push('CBU');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(content)) found.push('correo electrónico');
  return found;
}

export function simulateValidation(
  input: ValidationInput,
  otherTitles: string[],
  executedAt: string = new Date().toISOString(),
): ValidationResult {
  const h = hashString(`${input.fileName}|${input.sizeKb}`);
  const ext = input.extension.toLowerCase();
  const isText = TEXT_EXTENSIONS.includes(ext);
  const checks: ValidationCheck[] = [];
  const add = (id: string, status: CheckStatus, detail: string) => {
    const step = VALIDATION_STEPS.find((s) => s.id === id);
    checks.push({ id, label: step ? step.label : id, status, detail });
  };

  if (ALLOWED_EXTENSIONS.includes(ext)) add('formato', 'ok', `Formato .${ext} admitido por el repositorio.`);
  else add('formato', 'error', `La extensión ${ext ? `.${ext}` : 'desconocida'} no está admitida.`);

  if (input.sizeKb <= 0) add('tamano', 'error', 'El archivo está vacío o no pudo leerse.');
  else if (input.sizeKb > MAX_FILE_MB * 1024) add('tamano', 'error', `Supera el máximo permitido de ${MAX_FILE_MB} MB.`);
  else add('tamano', 'ok', `${formatSize(input.sizeKb)} · huella SHA-256 generada correctamente.`);

  const legibility = 76 + (h % 24);
  if (isText) add('ocr', 'ok', 'Texto nativo: no requiere OCR.');
  else if (legibility < 84) add('ocr', 'warning', `Legibilidad estimada del ${legibility} %. Revisar los datos extraídos.`);
  else add('ocr', 'ok', `Texto extraído con una legibilidad del ${legibility} %.`);

  const pct = Math.round(input.classificationConfidence * 100);
  if (input.classificationConfidence >= 0.85) add('clasificacion', 'ok', `Clasificado como ${input.type} con ${pct} % de confianza.`);
  else add('clasificacion', 'warning', `Clasificado como ${input.type} con baja confianza (${pct} %). Confirmar manualmente.`);

  const missing: string[] = [];
  if (input.title.trim().length < 5) missing.push('título');
  if (!input.area) missing.push('área');
  if (input.tags.length === 0) missing.push('etiquetas');
  if (missing.includes('título') || missing.includes('área')) add('metadatos', 'error', `Faltan metadatos obligatorios: ${missing.join(', ')}.`);
  else if (missing.length) add('metadatos', 'warning', `Se recomienda completar: ${missing.join(', ')}.`);
  else add('metadatos', 'ok', 'Título, tipo, área, confidencialidad y etiquetas completos.');

  const duplicate = otherTitles.find((t) => titleSimilarity(t, input.title) >= 0.8);
  if (duplicate) add('duplicados', 'warning', `Posible duplicado de "${duplicate}".`);
  else add('duplicados', 'ok', 'No se encontraron documentos similares en el repositorio.');

  const pii = detectSensitiveData(input.content);
  if (pii.length && input.confidentiality !== 'Confidencial') {
    add('sensibles', 'warning', `Se detectaron datos personales (${pii.join(', ')}). Se sugiere nivel Confidencial.`);
  } else if (pii.length) {
    add('sensibles', 'ok', `Datos personales detectados (${pii.join(', ')}) y protegidos con nivel Confidencial.`);
  } else {
    add('sensibles', 'ok', 'No se detectaron datos personales ni financieros sensibles.');
  }

  const warnings = checks.filter((c) => c.status === 'warning').length;
  const errors = checks.filter((c) => c.status === 'error').length;
  const ocrPenalty = isText ? 0 : (100 - legibility) * 0.25;
  const score = Math.max(0, Math.min(100, Math.round(100 - warnings * 7 - errors * 30 - ocrPenalty)));
  return { executedAt, score, checks };
}

export function validationSummary(result: ValidationResult | null) {
  if (!result) return { ok: 0, warnings: 0, errors: 0 };
  return {
    ok: result.checks.filter((c) => c.status === 'ok').length,
    warnings: result.checks.filter((c) => c.status === 'warning').length,
    errors: result.checks.filter((c) => c.status === 'error').length,
  };
}

const CLASSIFICATION_RULES: { type: DocType; keywords: string[] }[] = [
  { type: 'Factura', keywords: ['factura', 'invoice', 'comprobante', 'cuit', 'importe'] },
  { type: 'Contrato', keywords: ['contrato', 'acuerdo', 'convenio', 'nda', 'clausula', 'locacion'] },
  { type: 'Acta', keywords: ['acta', 'minuta', 'asamblea', 'directorio', 'comite'] },
  { type: 'Política', keywords: ['politica', 'procedimiento', 'norma', 'lineamiento', 'manual'] },
  { type: 'Legajo', keywords: ['legajo', 'curriculum', 'empleado', 'alta de personal', 'desempeno'] },
  { type: 'Informe', keywords: ['informe', 'reporte', 'report', 'analisis', 'auditoria', 'resultado'] },
];

export function classifyDocument(fileName: string, content: string): { type: DocType; confidence: number } {
  const h = hashString(fileName);
  const name = normalizeText(fileName);
  const text = normalizeText(content.slice(0, 4000));
  let best: { type: DocType; score: number } = { type: 'Informe', score: 0 };
  for (const rule of CLASSIFICATION_RULES) {
    const score = rule.keywords.reduce((acc, k) => acc + (name.includes(k) ? 3 : 0) + (text.includes(k) ? 1 : 0), 0);
    if (score > best.score) best = { type: rule.type, score };
  }
  if (best.score === 0) return { type: 'Informe', confidence: 0.55 + (h % 12) / 100 };
  return { type: best.type, confidence: Math.min(0.99, 0.8 + best.score * 0.04 + (h % 5) / 100) };
}

export const AREA_BY_TYPE: Record<DocType, Area> = {
  Contrato: 'Legal',
  Factura: 'Finanzas',
  Informe: 'Operaciones',
  Política: 'Tecnología',
  Acta: 'Legal',
  Legajo: 'Recursos Humanos',
};

const TAGS_BY_TYPE: Record<DocType, string[]> = {
  Contrato: ['contrato', 'obligaciones', 'vigencia'],
  Factura: ['factura', 'pago', 'proveedor'],
  Informe: ['informe', 'gestión'],
  Política: ['política', 'cumplimiento'],
  Acta: ['acta', 'gobierno corporativo'],
  Legajo: ['legajo', 'personal'],
};

export function suggestTags(type: DocType): string[] {
  return [...TAGS_BY_TYPE[type]];
}

const SUMMARY_BY_TYPE: Record<DocType, string> = {
  Contrato: 'Contrato que establece obligaciones, vigencia y condiciones comerciales entre las partes.',
  Factura: 'Comprobante fiscal emitido por un proveedor, pendiente de conciliación con la orden de compra.',
  Informe: 'Informe con resultados, indicadores y conclusiones para la toma de decisiones.',
  Política: 'Documento normativo interno que define lineamientos y responsabilidades.',
  Acta: 'Acta que registra los temas tratados, decisiones y participantes de una reunión formal.',
  Legajo: 'Documentación de personal con datos laborales y antecedentes del colaborador.',
};

export function generateSummary(type: DocType, area: string): string {
  return `${SUMMARY_BY_TYPE[type]} Pertenece al área de ${area} y fue indexado automáticamente para su búsqueda.`;
}

const COMPANIES = ['Contoso S.A.', 'Fabrikam Logística S.R.L.', 'Northwind Traders S.A.', 'Adventure Works S.A.', 'Tailspin Consultores', 'Woodgrove Servicios Financieros'];
const PEOPLE = ['Ana Pereyra', 'Tomás Ibarra', 'Valeria Quiroga', 'Nicolás Paz', 'Paula Benítez', 'Gonzalo Ríos'];

export function extractFields(type: DocType, content: string, fileName: string): ExtractedField[] {
  const h = hashString(fileName + content.length);
  const conf = (i: number) => Math.round((0.8 + ((h >> (i * 3)) % 19) / 100) * 100) / 100;

  const parsed: ExtractedField[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-zÁÉÍÓÚáéíóúÑñ°º .]{3,40}):\s*(.{1,120})$/);
    if (m && parsed.length < 8) parsed.push({ label: m[1].trim(), value: m[2].trim(), confidence: conf(parsed.length) });
  }
  if (parsed.length >= 2) return parsed;

  const pick = <T,>(arr: T[], salt: number): T => arr[(h + salt) % arr.length];
  const date = (offset: number) => formatDate(daysAgoIso(offset, 10, 0));
  const values: [string, string][] = (() => {
    switch (type) {
      case 'Contrato':
        return [
          ['Contraparte', pick(COMPANIES, 1)],
          ['Fecha de firma', date((h % 40) + 5)],
          ['Vigencia', `${12 + (h % 3) * 12} meses`],
          ['Monto total', formatCurrency((h % 900) * 10000 + 250000)],
        ];
      case 'Factura':
        return [
          ['Proveedor', pick(COMPANIES, 2)],
          ['N° de comprobante', `000${(h % 8) + 1}-${String(h % 100000).padStart(8, '0')}`],
          ['Fecha de emisión', date(h % 15)],
          ['Importe total', formatCurrency((h % 5000) * 100 + 15000)],
        ];
      case 'Informe':
        return [
          ['Autor', pick(PEOPLE, 3)],
          ['Período', `Q${(h % 4) + 1} 2026`],
          ['Páginas', String((h % 40) + 4)],
        ];
      case 'Política':
        return [
          ['Versión', `${(h % 3) + 1}.${h % 10}`],
          ['Responsable', pick(PEOPLE, 4)],
          ['Próxima revisión', date(-((h % 300) + 30))],
        ];
      case 'Acta':
        return [
          ['Órgano', pick(['Directorio', 'Comité de Riesgos', 'Comité de Auditoría', 'Asamblea de Accionistas'], 5)],
          ['Fecha de reunión', date(h % 20)],
          ['Participantes', String((h % 8) + 3)],
        ];
      case 'Legajo':
        return [
          ['Colaborador', pick(PEOPLE, 6)],
          ['Legajo N°', String(1000 + (h % 9000))],
          ['Puesto', pick(['Analista', 'Coordinador/a', 'Especialista', 'Jefe/a de área'], 7)],
        ];
    }
  })();
  return values.map(([label, value], i) => ({ label, value, confidence: conf(i) }));
}
