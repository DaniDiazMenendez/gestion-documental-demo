import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { useDemoStore } from '../store/DemoStore';
import type { ActivityAction } from '../types';
import { formatRelative, pluralize } from '../lib/utils';

type View = 'demo' | 'azure';
type LayerId = 'cliente' | 'app' | 'ia' | 'datos';
type NodeId = 'user' | 'ui' | 'store' | 'workflow' | 'classify' | 'validate' | 'search' | 'files' | 'metadata' | 'audit';
type FlowId = 'carga' | 'validacion' | 'estado' | 'busqueda' | 'consulta' | 'auditoria';

interface ArchNode {
  id: NodeId;
  layer: LayerId;
  icon: IconName;
  demo: { name: string; tech: string };
  azure: { name: string; tech: string };
}

interface FlowStep {
  node: NodeId;
  title: string;
  demo: string;
  azure: string;
}

interface Flow {
  id: FlowId;
  name: string;
  icon: IconName;
  route: string;
  screen: string;
  trigger: string;
  actions: ActivityAction[];
  steps: FlowStep[];
}

const LAYERS: { id: LayerId; title: string; subtitle: string }[] = [
  { id: 'cliente', title: 'Usuario y frontend', subtitle: 'Identidad y experiencia' },
  { id: 'app', title: 'API y orquestación', subtitle: 'Lógica de negocio y flujos' },
  { id: 'ia', title: 'Servicios de IA', subtitle: 'Clasificación, validación y búsqueda' },
  { id: 'datos', title: 'Datos y observabilidad', subtitle: 'Archivos, metadatos y auditoría' },
];

const NODES: ArchNode[] = [
  {
    id: 'user',
    layer: 'cliente',
    icon: 'users',
    demo: { name: 'Usuario de la demo', tech: 'Usuario fijo: María González' },
    azure: { name: 'Microsoft Entra ID', tech: 'SSO, MFA y roles por área' },
  },
  {
    id: 'ui',
    layer: 'cliente',
    icon: 'grid',
    demo: { name: 'Interfaz React', tech: 'Vite + React Router · src/pages' },
    azure: { name: 'Azure Static Web Apps', tech: 'SPA con CDN global y autenticación' },
  },
  {
    id: 'store',
    layer: 'app',
    icon: 'layers',
    demo: { name: 'DemoStore', tech: 'React Context · src/store' },
    azure: { name: 'Azure Functions + API Management', tech: 'API REST segura y versionada' },
  },
  {
    id: 'workflow',
    layer: 'app',
    icon: 'activity',
    demo: { name: 'Reglas de estado', tech: 'changeStatus() en DemoStore' },
    azure: { name: 'Logic Apps / Durable Functions', tech: 'Aprobaciones con eventos de Event Grid' },
  },
  {
    id: 'classify',
    layer: 'ia',
    icon: 'sparkles',
    demo: { name: 'Clasificador simulado', tech: 'classifyDocument() · extractFields()' },
    azure: { name: 'Azure AI Document Intelligence', tech: 'OCR, clasificador y extracción de campos' },
  },
  {
    id: 'validate',
    layer: 'ia',
    icon: 'shield',
    demo: { name: 'Motor de validación', tech: 'simulateValidation() · 8 controles' },
    azure: { name: 'Azure AI Language + Purview', tech: 'Detección de PII y etiquetas de confidencialidad' },
  },
  {
    id: 'search',
    layer: 'ia',
    icon: 'search',
    demo: { name: 'Buscador semántico simulado', tech: 'parseQuery() · searchDocuments()' },
    azure: { name: 'Azure AI Search + Azure OpenAI', tech: 'Búsqueda híbrida, vectorial y ranking semántico' },
  },
  {
    id: 'files',
    layer: 'datos',
    icon: 'folder',
    demo: { name: 'Archivo en el navegador', tech: 'FileReader · memoria local' },
    azure: { name: 'Azure Blob Storage', tech: 'Niveles Hot, Cool y Archive' },
  },
  {
    id: 'metadata',
    layer: 'datos',
    icon: 'file',
    demo: { name: 'Metadatos en localStorage', tech: 'Clave gestion-documental-demo:state' },
    azure: { name: 'Azure Cosmos DB', tech: 'Metadatos, versiones y comentarios' },
  },
  {
    id: 'audit',
    layer: 'datos',
    icon: 'audit',
    demo: { name: 'Registro de actividad', tech: 'logActivity() en localStorage' },
    azure: { name: 'Azure Monitor + Log Analytics', tech: 'Trazas, consultas KQL y retención' },
  },
];

const FLOWS: Flow[] = [
  {
    id: 'carga',
    name: 'Carga de documento',
    icon: 'upload',
    route: '/cargar',
    screen: 'Cargar documento',
    trigger: 'Arrastrás un archivo, revisás la clasificación sugerida y registrás el documento.',
    actions: ['Carga'],
    steps: [
      {
        node: 'user',
        title: 'Selección del archivo',
        demo: 'El usuario arrastra o elige un archivo en la zona de carga.',
        azure: 'El usuario ya está autenticado con Entra ID y su rol habilita la carga en el área.',
      },
      {
        node: 'ui',
        title: 'Validación previa',
        demo: 'UploadPage controla extensión y tamaño (máx. 20 MB) y lee el texto con FileReader.',
        azure: 'La SPA pide a la API una URL SAS de escritura y sube el archivo directo, sin pasar por el servidor.',
      },
      {
        node: 'files',
        title: 'Almacenamiento del binario',
        demo: 'El contenido queda en memoria del navegador; no se envía a ningún servidor.',
        azure: 'El archivo se guarda en el contenedor de ingesta de Blob Storage y dispara un evento BlobCreated.',
      },
      {
        node: 'classify',
        title: 'Clasificación y extracción',
        demo: 'classifyDocument() sugiere tipo y confianza; extractFields() y generateSummary() completan metadatos.',
        azure: 'Document Intelligence clasifica y extrae campos; Azure OpenAI genera resumen y etiquetas.',
      },
      {
        node: 'validate',
        title: 'Validación automática',
        demo: 'simulateValidation() ejecuta 8 controles: formato, duplicados, campos obligatorios y datos sensibles.',
        azure: 'Durable Functions orquesta los controles y AI Language detecta datos personales (PII).',
      },
      {
        node: 'store',
        title: 'Registro del documento',
        demo: 'addDocument() asigna código, versión 1 y estado inicial.',
        azure: 'La API (Functions detrás de API Management) confirma el alta y publica el evento en Event Grid.',
      },
      {
        node: 'metadata',
        title: 'Persistencia de metadatos',
        demo: 'El estado completo se guarda en localStorage.',
        azure: 'Los metadatos se escriben en Cosmos DB y el indexador de AI Search los incorpora.',
      },
      {
        node: 'audit',
        title: 'Traza de auditoría',
        demo: 'logActivity() registra el evento "Carga" con usuario, documento y resultado.',
        azure: 'El evento se envía a Log Analytics con el ID de correlación de la operación.',
      },
    ],
  },
  {
    id: 'validacion',
    name: 'Validación y aprobación',
    icon: 'shield',
    route: '/validacion',
    screen: 'Validación',
    trigger: 'Desde la cola de revisión ejecutás la validación y aprobás o rechazás el documento.',
    actions: ['Validación'],
    steps: [
      {
        node: 'ui',
        title: 'Cola de revisión',
        demo: 'ValidationPage lista los documentos en Borrador y En revisión con su puntaje.',
        azure: 'La SPA consulta la API filtrando por las áreas que el rol del revisor tiene asignadas.',
      },
      {
        node: 'store',
        title: 'Solicitud de validación',
        demo: 'runValidation() recibe el documento seleccionado.',
        azure: 'La API encola la validación y devuelve el estado de la orquestación.',
      },
      {
        node: 'validate',
        title: 'Ejecución de controles',
        demo: 'Se recalculan los 8 controles y el puntaje de calidad.',
        azure: 'Durable Functions ejecuta los controles en paralelo con AI Language y Purview.',
      },
      {
        node: 'workflow',
        title: 'Decisión del revisor',
        demo: 'Aprobar o Rechazar (con motivo obligatorio) llama a changeStatus().',
        azure: 'Logic Apps registra la aprobación y notifica al responsable por Teams o correo.',
      },
      {
        node: 'metadata',
        title: 'Actualización del documento',
        demo: 'Se guarda el resultado de la validación y el nuevo estado en localStorage.',
        azure: 'Cosmos DB guarda el resultado y la nueva versión del documento.',
      },
      {
        node: 'audit',
        title: 'Traza de auditoría',
        demo: 'Se registran los eventos "Validación" y "Cambio de estado".',
        azure: 'Log Analytics conserva la evidencia de quién validó, cuándo y con qué resultado.',
      },
    ],
  },
  {
    id: 'estado',
    name: 'Cambio de estado',
    icon: 'refresh',
    route: '/documentos',
    screen: 'Documentos',
    trigger: 'Seleccionás uno o varios documentos y cambiás su estado desde la tabla o el panel de detalles.',
    actions: ['Cambio de estado'],
    steps: [
      {
        node: 'user',
        title: 'Selección de documentos',
        demo: 'El usuario marca documentos en la tabla o abre el panel de detalles.',
        azure: 'Entra ID valida que el rol tenga permiso de edición sobre esos documentos.',
      },
      {
        node: 'ui',
        title: 'Acción masiva o individual',
        demo: 'DocumentsPage o DocumentDetailPanel envían el nuevo estado y un comentario opcional.',
        azure: 'La SPA llama a la API con los IDs seleccionados.',
      },
      {
        node: 'store',
        title: 'Aplicación del cambio',
        demo: 'changeStatus() actualiza los documentos y devuelve cuántos cambiaron.',
        azure: 'Functions aplica el cambio en una transacción por lote.',
      },
      {
        node: 'workflow',
        title: 'Reglas de ciclo de vida',
        demo: 'Se incrementa la versión y se agrega el comentario al historial.',
        azure: 'Event Grid publica DocumentStatusChanged y Logic Apps dispara las acciones asociadas.',
      },
      {
        node: 'files',
        title: 'Gestión del archivo',
        demo: 'Sin efecto sobre el archivo: el binario no se almacena en la demo.',
        azure: 'Si el estado es Archivado, el blob pasa al nivel Archive con política de retención.',
      },
      {
        node: 'metadata',
        title: 'Persistencia',
        demo: 'El nuevo estado se guarda en localStorage.',
        azure: 'Cosmos DB actualiza el documento y el índice de búsqueda se refresca.',
      },
      {
        node: 'audit',
        title: 'Traza de auditoría',
        demo: 'logActivity() registra un "Cambio de estado" por documento.',
        azure: 'Log Analytics guarda estado anterior, estado nuevo y usuario.',
      },
    ],
  },
  {
    id: 'busqueda',
    name: 'Búsqueda inteligente',
    icon: 'search',
    route: '/busqueda',
    screen: 'Búsqueda inteligente',
    trigger: 'Escribís una consulta en lenguaje natural o usás una búsqueda sugerida.',
    actions: ['Búsqueda'],
    steps: [
      {
        node: 'ui',
        title: 'Consulta del usuario',
        demo: 'SearchPage o la búsqueda global de la barra superior reciben el texto.',
        azure: 'La SPA envía la consulta a la API de búsqueda.',
      },
      {
        node: 'search',
        title: 'Interpretación de la intención',
        demo: 'parseQuery() detecta tipo, estado, área y período dentro de la frase.',
        azure: 'Azure OpenAI reescribe la consulta y genera los filtros estructurados.',
      },
      {
        node: 'metadata',
        title: 'Lectura del repositorio',
        demo: 'Se recorren los documentos guardados en localStorage.',
        azure: 'AI Search consulta su índice, alimentado desde Cosmos DB y Blob Storage.',
      },
      {
        node: 'search',
        title: 'Ranking y fragmentos',
        demo: 'searchDocuments() puntúa relevancia y arma fragmentos con los términos resaltados.',
        azure: 'Búsqueda híbrida (texto + vectores) con ranking semántico y captions.',
      },
      {
        node: 'store',
        title: 'Historial de búsquedas',
        demo: 'recordSearch() guarda la consulta en búsquedas recientes.',
        azure: 'La API guarda el historial por usuario para sugerencias personalizadas.',
      },
      {
        node: 'audit',
        title: 'Traza de auditoría',
        demo: 'Se registra el evento "Búsqueda" con la cantidad de resultados.',
        azure: 'Log Analytics registra la consulta para métricas de uso y seguridad.',
      },
    ],
  },
  {
    id: 'consulta',
    name: 'Consulta y colaboración',
    icon: 'eye',
    route: '/documentos',
    screen: 'Documentos',
    trigger: 'Abrís el panel de detalles, revisás metadatos, descargás o dejás un comentario.',
    actions: ['Consulta', 'Descarga', 'Comentario'],
    steps: [
      {
        node: 'ui',
        title: 'Panel de detalles',
        demo: 'DocumentDetailPanel muestra resumen, campos extraídos, validación e historial.',
        azure: 'La SPA obtiene el documento por ID desde la API.',
      },
      {
        node: 'store',
        title: 'Lectura y comentarios',
        demo: 'addComment() agrega el comentario con autor y fecha.',
        azure: 'Functions valida permisos y devuelve solo los campos que el rol puede ver.',
      },
      {
        node: 'metadata',
        title: 'Datos del documento',
        demo: 'Metadatos y comentarios se leen y guardan en localStorage.',
        azure: 'Cosmos DB entrega metadatos y comentarios con control de concurrencia.',
      },
      {
        node: 'files',
        title: 'Descarga',
        demo: 'Se genera un archivo de texto con los metadatos del documento.',
        azure: 'La API emite una URL SAS de lectura con vencimiento corto.',
      },
      {
        node: 'audit',
        title: 'Traza de auditoría',
        demo: 'Se registran los eventos "Consulta", "Descarga" o "Comentario".',
        azure: 'Log Analytics deja evidencia de cada acceso a documentos confidenciales.',
      },
    ],
  },
  {
    id: 'auditoria',
    name: 'Auditoría y monitoreo',
    icon: 'audit',
    route: '/auditoria',
    screen: 'Auditoría',
    trigger: 'Filtrás eventos por usuario, acción, resultado o fecha, y exportás a CSV.',
    actions: ['Inicio de sesión'],
    steps: [
      {
        node: 'user',
        title: 'Inicio de sesión',
        demo: 'Los inicios de sesión forman parte de los datos simulados.',
        azure: 'Entra ID envía los registros de inicio de sesión a Log Analytics.',
      },
      {
        node: 'store',
        title: 'Generación de actividad',
        demo: 'generateActivity() crea eventos aleatorios para enriquecer la auditoría.',
        azure: 'Cada servicio emite telemetría con Application Insights.',
      },
      {
        node: 'audit',
        title: 'Consulta de eventos',
        demo: 'AuditPage filtra la actividad guardada en localStorage.',
        azure: 'Las consultas KQL sobre Log Analytics alimentan la pantalla y los Workbooks.',
      },
      {
        node: 'ui',
        title: 'Exportación',
        demo: 'Se descarga un CSV con los eventos filtrados.',
        azure: 'Exportación programada a Blob Storage inmutable para cumplimiento normativo.',
      },
    ],
  },
];

const FLOW_BY_ACTION = new Map<ActivityAction, FlowId>(FLOWS.flatMap((f) => f.actions.map((a) => [a, f.id] as [ActivityAction, FlowId])));
const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
const STEP_MS = 1700;

export function ArchitecturePage() {
  const { activity } = useDemoStore();
  const [view, setView] = useState<View>('demo');
  const [flowId, setFlowId] = useState<FlowId>(() => (activity[0] && FLOW_BY_ACTION.get(activity[0].action)) || 'carga');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const flow = FLOWS.find((f) => f.id === flowId) ?? FLOWS[0];
  const current = flow.steps[step];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (step >= flow.steps.length - 1) setPlaying(false);
      else setStep((s) => s + 1);
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, step, flow.steps.length]);

  const flowCounts = useMemo(() => {
    const counts = new Map<FlowId, number>();
    for (const entry of activity) {
      const id = FLOW_BY_ACTION.get(entry.action);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [activity]);

  const nodeCounts = useMemo(() => {
    const counts = new Map<NodeId, number>();
    for (const f of FLOWS) {
      const total = flowCounts.get(f.id) ?? 0;
      for (const id of new Set(f.steps.map((s) => s.node))) counts.set(id, (counts.get(id) ?? 0) + total);
    }
    return counts;
  }, [flowCounts]);

  const stepsByNode = useMemo(() => {
    const map = new Map<NodeId, number[]>();
    flow.steps.forEach((s, i) => map.set(s.node, [...(map.get(s.node) ?? []), i + 1]));
    return map;
  }, [flow]);

  const maxFlowCount = Math.max(1, ...FLOWS.map((f) => flowCounts.get(f.id) ?? 0));
  const recent = activity.slice(0, 6);

  const selectFlow = (id: FlowId, autoplay = false) => {
    setFlowId(id);
    setStep(0);
    setPlaying(autoplay);
  };

  const onNodeClick = (id: NodeId) => {
    const steps = stepsByNode.get(id);
    if (!steps) return;
    const next = steps.find((n) => n - 1 > step) ?? steps[0];
    setPlaying(false);
    setStep(next - 1);
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= flow.steps.length - 1) setStep(0);
    setPlaying(true);
  };

  return (
    <div className="page">
      <div className="card arch-card">
        <div className="card-head">
          <h3>
            <Icon name="layers" size={17} />
            Mapa de componentes
          </h3>
          <div className="row-center arch-legend">
            <span className="legend-item">
              <span className="legend-swatch swatch-active" />
              Paso actual
            </span>
            <span className="legend-item">
              <span className="legend-swatch swatch-flow" />
              Participa del recorrido
            </span>
            <div className="segmented" role="group" aria-label="Vista de arquitectura">
              <button className={view === 'demo' ? 'active' : ''} onClick={() => setView('demo')}>
                Demo actual
              </button>
              <button className={view === 'azure' ? 'active' : ''} onClick={() => setView('azure')}>
                Implementación en Azure
              </button>
            </div>
          </div>
        </div>

        <div className="arch-diagram">
          {LAYERS.map((layer, li) => (
            <div key={layer.id} className="arch-col-wrap">
              <div className="arch-layer">
                <div className="arch-layer-head">
                  <strong>{layer.title}</strong>
                  <span>{layer.subtitle}</span>
                </div>
                {NODES.filter((n) => n.layer === layer.id).map((node) => {
                  const nums = stepsByNode.get(node.id);
                  const isActive = current.node === node.id;
                  const info = view === 'demo' ? node.demo : node.azure;
                  return (
                    <button
                      key={node.id}
                      className={`arch-node${nums ? ' in-flow' : ''}${isActive ? ' active' : ''}${view === 'azure' ? ' azure' : ''}`}
                      onClick={() => onNodeClick(node.id)}
                      disabled={!nums}
                      title={nums ? 'Ir al paso de este componente' : 'No participa del recorrido seleccionado'}
                    >
                      <div className="arch-node-head">
                        <span className="arch-node-icon">
                          <Icon name={view === 'azure' ? 'cloud' : node.icon} size={15} />
                        </span>
                        <strong>{info.name}</strong>
                        {nums && <span className="arch-step-nums">{nums.join(' · ')}</span>}
                      </div>
                      <div className="arch-node-tech">{info.tech}</div>
                      <div className="arch-node-foot">{pluralize(nodeCounts.get(node.id) ?? 0, 'evento', 'eventos')} registrados</div>
                    </button>
                  );
                })}
              </div>
              {li < LAYERS.length - 1 && (
                <div className="arch-arrow" aria-hidden="true">
                  <Icon name="arrow-right" size={16} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2-1">
        <div className="card">
          <div className="card-head">
            <h3>
              <Icon name="play" size={15} />
              Recorrido de una acción
            </h3>
            <Link to={flow.route} className="btn btn-secondary btn-sm">
              Ir a {flow.screen}
              <Icon name="arrow-right" size={14} />
            </Link>
          </div>

          <div className="chips arch-flows">
            {FLOWS.map((f) => (
              <button key={f.id} className={`chip${f.id === flowId ? ' active' : ''}`} onClick={() => selectFlow(f.id)}>
                <Icon name={f.icon} size={13} />
                {f.name}
                <span className="chip-count">{flowCounts.get(f.id) ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="notice notice-info arch-trigger">
            <Icon name="info" size={16} />
            <span>
              <strong>En pantalla:</strong> {flow.trigger}
            </span>
          </div>

          <div className="arch-player">
            <button className="btn btn-primary btn-sm" onClick={togglePlay}>
              <Icon name={playing ? 'pause' : 'play'} size={14} />
              {playing ? 'Pausar' : step >= flow.steps.length - 1 ? 'Repetir recorrido' : 'Reproducir recorrido'}
            </button>
            <button
              className="icon-btn"
              onClick={() => {
                setPlaying(false);
                setStep((s) => Math.max(0, s - 1));
              }}
              disabled={step === 0}
              aria-label="Paso anterior"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <button
              className="icon-btn"
              onClick={() => {
                setPlaying(false);
                setStep((s) => Math.min(flow.steps.length - 1, s + 1));
              }}
              disabled={step === flow.steps.length - 1}
              aria-label="Paso siguiente"
            >
              <Icon name="chevron-right" size={16} />
            </button>
            <span className="muted small">
              Paso {step + 1} de {flow.steps.length}
            </span>
            <div className="arch-progress">
              <div style={{ width: `${((step + 1) / flow.steps.length) * 100}%` }} />
            </div>
          </div>

          <ol className="arch-steps">
            {flow.steps.map((s, i) => {
              const node = NODE_BY_ID.get(s.node);
              const state = i === step ? ' active' : i < step ? ' done' : '';
              return (
                <li key={`${s.node}-${i}`} className={`arch-step${state}`}>
                  <button
                    className="arch-step-btn"
                    onClick={() => {
                      setPlaying(false);
                      setStep(i);
                    }}
                  >
                    <span className="arch-step-num">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>
                    <div className="arch-step-body">
                      <div className="arch-step-title">
                        <strong>{s.title}</strong>
                        <span className="badge badge-gray">{view === 'demo' ? node?.demo.name : node?.azure.name}</span>
                      </div>
                      {i === step ? (
                        <div className="arch-step-detail">
                          <div className={view === 'demo' ? 'emph' : ''}>
                            <span className="arch-tag tag-demo">Demo</span>
                            {s.demo}
                          </div>
                          <div className={view === 'azure' ? 'emph' : ''}>
                            <span className="arch-tag tag-azure">Azure</span>
                            {s.azure}
                          </div>
                        </div>
                      ) : (
                        <div className="arch-step-summary">{view === 'demo' ? s.demo : s.azure}</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>
                <Icon name="activity" size={16} />
                Actividad por recorrido
              </h3>
              <span className="muted small">{pluralize(activity.length, 'evento', 'eventos')}</span>
            </div>
            <div className="arch-flow-bars">
              {FLOWS.map((f) => {
                const count = flowCounts.get(f.id) ?? 0;
                return (
                  <button key={f.id} className={`arch-flow-bar${f.id === flowId ? ' active' : ''}`} onClick={() => selectFlow(f.id, true)}>
                    <span className="arch-flow-bar-label">{f.name}</span>
                    <span className="arch-flow-bar-track">
                      <span style={{ width: `${(count / maxFlowCount) * 100}%` }} />
                    </span>
                    <span className="arch-flow-bar-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>
                <Icon name="clock" size={16} />
                Últimos eventos
              </h3>
              <Link to="/auditoria" className="link small">
                Ver auditoría
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="empty small-empty">Todavía no hay actividad registrada.</div>
            ) : (
              <ul className="arch-events">
                {recent.map((e) => {
                  const fid = FLOW_BY_ACTION.get(e.action);
                  return (
                    <li key={e.id}>
                      <div className="arch-event-main">
                        <strong>{e.action}</strong>
                        <span className="ellipsis">{e.documentCode ? `${e.documentCode} · ${e.detail}` : e.detail}</span>
                        <span className="muted small">{formatRelative(e.timestamp)}</span>
                      </div>
                      {fid && (
                        <button className="btn btn-ghost btn-sm" onClick={() => selectFlow(fid, true)} title="Reproducir el recorrido de este evento">
                          <Icon name="play" size={12} />
                          Ver recorrido
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
