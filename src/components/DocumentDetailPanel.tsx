import { useEffect, useRef, useState } from 'react';
import { useDemoStore } from '../store/DemoStore';
import type { DocStatus, DocumentItem } from '../types';
import { downloadTextFile, formatDate, formatDateTime, formatSize } from '../lib/utils';
import { ActivityItem } from './ActivityItem';
import { ConfidentialityBadge, FileTypeIcon, ScoreBadge, StatusBadge } from './Badges';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { ValidationChecks } from './ValidationChecks';

export const STATUS_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Borrador: ['En revisión'],
  'En revisión': ['Aprobado', 'Rechazado'],
  Rechazado: ['En revisión', 'Borrador'],
  Aprobado: ['Archivado'],
  Archivado: ['Aprobado'],
};

export const TRANSITION_LABEL: Record<DocStatus, string> = {
  Borrador: 'Volver a borrador',
  'En revisión': 'Enviar a revisión',
  Aprobado: 'Aprobar',
  Rechazado: 'Rechazar',
  Archivado: 'Archivar',
};

type Tab = 'resumen' | 'datos' | 'validacion' | 'historial';

interface DocumentDetailPanelProps {
  document: DocumentItem;
  onClose: () => void;
}

export function DocumentDetailPanel({ document: doc, onClose }: DocumentDetailPanelProps) {
  const { activity, changeStatus, runValidation, addComment, logActivity } = useDemoStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('resumen');
  const [validating, setValidating] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setTab('resumen');
    setRejecting(false);
    setReason('');
    setComment('');
  }, [doc.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const history = activity.filter((a) => a.documentId === doc.id).slice(0, 25);

  const onTransition = (status: DocStatus) => {
    if (status === 'Rechazado') {
      setRejecting(true);
      return;
    }
    if (status === 'Aprobado' && doc.validation?.checks.some((c) => c.status === 'error')) {
      toast('No se puede aprobar: la validación tiene errores.', 'error');
      return;
    }
    changeStatus([doc.id], status);
    toast(`${doc.code} pasó a "${status}".`);
  };

  const confirmReject = () => {
    if (reason.trim().length < 5) return;
    changeStatus([doc.id], 'Rechazado', reason);
    toast(`${doc.code} fue rechazado.`, 'warning');
    setRejecting(false);
    setReason('');
  };

  const onValidate = () => {
    setValidating(true);
    setTab('validacion');
    timer.current = window.setTimeout(() => {
      const result = runValidation(doc.id);
      setValidating(false);
      if (result) toast(`Validación completada · puntaje ${result.score}/100`, result.checks.some((c) => c.status === 'error') ? 'error' : 'success');
    }, 1100);
  };

  const onDownload = () => {
    const lines = [
      `Ficha del documento ${doc.code}`,
      '='.repeat(40),
      `Título: ${doc.title}`,
      `Archivo: ${doc.fileName} (${formatSize(doc.sizeKb)})`,
      `Tipo: ${doc.type}`,
      `Área: ${doc.area}`,
      `Estado: ${doc.status}`,
      `Confidencialidad: ${doc.confidentiality}`,
      `Responsable: ${doc.owner}`,
      `Versión: ${doc.version}`,
      `Creado: ${formatDateTime(doc.createdAt)}`,
      `Actualizado: ${formatDateTime(doc.updatedAt)}`,
      `Etiquetas: ${doc.tags.join(', ')}`,
      '',
      'Resumen',
      doc.summary,
      '',
      'Datos extraídos',
      ...doc.fields.map((f) => `- ${f.label}: ${f.value} (${Math.round(f.confidence * 100)} %)`),
      '',
      'Contenido',
      doc.content,
    ];
    downloadTextFile(`${doc.code}-ficha.txt`, lines.join('\n'));
    logActivity({ action: 'Descarga', documentId: doc.id, documentCode: doc.code, detail: 'Descarga de la ficha del documento' });
    toast('Ficha descargada.');
  };

  const onAddComment = () => {
    if (!comment.trim()) return;
    addComment(doc.id, comment);
    setComment('');
    toast('Comentario agregado.');
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Detalle de ${doc.title}`}>
        <div className="drawer-header">
          <FileTypeIcon extension={doc.extension} size="lg" />
          <div className="drawer-title">
            <div className="mono muted small">{doc.code}</div>
            <h2>{doc.title}</h2>
            <div className="drawer-badges">
              <StatusBadge status={doc.status} />
              <ConfidentialityBadge level={doc.confidentiality} />
              <ScoreBadge validation={doc.validation} />
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar panel">
            <Icon name="x" />
          </button>
        </div>

        <div className="tabs drawer-tabs">
          {(
            [
              ['resumen', 'Resumen'],
              ['datos', 'Datos extraídos'],
              ['validacion', 'Validación'],
              ['historial', 'Historial'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {tab === 'resumen' && (
            <>
              <section className="drawer-section">
                <h4>
                  <Icon name="sparkles" size={14} /> Resumen generado por IA
                </h4>
                <p className="summary-text">{doc.summary}</p>
              </section>
              <section className="drawer-section">
                <h4>Metadatos</h4>
                <dl className="meta-grid">
                  <dt>Tipo</dt>
                  <dd>
                    {doc.type} <span className="muted small">({Math.round(doc.classificationConfidence * 100)} % confianza)</span>
                  </dd>
                  <dt>Área</dt>
                  <dd>{doc.area}</dd>
                  <dt>Responsable</dt>
                  <dd>{doc.owner}</dd>
                  <dt>Archivo</dt>
                  <dd className="ellipsis" title={doc.fileName}>
                    {doc.fileName}
                  </dd>
                  <dt>Tamaño</dt>
                  <dd>{formatSize(doc.sizeKb)}</dd>
                  <dt>Versión</dt>
                  <dd>v{doc.version}</dd>
                  <dt>Creado</dt>
                  <dd>{formatDate(doc.createdAt)}</dd>
                  <dt>Actualizado</dt>
                  <dd>{formatDateTime(doc.updatedAt)}</dd>
                </dl>
              </section>
              <section className="drawer-section">
                <h4>Etiquetas</h4>
                <div className="tag-list">
                  {doc.tags.length ? doc.tags.map((t) => <span key={t} className="tag">{t}</span>) : <span className="muted">Sin etiquetas</span>}
                </div>
              </section>
              <section className="drawer-section">
                <h4>Vista previa del contenido</h4>
                <pre className="content-preview">{doc.content || 'Sin contenido textual disponible.'}</pre>
              </section>
            </>
          )}

          {tab === 'datos' && (
            <section className="drawer-section">
              <h4>
                <Icon name="sparkles" size={14} /> Campos extraídos automáticamente
              </h4>
              {doc.fields.length ? (
                <ul className="field-list">
                  {doc.fields.map((f) => {
                    const pct = Math.round(f.confidence * 100);
                    return (
                      <li key={f.label}>
                        <div className="field-row">
                          <span className="muted">{f.label}</span>
                          <strong>{f.value}</strong>
                        </div>
                        <div className="conf-bar">
                          <span className={pct >= 90 ? 'bar-green' : pct >= 80 ? 'bar-amber' : 'bar-red'} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="small muted">Confianza {pct} %</div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted">No se extrajeron campos de este documento.</p>
              )}
            </section>
          )}

          {tab === 'validacion' && (
            <section className="drawer-section">
              <div className="section-head">
                <h4>Resultado de la validación</h4>
                <button className="btn btn-secondary btn-sm" onClick={onValidate} disabled={validating}>
                  <Icon name="shield" size={14} />
                  {validating ? 'Validando…' : doc.validation ? 'Volver a validar' : 'Validar ahora'}
                </button>
              </div>
              {validating ? (
                <div className="loading-box">
                  <span className="spinner" /> Ejecutando controles automáticos…
                </div>
              ) : doc.validation ? (
                <ValidationChecks result={doc.validation} />
              ) : (
                <p className="muted">Este documento todavía no fue validado.</p>
              )}
            </section>
          )}

          {tab === 'historial' && (
            <>
              <section className="drawer-section">
                <h4>Comentarios ({doc.comments.length})</h4>
                {doc.comments.length > 0 && (
                  <ul className="comment-list">
                    {doc.comments.map((c) => (
                      <li key={c.id}>
                        <div className="small">
                          <strong>{c.author}</strong> <span className="muted">· {formatDateTime(c.date)}</span>
                        </div>
                        <p>{c.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="comment-form">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Agregar un comentario para el equipo…"
                    rows={2}
                  />
                  <button className="btn btn-primary btn-sm" onClick={onAddComment} disabled={!comment.trim()}>
                    Comentar
                  </button>
                </div>
              </section>
              <section className="drawer-section">
                <h4>Línea de tiempo</h4>
                {history.length ? (
                  <ul className="activity-list">
                    {history.map((a) => (
                      <ActivityItem key={a.id} entry={a} />
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Sin actividad registrada.</p>
                )}
              </section>
            </>
          )}
        </div>

        <div className="drawer-footer">
          {rejecting ? (
            <div className="reject-box">
              <label htmlFor="reject-reason">Motivo del rechazo (obligatorio)</label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Ej.: falta la firma del apoderado en la página 3"
              />
              <div className="row-end">
                <button className="btn btn-secondary btn-sm" onClick={() => setRejecting(false)}>
                  Cancelar
                </button>
                <button className="btn btn-danger btn-sm" onClick={confirmReject} disabled={reason.trim().length < 5}>
                  Confirmar rechazo
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={onDownload}>
                <Icon name="download" size={14} />
                Descargar ficha
              </button>
              <div className="row-end">
                {STATUS_TRANSITIONS[doc.status].map((s) => (
                  <button
                    key={s}
                    className={`btn btn-sm ${s === 'Rechazado' ? 'btn-danger-outline' : s === 'Aprobado' ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => onTransition(s)}
                  >
                    {TRANSITION_LABEL[s]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
