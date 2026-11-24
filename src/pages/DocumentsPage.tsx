import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDemoStore } from '../store/DemoStore';
import { AREAS, CONFIDENTIALITY_LEVELS, DOC_STATUSES, DOC_TYPES, type DocStatus, type DocumentItem } from '../types';
import { downloadTextFile, formatDate, formatRelative, normalizeText, toCsv } from '../lib/utils';
import { ConfidentialityBadge, FileTypeIcon, ScoreBadge, StatusBadge } from '../components/Badges';
import { DocumentDetailPanel } from '../components/DocumentDetailPanel';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

type SortKey = 'title' | 'type' | 'area' | 'status' | 'updatedAt' | 'score';
const PAGE_SIZE = 10;

function sortValue(d: DocumentItem, key: SortKey): string | number {
  if (key === 'score') return d.validation ? d.validation.score : -1;
  return d[key];
}

export function DocumentsPage() {
  const { documents, changeStatus, logActivity } = useDemoStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const statusParam = params.get('estado');
  const typeParam = params.get('tipo');
  const selectedId = params.get('id');

  const [text, setText] = useState('');
  const [area, setArea] = useState('');
  const [conf, setConf] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'updatedAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<DocStatus | ''>('');
  const [bulkReason, setBulkReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const status = statusParam && (DOC_STATUSES as string[]).includes(statusParam) ? (statusParam as DocStatus) : '';
  const type = typeParam && (DOC_TYPES as string[]).includes(typeParam) ? typeParam : '';

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = normalizeText(text.trim());
    const list = documents.filter((d) => {
      if (status && d.status !== status) return false;
      if (type && d.type !== type) return false;
      if (area && d.area !== area) return false;
      if (conf && d.confidentiality !== conf) return false;
      if (q) {
        const hay = normalizeText(`${d.title} ${d.code} ${d.fileName} ${d.owner} ${d.tags.join(' ')}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return String(va).localeCompare(String(vb), 'es') * factor;
    });
  }, [documents, status, type, area, conf, text, sort]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': documents.length };
    DOC_STATUSES.forEach((s) => (counts[s] = documents.filter((d) => d.status === s).length));
    return counts;
  }, [documents]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [status, type, area, conf, text]);

  useEffect(() => {
    const ids = new Set(documents.map((d) => d.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [documents]);

  const selectedDoc = selectedId ? documents.find((d) => d.id === selectedId) : undefined;
  const hasFilters = Boolean(status || type || area || conf || text);
  const allPageSelected = pageItems.length > 0 && pageItems.every((d) => selected.has(d.id));

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'updatedAt' || key === 'score' ? 'desc' : 'asc' }));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageItems.forEach((d) => next.delete(d.id));
      else pageItems.forEach((d) => next.add(d.id));
      return next;
    });

  const openDoc = (doc: DocumentItem) => {
    updateParam('id', doc.id);
    logActivity({ action: 'Consulta', documentId: doc.id, documentCode: doc.code, detail: 'Consulta del documento' });
  };

  const closeDoc = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('id');
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const clearFilters = () => {
    setText('');
    setArea('');
    setConf('');
    const next = new URLSearchParams(params);
    next.delete('estado');
    next.delete('tipo');
    setParams(next, { replace: true });
  };

  const applyBulk = () => {
    if (!bulkStatus) return;
    if (bulkStatus === 'Rechazado' && bulkReason.trim().length < 5) return;
    const changed = changeStatus([...selected], bulkStatus, bulkStatus === 'Rechazado' ? bulkReason : undefined);
    toast(changed ? `${changed} documento(s) pasaron a "${bulkStatus}".` : 'Los documentos seleccionados ya tenían ese estado.', changed ? 'success' : 'info');
    setBulkStatus('');
    setBulkReason('');
    setRejectOpen(false);
    setSelected(new Set());
  };

  const exportCsv = () => {
    const rows = documents.filter((d) => selected.has(d.id));
    const source = rows.length ? rows : filtered;
    const csv = toCsv([
      ['Código', 'Título', 'Tipo', 'Área', 'Estado', 'Confidencialidad', 'Responsable', 'Puntaje', 'Actualizado'],
      ...source.map((d) => [d.code, d.title, d.type, d.area, d.status, d.confidentiality, d.owner, d.validation ? d.validation.score : '', formatDate(d.updatedAt)]),
    ]);
    downloadTextFile(`documentos-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
    logActivity({ action: 'Descarga', detail: `Exportación CSV de ${source.length} documentos` });
    toast(`Se exportaron ${source.length} documentos.`);
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th>
      <button className={`th-sort${sort.key === k ? ' active' : ''}`} onClick={() => toggleSort(k)}>
        {label}
        <Icon name={sort.key === k && sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'} size={12} />
      </button>
    </th>
  );

  return (
    <div className="page">
      <div className="tabs status-tabs">
        {(['', ...DOC_STATUSES] as (DocStatus | '')[]).map((s) => (
          <button key={s || 'todos'} className={`tab${status === s ? ' active' : ''}`} onClick={() => updateParam('estado', s)}>
            {s || 'Todos'}
            <span className="tab-count">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      <div className="card table-card">
        <div className="toolbar">
          <div className="input-icon">
            <Icon name="search" size={15} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Filtrar por título, código, responsable o etiqueta" />
          </div>
          <select value={type} onChange={(e) => updateParam('tipo', e.target.value)} aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {DOC_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área">
            <option value="">Todas las áreas</option>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select value={conf} onChange={(e) => setConf(e.target.value)} aria-label="Confidencialidad">
            <option value="">Toda confidencialidad</option>
            {CONFIDENTIALITY_LEVELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <Icon name="x" size={14} />
              Limpiar filtros
            </button>
          )}
          <div className="toolbar-spacer" />
          <button className="btn btn-secondary btn-sm" onClick={exportCsv}>
            <Icon name="download" size={14} />
            Exportar CSV
          </button>
          <Link to="/cargar" className="btn btn-primary btn-sm">
            <Icon name="plus" size={14} />
            Nuevo
          </Link>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <strong>{selected.size} seleccionado(s)</strong>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as DocStatus | '')} aria-label="Nuevo estado">
              <option value="">Cambiar estado a…</option>
              {DOC_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" disabled={!bulkStatus} onClick={() => (bulkStatus === 'Rechazado' ? setRejectOpen(true) : applyBulk())}>
              Aplicar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              Quitar selección
            </button>
          </div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" checked={allPageSelected} onChange={togglePage} aria-label="Seleccionar página" />
                </th>
                <SortHeader k="title" label="Documento" />
                <SortHeader k="type" label="Tipo" />
                <SortHeader k="area" label="Área" />
                <SortHeader k="status" label="Estado" />
                <th>Confidencialidad</th>
                <SortHeader k="score" label="Validación" />
                <SortHeader k="updatedAt" label="Actualizado" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d) => (
                <tr key={d.id} className={`${selected.has(d.id) ? 'row-selected' : ''}${selectedId === d.id ? ' row-active' : ''}`} onClick={() => openDoc(d)}>
                  <td className="col-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} aria-label={`Seleccionar ${d.title}`} />
                  </td>
                  <td>
                    <div className="doc-cell">
                      <FileTypeIcon extension={d.extension} size="sm" />
                      <div>
                        <div className="doc-title">{d.title}</div>
                        <div className="muted small mono">
                          {d.code} · {d.owner}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{d.type}</td>
                  <td>{d.area}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td>
                    <ConfidentialityBadge level={d.confidentiality} />
                  </td>
                  <td>
                    <ScoreBadge validation={d.validation} />
                  </td>
                  <td className="muted" title={formatDate(d.updatedAt)}>
                    {formatRelative(d.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pageItems.length === 0 && (
            <div className="empty">
              <Icon name="filter" size={26} />
              <p>No hay documentos que coincidan con los filtros aplicados.</p>
              {hasFilters && (
                <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <div className="pagination">
          <span className="muted small">
            Mostrando {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} documentos
          </span>
          <div className="pager">
            <button className="icon-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Página anterior">
              <Icon name="chevron-left" size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} className={`page-btn${n === currentPage ? ' active' : ''}`} onClick={() => setPage(n)}>
                {n}
              </button>
            ))}
            <button className="icon-btn" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Página siguiente">
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      </div>

      {selectedDoc && <DocumentDetailPanel document={selectedDoc} onClose={closeDoc} />}

      {rejectOpen && (
        <Modal
          title={`Rechazar ${selected.size} documento(s)`}
          onClose={() => setRejectOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setRejectOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={applyBulk} disabled={bulkReason.trim().length < 5}>
                Confirmar rechazo
              </button>
            </>
          }
        >
          <label className="field-label" htmlFor="bulk-reason">
            Motivo del rechazo (obligatorio, se registrará en cada documento)
          </label>
          <textarea id="bulk-reason" rows={3} autoFocus value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
        </Modal>
      )}
    </div>
  );
}
