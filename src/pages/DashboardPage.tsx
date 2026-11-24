import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemoStore } from '../store/DemoStore';
import { DOC_STATUSES, DOC_TYPES } from '../types';
import { formatRelative, formatShortDay, toDateKey } from '../lib/utils';
import { ActivityItem } from '../components/ActivityItem';
import { ScoreBadge, StatusBadge, statusColor } from '../components/Badges';
import { Icon, type IconName } from '../components/Icon';

interface Kpi {
  label: string;
  value: string;
  hint: string;
  icon: IconName;
  tone: string;
  to: string;
}

export function DashboardPage() {
  const { documents, activity } = useDemoStore();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const validated = documents.filter((d) => d.validation);
    const avg = validated.length ? Math.round(validated.reduce((s, d) => s + (d.validation?.score ?? 0), 0) / validated.length) : 0;
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      const key = toDateKey(date);
      return { key, label: formatShortDay(date), count: documents.filter((d) => toDateKey(d.createdAt) === key).length };
    });
    return {
      total: documents.length,
      review: documents.filter((d) => d.status === 'En revisión').length,
      drafts: documents.filter((d) => d.status === 'Borrador').length,
      approved: documents.filter((d) => d.status === 'Aprobado').length,
      avg,
      validatedCount: validated.length,
      todayActivity: activity.filter((a) => toDateKey(a.timestamp) === todayKey).length,
      uploadsToday: documents.filter((d) => toDateKey(d.createdAt) === todayKey).length,
      days,
      byStatus: DOC_STATUSES.map((s) => ({ status: s, count: documents.filter((d) => d.status === s).length })),
      byType: DOC_TYPES.map((t) => ({ type: t, count: documents.filter((d) => d.type === t).length })).sort((a, b) => b.count - a.count),
      alerts: activity.filter((a) => a.result !== 'Éxito').length,
    };
  }, [documents, activity]);

  const pending = documents
    .filter((d) => d.status === 'En revisión' || d.status === 'Borrador')
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, 5);

  const maxDay = Math.max(1, ...stats.days.map((d) => d.count));
  const maxType = Math.max(1, ...stats.byType.map((t) => t.count));

  const kpis: Kpi[] = [
    { label: 'Documentos totales', value: String(stats.total), hint: `${stats.uploadsToday} cargados hoy`, icon: 'file', tone: 'blue', to: '/documentos' },
    { label: 'Pendientes de revisión', value: String(stats.review + stats.drafts), hint: `${stats.review} en revisión · ${stats.drafts} borradores`, icon: 'clock', tone: 'amber', to: '/validacion' },
    { label: 'Aprobados', value: String(stats.approved), hint: `${Math.round((stats.approved / Math.max(1, stats.total)) * 100)} % del repositorio`, icon: 'check-circle', tone: 'green', to: '/documentos?estado=Aprobado' },
    { label: 'Calidad promedio', value: `${stats.avg}/100`, hint: `${stats.validatedCount} documentos validados`, icon: 'shield', tone: 'purple', to: '/validacion' },
    { label: 'Eventos de hoy', value: String(stats.todayActivity), hint: `${stats.alerts} alertas en el registro`, icon: 'activity', tone: 'teal', to: '/auditoria' },
  ];

  const openDoc = (id: string) => navigate(`/documentos?id=${id}`);

  return (
    <div className="page">
      <div className="kpi-grid">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="kpi card">
            <span className={`kpi-icon tone-${k.tone}`}>
              <Icon name={k.icon} size={18} />
            </span>
            <div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-hint">{k.hint}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid-2-1">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Documentos cargados</h3>
              <span className="muted small">Últimos 14 días</span>
            </div>
            <Link to="/cargar" className="btn btn-primary btn-sm">
              <Icon name="upload" size={14} />
              Cargar documento
            </Link>
          </div>
          <div className="bar-chart">
            {stats.days.map((d) => (
              <div key={d.key} className="bar-col" title={`${d.label}: ${d.count} documentos`}>
                <span className="bar-value">{d.count || ''}</span>
                <div className="bar" style={{ height: `${(d.count / maxDay) * 100}%` }} />
                <span className="bar-label">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Por estado</h3>
          </div>
          <ul className="status-bars">
            {stats.byStatus.map((s) => (
              <li key={s.status}>
                <Link to={`/documentos?estado=${encodeURIComponent(s.status)}`}>
                  <div className="status-bar-row">
                    <StatusBadge status={s.status} />
                    <strong>{s.count}</strong>
                  </div>
                  <div className="hbar">
                    <span className={`hbar-${statusColor(s.status)}`} style={{ width: `${(s.count / Math.max(1, stats.total)) * 100}%` }} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid-3">
        <section className="card">
          <div className="card-head">
            <h3>Pendientes de revisión</h3>
            <Link to="/validacion" className="link small">
              Ver cola <Icon name="arrow-right" size={12} />
            </Link>
          </div>
          {pending.length ? (
            <ul className="mini-list">
              {pending.map((d) => (
                <li key={d.id} onClick={() => openDoc(d.id)}>
                  <div className="mini-main">
                    <strong className="ellipsis">{d.title}</strong>
                    <span className="muted small">
                      {d.code} · {d.type} · {formatRelative(d.updatedAt)}
                    </span>
                  </div>
                  <div className="mini-side">
                    <StatusBadge status={d.status} />
                    <ScoreBadge validation={d.validation} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty small-empty">
              <Icon name="check-circle" size={22} />
              <p>No hay documentos pendientes.</p>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Actividad reciente</h3>
            <Link to="/auditoria" className="link small">
              Ver auditoría <Icon name="arrow-right" size={12} />
            </Link>
          </div>
          <ul className="activity-list">
            {activity.slice(0, 6).map((a) => (
              <ActivityItem key={a.id} entry={a} onOpenDocument={openDoc} />
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Por tipo documental</h3>
          </div>
          <ul className="type-bars">
            {stats.byType.map((t) => (
              <li key={t.type}>
                <Link to={`/documentos?tipo=${encodeURIComponent(t.type)}`}>
                  <span>{t.type}</span>
                  <div className="hbar">
                    <span className="hbar-blue" style={{ width: `${(t.count / maxType) * 100}%` }} />
                  </div>
                  <strong>{t.count}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
