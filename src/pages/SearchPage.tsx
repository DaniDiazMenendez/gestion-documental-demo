import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDemoStore } from '../store/DemoStore';
import { DOC_STATUSES, DOC_TYPES, type DocStatus, type DocType } from '../types';
import { SUGGESTED_SEARCHES, searchDocuments } from '../lib/search';
import { formatDate, normalizeAligned } from '../lib/utils';
import { ConfidentialityBadge, FileTypeIcon, StatusBadge } from '../components/Badges';
import { Icon } from '../components/Icon';

function highlight(text: string, stems: string[]): ReactNode {
  if (!stems.length || !text) return text;
  const norm = normalizeAligned(text);
  const ranges: [number, number][] = [];
  for (const s of stems) {
    let from = 0;
    let idx = norm.indexOf(s, from);
    while (idx >= 0) {
      const prev = idx > 0 ? norm[idx - 1] : ' ';
      if (!/[a-z0-9]/.test(prev)) {
        let end = idx + s.length;
        while (end < norm.length && /[a-z0-9]/.test(norm[end])) end++;
        ranges.push([idx, end]);
      }
      from = idx + s.length;
      idx = norm.indexOf(s, from);
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const out: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([a, b], i) => {
    if (a > cursor) out.push(text.slice(cursor, a));
    out.push(<mark key={i}>{text.slice(a, b)}</mark>);
    cursor = b;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function SearchPage() {
  const { documents, recentSearches, recordSearch, logActivity } = useDemoStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [typeFacet, setTypeFacet] = useState<DocType | ''>('');
  const [statusFacet, setStatusFacet] = useState<DocStatus | ''>('');

  useEffect(() => {
    setInput(q);
    setTypeFacet('');
    setStatusFacet('');
  }, [q]);

  const outcome = useMemo(() => searchDocuments(documents, q), [documents, q]);
  const hits = outcome.hits.filter((h) => (!typeFacet || h.doc.type === typeFacet) && (!statusFacet || h.doc.status === statusFacet));

  const run = (value: string) => {
    const v = value.trim();
    if (!v) return;
    recordSearch(v, searchDocuments(documents, v).hits.length);
    setParams({ q: v });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(input);
  };

  const typeCounts = DOC_TYPES.map((t) => ({ t, n: outcome.hits.filter((h) => h.doc.type === t).length })).filter((x) => x.n > 0);
  const statusCounts = DOC_STATUSES.map((s) => ({ s, n: outcome.hits.filter((h) => h.doc.status === s).length })).filter((x) => x.n > 0);

  const openResult = (id: string, code: string) => {
    logActivity({ action: 'Consulta', documentId: id, documentCode: code, detail: `Consulta desde resultados de búsqueda "${q}"` });
    navigate(`/documentos?id=${id}`);
  };

  const interpreted = [
    ...outcome.parsed.types.map((t) => `Tipo: ${t}`),
    ...outcome.parsed.statuses.map((s) => `Estado: ${s}`),
    ...outcome.parsed.terms.map((t) => `"${t}"`),
  ];

  return (
    <div className="page">
      <section className="card search-hero">
        <form onSubmit={onSubmit} className="search-big">
          <Icon name="search" size={20} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntá en lenguaje natural, por ejemplo: facturas pendientes de Contoso"
            autoFocus
            aria-label="Consulta de búsqueda"
          />
          {input && (
            <button type="button" className="icon-btn" onClick={() => setInput('')} aria-label="Borrar">
              <Icon name="x" size={16} />
            </button>
          )}
          <button className="btn btn-primary" type="submit" disabled={!input.trim()}>
            Buscar
          </button>
        </form>
        <div className="suggest-row">
          <span className="muted small">
            <Icon name="sparkles" size={13} /> Búsquedas sugeridas:
          </span>
          {SUGGESTED_SEARCHES.map((s) => (
            <button key={s} className="chip" onClick={() => run(s)}>
              {s}
            </button>
          ))}
        </div>
        {recentSearches.length > 0 && (
          <div className="suggest-row">
            <span className="muted small">
              <Icon name="clock" size={13} /> Recientes:
            </span>
            {recentSearches.map((s) => (
              <button key={s} className="chip chip-ghost" onClick={() => run(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {q ? (
        <div className="search-layout">
          <aside className="card facets">
            <h4>Tipo documental</h4>
            <button className={`facet${typeFacet === '' ? ' active' : ''}`} onClick={() => setTypeFacet('')}>
              Todos <span>{outcome.hits.length}</span>
            </button>
            {typeCounts.map(({ t, n }) => (
              <button key={t} className={`facet${typeFacet === t ? ' active' : ''}`} onClick={() => setTypeFacet(t)}>
                {t} <span>{n}</span>
              </button>
            ))}
            <h4>Estado</h4>
            <button className={`facet${statusFacet === '' ? ' active' : ''}`} onClick={() => setStatusFacet('')}>
              Todos <span>{outcome.hits.length}</span>
            </button>
            {statusCounts.map(({ s, n }) => (
              <button key={s} className={`facet${statusFacet === s ? ' active' : ''}`} onClick={() => setStatusFacet(s)}>
                {s} <span>{n}</span>
              </button>
            ))}
          </aside>

          <section className="results">
            <div className="results-head">
              <div>
                <strong>{hits.length}</strong> {hits.length === 1 ? 'resultado' : 'resultados'} para <strong>“{q}”</strong>
              </div>
              {interpreted.length > 0 && (
                <div className="interpreted">
                  <span className="muted small">Interpretación:</span>
                  {interpreted.map((x) => (
                    <span key={x} className="tag">
                      {x}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {outcome.partial && (
              <div className="notice notice-info">
                <Icon name="info" size={16} />
                Ningún documento contiene todos los términos. Se muestran coincidencias parciales.
              </div>
            )}
            {hits.length === 0 ? (
              <div className="card empty">
                <Icon name="search" size={28} />
                <p>No se encontraron documentos. Probá con otros términos o con una búsqueda sugerida.</p>
              </div>
            ) : (
              hits.map((h) => (
                <article key={h.doc.id} className="card result" onClick={() => openResult(h.doc.id, h.doc.code)}>
                  <div className="result-top">
                    <FileTypeIcon extension={h.doc.extension} />
                    <div className="grow">
                      <h3>{highlight(h.doc.title, outcome.parsed.stems)}</h3>
                      <div className="muted small">
                        <span className="mono">{h.doc.code}</span> · {h.doc.type} · {h.doc.area} · {formatDate(h.doc.updatedAt)}
                      </div>
                    </div>
                    <div className="relevance">
                      <strong>{h.relevance} %</strong>
                      <span className="muted small">relevancia</span>
                    </div>
                  </div>
                  <p className="snippet">{highlight(h.snippet, outcome.parsed.stems)}</p>
                  <div className="result-foot">
                    <StatusBadge status={h.doc.status} />
                    <ConfidentialityBadge level={h.doc.confidentiality} />
                    <span className="muted small">Coincide en: {h.matchedIn.join(', ')}</span>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      ) : (
        <div className="card empty tall">
          <Icon name="sparkles" size={30} />
          <h3>Búsqueda semántica sobre contenido, metadatos y datos extraídos</h3>
          <p className="muted">
            Escribí una consulta o elegí una sugerencia. El motor detecta tipos y estados (por ejemplo, “facturas pendientes”) y no distingue acentos ni
            mayúsculas.
          </p>
        </div>
      )}
    </div>
  );
}
