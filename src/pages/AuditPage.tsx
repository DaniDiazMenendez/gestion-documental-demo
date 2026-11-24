import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoStore } from '../store/DemoStore';
import { ACTIVITY_ACTIONS, ACTIVITY_RESULTS, type ActivityAction, type ActivityResult } from '../types';
import { downloadTextFile, formatDateTime, initials, normalizeText, toCsv, toDateKey } from '../lib/utils';
import { ACTION_ICON } from '../components/ActivityItem';
import { ResultBadge } from '../components/Badges';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';

const PAGE_SIZE = 15;
type Range = 'hoy' | '7' | '30' | 'todo' | 'custom';

function rangeStart(range: Range): string {
  if (range === 'todo' || range === 'custom') return '';
  const d = new Date();
  if (range === '7') d.setDate(d.getDate() - 6);
  if (range === '30') d.setDate(d.getDate() - 29);
  return toDateKey(d);
}

export function AuditPage() {
  const { activity, generateActivity, logActivity } = useDemoStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [user, setUser] = useState('');
  const [action, setAction] = useState<ActivityAction | ''>('');
  const [result, setResult] = useState<ActivityResult | ''>('');
  const [range, setRange] = useState<Range>('todo');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const users = useMemo(() => [...new Set(activity.map((a) => a.user))].sort((a, b) => a.localeCompare(b, 'es')), [activity]);

  const selectRange = (r: Range) => {
    setRange(r);
    setFrom(rangeStart(r));
    setTo(r === 'todo' ? '' : toDateKey(new Date()));
  };

  const filtered = useMemo(() => {
    const q = normalizeText(text.trim());
    return activity.filter((a) => {
      if (user && a.user !== user) return false;
      if (action && a.action !== action) return false;
      if (result && a.result !== result) return false;
      const key = toDateKey(a.timestamp);
      if (from && key < from) return false;
      if (to && key > to) return false;
      if (q && !normalizeText(`${a.user} ${a.action} ${a.detail} ${a.documentCode ?? ''}`).includes(q)) return false;
      return true;
    });
  }, [activity, text, user, action, result, from, to]);

  useEffect(() => setPage(1), [text, user, action, result, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const hasFilters = Boolean(text || user || action || result || from || to);

  const kpis = {
    total: filtered.length,
    users: new Set(filtered.map((a) => a.user)).size,
    warnings: filtered.filter((a) => a.result === 'Advertencia').length,
    errors: filtered.filter((a) => a.result === 'Error').length,
  };

  const clear = () => {
    setText('');
    setUser('');
    setAction('');
    setResult('');
    setRange('todo');
    setFrom('');
    setTo('');
  };

  const exportCsv = () => {
    const csv = toCsv([
      ['Fecha y hora', 'Usuario', 'Acción', 'Documento', 'Detalle', 'Resultado'],
      ...filtered.map((a) => [formatDateTime(a.timestamp), a.user, a.action, a.documentCode ?? '', a.detail, a.result]),
    ]);
    downloadTextFile(`auditoria-${toDateKey(new Date())}.csv`, csv, 'text/csv;charset=utf-8');
    logActivity({ action: 'Descarga', detail: `Exportación del registro de auditoría (${filtered.length} eventos)` });
    toast(`Se exportaron ${filtered.length} eventos.`);
  };

  const simulate = () => {
    const n = generateActivity(8);
    toast(`Se generaron ${n} eventos simulados de otros usuarios.`, 'info');
  };

  return (
    <div className="page">
      <div className="kpi-grid kpi-4">
        {[
          { label: 'Eventos filtrados', value: kpis.total, tone: 'blue', icon: 'activity' as const },
          { label: 'Usuarios', value: kpis.users, tone: 'purple', icon: 'users' as const },
          { label: 'Advertencias', value: kpis.warnings, tone: 'amber', icon: 'alert' as const },
          { label: 'Errores', value: kpis.errors, tone: 'red', icon: 'x-circle' as const },
        ].map((k) => (
          <div key={k.label} className="kpi card">
            <span className={`kpi-icon tone-${k.tone}`}>
              <Icon name={k.icon} size={18} />
            </span>
            <div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card table-card">
        <div className="toolbar">
          <div className="input-icon">
            <Icon name="search" size={15} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar en detalle, usuario o código" />
          </div>
          <select value={user} onChange={(e) => setUser(e.target.value)} aria-label="Usuario">
            <option value="">Todos los usuarios</option>
            {users.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value as ActivityAction | '')} aria-label="Acción">
            <option value="">Todas las acciones</option>
            {ACTIVITY_ACTIONS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select value={result} onChange={(e) => setResult(e.target.value as ActivityResult | '')} aria-label="Resultado">
            <option value="">Todos los resultados</option>
            {ACTIVITY_RESULTS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <div className="toolbar-spacer" />
          <button className="btn btn-secondary btn-sm" onClick={simulate}>
            <Icon name="sparkles" size={14} />
            Generar actividad simulada
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!filtered.length}>
            <Icon name="download" size={14} />
            Exportar CSV
          </button>
        </div>
        <div className="toolbar toolbar-sub">
          <div className="segmented">
            {(
              [
                ['hoy', 'Hoy'],
                ['7', '7 días'],
                ['30', '30 días'],
                ['todo', 'Todo'],
              ] as [Range, string][]
            ).map(([id, label]) => (
              <button key={id} className={range === id ? 'active' : ''} onClick={() => selectRange(id)}>
                {label}
              </button>
            ))}
          </div>
          <label className="date-field">
            Desde
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setRange('custom');
              }}
            />
          </label>
          <label className="date-field">
            Hasta
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setRange('custom');
              }}
            />
          </label>
          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clear}>
              <Icon name="x" size={14} />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table className="table audit-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Documento</th>
                <th>Detalle</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="no-hover">
                  <td className="nowrap mono small">{formatDateTime(a.timestamp)}</td>
                  <td>
                    <div className="user-cell">
                      <span className="avatar sm">{initials(a.user)}</span>
                      {a.user}
                    </div>
                  </td>
                  <td>
                    <span className="action-cell">
                      <Icon name={ACTION_ICON[a.action]} size={14} />
                      {a.action}
                    </span>
                  </td>
                  <td>
                    {a.documentCode && a.documentId ? (
                      <button className="link-btn mono" onClick={() => navigate(`/documentos?id=${a.documentId}`)}>
                        {a.documentCode}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="detail-cell">{a.detail}</td>
                  <td>
                    <ResultBadge result={a.result} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="empty">
              <Icon name="filter" size={26} />
              <p>No hay eventos que coincidan con los filtros.</p>
            </div>
          )}
        </div>

        <div className="pagination">
          <span className="muted small">
            Mostrando {filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{Math.min(current * PAGE_SIZE, filtered.length)} de {filtered.length} eventos
          </span>
          <div className="pager">
            <button className="icon-btn" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Página anterior">
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="small">
              Página {current} de {totalPages}
            </span>
            <button className="icon-btn" disabled={current === totalPages} onClick={() => setPage(current + 1)} aria-label="Página siguiente">
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
