import { useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDemoStore, CURRENT_USER } from '../store/DemoStore';
import { searchDocuments } from '../lib/search';
import { initials } from '../lib/utils';
import { Icon, type IconName } from './Icon';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Panel general', icon: 'grid', description: 'Indicadores y actividad del repositorio documental' },
  { to: '/documentos', label: 'Documentos', icon: 'file', description: 'Repositorio, filtros y acciones sobre documentos' },
  { to: '/cargar', label: 'Cargar documento', icon: 'upload', description: 'Ingesta, clasificación y validación automática' },
  { to: '/validacion', label: 'Validación', icon: 'shield', description: 'Cola de revisión y aprobación de documentos' },
  { to: '/busqueda', label: 'Búsqueda inteligente', icon: 'search', description: 'Búsqueda en lenguaje natural sobre contenido y metadatos' },
  { to: '/auditoria', label: 'Auditoría', icon: 'audit', description: 'Trazabilidad completa de acciones y eventos' },
  { to: '/arquitectura', label: 'Arquitectura', icon: 'layers', description: 'Componentes de la solución y recorrido de cada acción de la pantalla, en la demo y en Azure' },
];

function currentNav(pathname: string): NavItem | undefined {
  if (pathname === '/') return NAV_ITEMS[0];
  return NAV_ITEMS.find((n) => n.to !== '/' && pathname.startsWith(n.to));
}

export function Layout() {
  const { documents, recordSearch, resetDemo } = useDemoStore();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const nav = currentNav(location.pathname);
  const pendingCount = documents.filter((d) => d.status === 'En revisión' || d.status === 'Borrador').length;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    recordSearch(q, searchDocuments(documents, q).hits.length);
    navigate(`/busqueda?q=${encodeURIComponent(q)}`);
    setQuery('');
  };

  const onReset = () => {
    resetDemo();
    setConfirmReset(false);
    navigate('/');
    toast('La demo se reinició con los datos iniciales.', 'info');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <Icon name="folder" size={20} />
          </div>
          <div>
            <div className="brand-name">DocuGestión</div>
            <div className="brand-sub">Gestión documental inteligente</div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-section">Módulos</div>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.to === '/validacion' && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="env-card">
            <div className="env-row">
              <span className="env-dot" />
              <span>Entorno de demostración</span>
            </div>
            <p>Datos ficticios guardados en el navegador (localStorage). No se envía información a ningún servidor.</p>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <div className="crumbs">
              DocuGestión <Icon name="chevron-right" size={12} /> <span>{nav ? nav.label : 'Página no encontrada'}</span>
            </div>
            <h1>{nav ? nav.label : 'Página no encontrada'}</h1>
          </div>
          <form className="global-search" onSubmit={onSearch} role="search">
            <Icon name="search" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar documentos, proveedores, contenido…"
              aria-label="Búsqueda global"
            />
            <kbd>Enter</kbd>
          </form>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(true)}>
              <Icon name="refresh" size={15} />
              Reiniciar demo
            </button>
            <div className="user-chip" title={`${CURRENT_USER.name} · ${CURRENT_USER.role}`}>
              <span className="avatar">{initials(CURRENT_USER.name)}</span>
              <div className="user-meta">
                <strong>{CURRENT_USER.name}</strong>
                <span>{CURRENT_USER.role}</span>
              </div>
            </div>
            <span className="demo-badge" title="Aplicación de demostración con datos simulados">DEMO</span>
          </div>
        </header>
        <main className="content">
          {nav && <p className="page-description">{nav.description}</p>}
          <Outlet />
        </main>
      </div>

      {confirmReset && (
        <Modal
          title="Reiniciar demo"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={onReset}>
                <Icon name="refresh" size={15} />
                Reiniciar
              </button>
            </>
          }
        >
          <p>
            Se eliminarán los documentos cargados, los cambios de estado, los comentarios y la actividad registrada durante la sesión. Los
            datos volverán a su estado inicial.
          </p>
        </Modal>
      )}
    </div>
  );
}
