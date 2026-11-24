import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoStore } from '../store/DemoStore';
import type { DocumentItem } from '../types';
import { formatRelative } from '../lib/utils';
import { validationSummary } from '../lib/validation';
import { ConfidentialityBadge, FileTypeIcon, ScoreBadge, StatusBadge } from '../components/Badges';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ValidationChecks } from '../components/ValidationChecks';

type QueueFilter = 'todos' | 'sin-validar' | 'con-observaciones' | 'listos';

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'sin-validar', label: 'Sin validar' },
  { id: 'con-observaciones', label: 'Con observaciones' },
  { id: 'listos', label: 'Listos para aprobar' },
];

function matchesFilter(d: DocumentItem, f: QueueFilter): boolean {
  const s = validationSummary(d.validation);
  if (f === 'sin-validar') return !d.validation;
  if (f === 'con-observaciones') return Boolean(d.validation) && s.warnings + s.errors > 0;
  if (f === 'listos') return Boolean(d.validation) && s.errors === 0;
  return true;
}

export function ValidationPage() {
  const { documents, activity, runValidation, changeStatus } = useDemoStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<QueueFilter>('todos');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [rejectDoc, setRejectDoc] = useState<DocumentItem | null>(null);
  const [reason, setReason] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const queue = useMemo(
    () => documents.filter((d) => d.status === 'En revisión' || d.status === 'Borrador').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [documents],
  );
  const visible = queue.filter((d) => matchesFilter(d, filter));

  const resolved = useMemo(
    () =>
      activity
        .filter((a) => a.action === 'Cambio de estado' && (a.detail.includes('→ Aprobado') || a.detail.includes('→ Rechazado')))
        .slice(0, 6),
    [activity],
  );

  const kpis = {
    total: queue.length,
    unvalidated: queue.filter((d) => !d.validation).length,
    observed: queue.filter((d) => matchesFilter(d, 'con-observaciones')).length,
    ready: queue.filter((d) => matchesFilter(d, 'listos')).length,
  };

  const setRunningFor = (id: string, on: boolean) =>
    setRunning((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const validateOne = (doc: DocumentItem) => {
    setRunningFor(doc.id, true);
    timers.current.push(
      window.setTimeout(() => {
        const r = runValidation(doc.id);
        setRunningFor(doc.id, false);
        setExpanded(doc.id);
        if (r) toast(`${doc.code}: puntaje ${r.score}/100`, r.checks.some((c) => c.status === 'error') ? 'error' : 'success');
      }, 1200),
    );
  };

  const validateAll = () => {
    const targets = visible.map((d) => d.id);
    if (!targets.length) return;
    setBatch({ done: 0, total: targets.length });
    targets.forEach((id, i) => {
      timers.current.push(
        window.setTimeout(() => setRunningFor(id, true), 700 * i),
        window.setTimeout(() => {
          runValidation(id);
          setRunningFor(id, false);
          setBatch({ done: i + 1, total: targets.length });
          if (i === targets.length - 1) {
            toast(`Se validaron ${targets.length} documentos.`);
            timers.current.push(window.setTimeout(() => setBatch(null), 1200));
          }
        }, 700 * (i + 1)),
      );
    });
  };

  const approve = (doc: DocumentItem) => {
    changeStatus([doc.id], 'Aprobado');
    toast(`${doc.code} aprobado.`);
  };

  const sendToReview = (doc: DocumentItem) => {
    changeStatus([doc.id], 'En revisión');
    toast(`${doc.code} enviado a revisión.`, 'info');
  };

  const confirmReject = () => {
    if (!rejectDoc || reason.trim().length < 5) return;
    changeStatus([rejectDoc.id], 'Rechazado', reason);
    toast(`${rejectDoc.code} rechazado.`, 'warning');
    setRejectDoc(null);
    setReason('');
  };

  return (
    <div className="page">
      <div className="kpi-grid kpi-4">
        {[
          { label: 'En cola', value: kpis.total, tone: 'blue', icon: 'clock' as const },
          { label: 'Sin validar', value: kpis.unvalidated, tone: 'gray', icon: 'shield' as const },
          { label: 'Con observaciones', value: kpis.observed, tone: 'amber', icon: 'alert' as const },
          { label: 'Listos para aprobar', value: kpis.ready, tone: 'green', icon: 'check-circle' as const },
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

      <div className="grid-2-1">
        <section className="card">
          <div className="card-head">
            <div className="chips">
              {FILTERS.map((f) => (
                <button key={f.id} className={`chip${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.label}
                  <span className="chip-count">{queue.filter((d) => matchesFilter(d, f.id)).length}</span>
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={validateAll} disabled={Boolean(batch) || visible.length === 0}>
              <Icon name="play" size={13} />
              Validar todos ({visible.length})
            </button>
          </div>

          {batch && (
            <div className="progress-box">
              <div className="small">
                Validando {batch.done} de {batch.total} documentos…
              </div>
              <div className="progress">
                <span style={{ width: `${(batch.done / batch.total) * 100}%` }} />
              </div>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="empty">
              <Icon name="check-circle" size={28} />
              <p>No hay documentos en esta vista de la cola.</p>
            </div>
          ) : (
            <ul className="queue">
              {visible.map((d) => {
                const s = validationSummary(d.validation);
                const isRunning = running.has(d.id);
                const isOpen = expanded === d.id;
                return (
                  <li key={d.id} className={`queue-item${isOpen ? ' open' : ''}`}>
                    <div className="queue-row">
                      <button className="icon-btn" onClick={() => setExpanded(isOpen ? null : d.id)} aria-label={isOpen ? 'Contraer' : 'Expandir'} disabled={!d.validation}>
                        <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={16} />
                      </button>
                      <FileTypeIcon extension={d.extension} size="sm" />
                      <div className="queue-main">
                        <button className="link-btn doc-title" onClick={() => navigate(`/documentos?id=${d.id}`)}>
                          {d.title}
                        </button>
                        <div className="muted small">
                          <span className="mono">{d.code}</span> · {d.type} · {d.area} · cargado {formatRelative(d.createdAt)} por {d.owner}
                        </div>
                      </div>
                      <div className="queue-meta">
                        <StatusBadge status={d.status} />
                        <ConfidentialityBadge level={d.confidentiality} />
                        {isRunning ? (
                          <span className="score score-none">
                            <span className="spinner sm" /> Validando
                          </span>
                        ) : (
                          <ScoreBadge validation={d.validation} />
                        )}
                        {d.validation && !isRunning && (
                          <span className="small muted">
                            {s.warnings > 0 && <span className="txt-amber">{s.warnings} adv. </span>}
                            {s.errors > 0 && <span className="txt-red">{s.errors} err.</span>}
                          </span>
                        )}
                      </div>
                      <div className="queue-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => validateOne(d)} disabled={isRunning || Boolean(batch)}>
                          <Icon name="shield" size={13} />
                          {d.validation ? 'Revalidar' : 'Validar'}
                        </button>
                        {d.status === 'Borrador' ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => sendToReview(d)} disabled={isRunning}>
                            A revisión
                          </button>
                        ) : (
                          <button className="btn btn-danger-outline btn-sm" onClick={() => setRejectDoc(d)} disabled={isRunning}>
                            Rechazar
                          </button>
                        )}
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => approve(d)}
                          disabled={isRunning || !d.validation || s.errors > 0}
                          title={!d.validation ? 'Primero ejecutá la validación' : s.errors > 0 ? 'La validación tiene errores' : 'Aprobar documento'}
                        >
                          <Icon name="check" size={13} />
                          Aprobar
                        </button>
                      </div>
                    </div>
                    {isOpen && d.validation && (
                      <div className="queue-detail">
                        <ValidationChecks result={d.validation} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="stack">
          <section className="card">
            <div className="card-head">
              <h3>Resueltos recientemente</h3>
            </div>
            {resolved.length ? (
              <ul className="mini-list">
                {resolved.map((a) => (
                  <li key={a.id} onClick={() => a.documentId && navigate(`/documentos?id=${a.documentId}`)}>
                    <div className="mini-main">
                      <strong className="mono">{a.documentCode}</strong>
                      <span className="muted small ellipsis">{a.detail}</span>
                    </div>
                    <span className="muted small">{formatRelative(a.timestamp)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Todavía no hay resoluciones.</p>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Criterios de aprobación</h3>
            </div>
            <ul className="req-list">
              <li>
                <Icon name="check" size={14} /> Validación ejecutada sin errores bloqueantes
              </li>
              <li>
                <Icon name="check" size={14} /> Advertencias revisadas por el analista
              </li>
              <li>
                <Icon name="check" size={14} /> El rechazo exige un motivo, que queda en el historial
              </li>
              <li>
                <Icon name="check" size={14} /> Cada decisión se registra en la auditoría
              </li>
            </ul>
          </section>
        </aside>
      </div>

      {rejectDoc && (
        <Modal
          title={`Rechazar ${rejectDoc.code}`}
          onClose={() => setRejectDoc(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setRejectDoc(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmReject} disabled={reason.trim().length < 5}>
                Confirmar rechazo
              </button>
            </>
          }
        >
          <p className="muted small">{rejectDoc.title}</p>
          <label className="field-label" htmlFor="reject-reason-q">
            Motivo del rechazo (mínimo 5 caracteres)
          </label>
          <textarea id="reject-reason-q" rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </Modal>
      )}
    </div>
  );
}
