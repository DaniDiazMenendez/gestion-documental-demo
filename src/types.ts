export type DocStatus = 'Borrador' | 'En revisión' | 'Aprobado' | 'Rechazado' | 'Archivado';
export const DOC_STATUSES: DocStatus[] = ['Borrador', 'En revisión', 'Aprobado', 'Rechazado', 'Archivado'];

export type DocType = 'Contrato' | 'Factura' | 'Informe' | 'Política' | 'Acta' | 'Legajo';
export const DOC_TYPES: DocType[] = ['Contrato', 'Factura', 'Informe', 'Política', 'Acta', 'Legajo'];

export const AREAS = ['Legal', 'Finanzas', 'Recursos Humanos', 'Compras', 'Operaciones', 'Tecnología'] as const;
export type Area = (typeof AREAS)[number];

export type Confidentiality = 'Pública' | 'Interna' | 'Confidencial';
export const CONFIDENTIALITY_LEVELS: Confidentiality[] = ['Pública', 'Interna', 'Confidencial'];

export interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
}

export type CheckStatus = 'ok' | 'warning' | 'error';

export interface ValidationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ValidationResult {
  executedAt: string;
  score: number;
  checks: ValidationCheck[];
}

export interface DocComment {
  id: string;
  author: string;
  date: string;
  text: string;
}

export interface DocumentItem {
  id: string;
  code: string;
  title: string;
  type: DocType;
  area: Area;
  status: DocStatus;
  confidentiality: Confidentiality;
  owner: string;
  createdAt: string;
  updatedAt: string;
  sizeKb: number;
  extension: string;
  fileName: string;
  tags: string[];
  summary: string;
  content: string;
  classificationConfidence: number;
  fields: ExtractedField[];
  version: number;
  validation: ValidationResult | null;
  comments: DocComment[];
}

export type ActivityAction =
  | 'Carga'
  | 'Validación'
  | 'Cambio de estado'
  | 'Consulta'
  | 'Búsqueda'
  | 'Descarga'
  | 'Comentario'
  | 'Inicio de sesión';

export const ACTIVITY_ACTIONS: ActivityAction[] = [
  'Carga',
  'Validación',
  'Cambio de estado',
  'Consulta',
  'Búsqueda',
  'Descarga',
  'Comentario',
  'Inicio de sesión',
];

export type ActivityResult = 'Éxito' | 'Advertencia' | 'Error';
export const ACTIVITY_RESULTS: ActivityResult[] = ['Éxito', 'Advertencia', 'Error'];

export interface ActivityEntry {
  id: string;
  timestamp: string;
  user: string;
  action: ActivityAction;
  documentId: string | null;
  documentCode: string | null;
  detail: string;
  result: ActivityResult;
}

export interface DemoState {
  version: number;
  documents: DocumentItem[];
  activity: ActivityEntry[];
  recentSearches: string[];
}
