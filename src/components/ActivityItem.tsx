import type { ActivityAction, ActivityEntry } from '../types';
import { formatRelative, formatDateTime } from '../lib/utils';
import { Icon, type IconName } from './Icon';

export const ACTION_ICON: Record<ActivityAction, IconName> = {
  Carga: 'upload',
  Validación: 'shield',
  'Cambio de estado': 'refresh',
  Consulta: 'eye',
  Búsqueda: 'search',
  Descarga: 'download',
  Comentario: 'message',
  'Inicio de sesión': 'login',
};

interface ActivityItemProps {
  entry: ActivityEntry;
  onOpenDocument?: (documentId: string) => void;
}

export function ActivityItem({ entry, onOpenDocument }: ActivityItemProps) {
  const tone = entry.result === 'Error' ? 'red' : entry.result === 'Advertencia' ? 'amber' : 'blue';
  return (
    <li className="activity-item">
      <span className={`activity-icon tone-${tone}`}>
        <Icon name={ACTION_ICON[entry.action]} size={15} />
      </span>
      <div className="activity-body">
        <div className="activity-line">
          <strong>{entry.user}</strong> <span className="muted">· {entry.action}</span>
          {entry.documentCode && entry.documentId && (
            onOpenDocument ? (
              <button className="link-btn mono" onClick={() => onOpenDocument(entry.documentId as string)}>
                {entry.documentCode}
              </button>
            ) : (
              <span className="mono muted"> {entry.documentCode}</span>
            )
          )}
        </div>
        <div className="activity-detail">{entry.detail}</div>
      </div>
      <time className="activity-time" title={formatDateTime(entry.timestamp)}>
        {formatRelative(entry.timestamp)}
      </time>
    </li>
  );
}
