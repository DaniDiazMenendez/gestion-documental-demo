import type { ActivityResult, Confidentiality, DocStatus, ValidationResult } from '../types';
import { Icon } from './Icon';

const STATUS_CLASS: Record<DocStatus, string> = {
  Borrador: 'gray',
  'En revisión': 'amber',
  Aprobado: 'green',
  Rechazado: 'red',
  Archivado: 'purple',
};

export function statusColor(status: DocStatus): string {
  return STATUS_CLASS[status];
}

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span className={`badge badge-${STATUS_CLASS[status]}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

export function ConfidentialityBadge({ level }: { level: Confidentiality }) {
  const cls = level === 'Confidencial' ? 'conf-high' : level === 'Interna' ? 'conf-mid' : 'conf-low';
  return (
    <span className={`conf-badge ${cls}`}>
      {level === 'Confidencial' && <Icon name="lock" size={12} />}
      {level}
    </span>
  );
}

export function ScoreBadge({ validation }: { validation: ValidationResult | null }) {
  if (!validation) return <span className="score score-none">Sin validar</span>;
  const hasError = validation.checks.some((c) => c.status === 'error');
  const cls = hasError || validation.score < 70 ? 'score-low' : validation.score < 88 ? 'score-mid' : 'score-high';
  return <span className={`score ${cls}`}>{validation.score}/100</span>;
}

export function ResultBadge({ result }: { result: ActivityResult }) {
  const cls = result === 'Éxito' ? 'green' : result === 'Advertencia' ? 'amber' : 'red';
  return <span className={`badge badge-${cls}`}>{result}</span>;
}

export function FileTypeIcon({ extension, size = 'md' }: { extension: string; size?: 'sm' | 'md' | 'lg' }) {
  const ext = extension.toLowerCase();
  const family = ext === 'pdf'
    ? 'pdf'
    : ['doc', 'docx', 'txt', 'md'].includes(ext)
      ? 'doc'
      : ['xls', 'xlsx', 'csv'].includes(ext)
        ? 'xls'
        : ['png', 'jpg', 'jpeg', 'tif', 'tiff'].includes(ext)
          ? 'img'
          : 'other';
  return <span className={`file-icon file-${family} file-${size}`}>{(ext || '?').slice(0, 4).toUpperCase()}</span>;
}
