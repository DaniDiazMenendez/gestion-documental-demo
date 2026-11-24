import type { CheckStatus, ValidationResult } from '../types';
import { formatDateTime } from '../lib/utils';
import { validationSummary } from '../lib/validation';
import { Icon, type IconName } from './Icon';

const CHECK_ICON: Record<CheckStatus, IconName> = {
  ok: 'check-circle',
  warning: 'alert',
  error: 'x-circle',
};

interface ValidationChecksProps {
  result: ValidationResult;
  compact?: boolean;
}

export function ValidationChecks({ result, compact = false }: ValidationChecksProps) {
  const summary = validationSummary(result);
  return (
    <div className="checks">
      {!compact && (
        <div className="checks-summary">
          <div className={`score-ring ${summary.errors ? 'ring-low' : result.score < 88 ? 'ring-mid' : 'ring-high'}`}>
            <strong>{result.score}</strong>
            <span>/100</span>
          </div>
          <div>
            <div className="checks-counts">
              <span className="txt-green">{summary.ok} correctos</span>
              <span className="txt-amber">{summary.warnings} advertencias</span>
              <span className="txt-red">{summary.errors} errores</span>
            </div>
            <div className="muted small">Ejecutada el {formatDateTime(result.executedAt)}</div>
          </div>
        </div>
      )}
      <ul className="check-list">
        {result.checks.map((c) => (
          <li key={c.id} className={`check check-${c.status}`}>
            <Icon name={CHECK_ICON[c.status]} size={16} />
            <div>
              <div className="check-label">{c.label}</div>
              <div className="check-detail">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
