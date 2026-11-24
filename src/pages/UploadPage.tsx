import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CURRENT_USER, useDemoStore } from '../store/DemoStore';
import { AREAS, CONFIDENTIALITY_LEVELS, DOC_TYPES, type Area, type Confidentiality, type DocType, type DocumentItem, type ValidationResult } from '../types';
import {
  ALLOWED_EXTENSIONS,
  AREA_BY_TYPE,
  MAX_FILE_MB,
  TEXT_EXTENSIONS,
  VALIDATION_STEPS,
  classifyDocument,
  extractFields,
  generateSummary,
  simulateValidation,
  suggestTags,
  validationSummary,
} from '../lib/validation';
import { formatSize, getExtension } from '../lib/utils';
import { FileTypeIcon, StatusBadge } from '../components/Badges';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { ValidationChecks } from '../components/ValidationChecks';

type Phase = 'select' | 'details' | 'validating' | 'validated' | 'registered';

interface FileInfo {
  name: string;
  sizeKb: number;
  extension: string;
  content: string;
  previewUrl: string | null;
}

interface FormState {
  title: string;
  type: DocType;
  area: Area;
  confidentiality: Confidentiality;
  tags: string[];
  summary: string;
}

const STEP_MS = 480;
const MAX_TEXT_BYTES = 1024 * 1024;

function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Documento sin título';
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

export function UploadPage() {
  const { documents, addDocument } = useDemoStore();
  const toast = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  const [phase, setPhase] = useState<Phase>('select');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<FileInfo | null>(null);
  const [suggested, setSuggested] = useState<{ type: DocType; confidence: number } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [registered, setRegistered] = useState<DocumentItem | null>(null);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  useEffect(() => {
    const url = file?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const reset = () => {
    clearTimers();
    setPhase('select');
    setFile(null);
    setSuggested(null);
    setForm(null);
    setResult(null);
    setRegistered(null);
    setStepIndex(0);
    setTagInput('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (f: File) => {
    const extension = getExtension(f.name);
    const isText = TEXT_EXTENSIONS.includes(extension);
    const content = isText && f.size <= MAX_TEXT_BYTES ? await readAsText(f) : '';
    const isImage = f.type.startsWith('image/');
    const info: FileInfo = {
      name: f.name,
      sizeKb: Math.max(f.size > 0 ? 1 : 0, Math.round(f.size / 1024)),
      extension,
      content,
      previewUrl: isImage ? URL.createObjectURL(f) : null,
    };
    const cls = classifyDocument(f.name, content);
    setFile(info);
    setSuggested(cls);
    setForm({
      title: titleFromFileName(f.name),
      type: cls.type,
      area: AREA_BY_TYPE[cls.type],
      confidentiality: cls.type === 'Legajo' || cls.type === 'Contrato' ? 'Confidencial' : 'Interna',
      tags: suggestTags(cls.type),
      summary: generateSummary(cls.type, AREA_BY_TYPE[cls.type]),
    });
    setResult(null);
    setPhase('details');
    if (!ALLOWED_EXTENSIONS.includes(extension)) toast(`La extensión .${extension || '?'} no está admitida; la validación la marcará como error.`, 'warning');
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const updateForm = (patch: Partial<FormState>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const onTypeChange = (type: DocType) => {
    updateForm({ type, area: AREA_BY_TYPE[type], tags: suggestTags(type), summary: generateSummary(type, AREA_BY_TYPE[type]) });
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || !form || form.tags.includes(t)) {
      setTagInput('');
      return;
    }
    updateForm({ tags: [...form.tags, t] });
    setTagInput('');
  };

  const confidence = form && suggested ? (form.type === suggested.type ? suggested.confidence : 0.95) : 0;

  const fields = form && file ? extractFields(form.type, file.content, file.name) : [];

  const startValidation = () => {
    if (!file || !form) return;
    clearTimers();
    setPhase('validating');
    setStepIndex(0);
    const outcome = simulateValidation(
      {
        fileName: file.name,
        extension: file.extension,
        sizeKb: file.sizeKb,
        title: form.title,
        type: form.type,
        area: form.area,
        tags: form.tags,
        content: file.content || fields.map((f) => `${f.label}: ${f.value}`).join('\n'),
        confidentiality: form.confidentiality,
        classificationConfidence: confidence,
      },
      documents.map((d) => d.title),
    );
    VALIDATION_STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStepIndex(i + 1), STEP_MS * (i + 1)));
    });
    timers.current.push(
      window.setTimeout(() => {
        setResult(outcome);
        setPhase('validated');
      }, STEP_MS * (VALIDATION_STEPS.length + 1)),
    );
  };

  const register = () => {
    if (!file || !form || !result) return;
    const doc = addDocument({
      title: form.title.trim(),
      type: form.type,
      area: form.area,
      status: 'En revisión',
      confidentiality: form.confidentiality,
      owner: CURRENT_USER.name,
      sizeKb: file.sizeKb,
      extension: file.extension,
      fileName: file.name,
      tags: form.tags,
      summary: form.summary,
      content: file.content || fields.map((f) => `${f.label}: ${f.value}`).join('\n'),
      classificationConfidence: confidence,
      fields,
      validation: result,
    });
    setRegistered(doc);
    setPhase('registered');
    toast(`Documento ${doc.code} registrado y enviado a revisión.`);
  };

  const summary = validationSummary(result);
  const wizardIndex = ['select', 'details', 'validating', 'validated', 'registered'].indexOf(phase);

  return (
    <div className="page">
      <ol className="wizard">
        {['Seleccionar archivo', 'Clasificar y completar', 'Validación automática', 'Registro'].map((label, i) => {
          const st = i < wizardIndex ? 'done' : i === wizardIndex ? 'current' : '';
          return (
            <li key={label} className={`wizard-step ${st}`}>
              <span className="wizard-num">{st === 'done' ? <Icon name="check" size={13} /> : i + 1}</span>
              {label}
            </li>
          );
        })}
      </ol>

      <div className="grid-2-1">
        <div className="stack">
          {phase === 'select' && (
            <section
              className={`dropzone card${dragging ? ' dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            >
              <div className="dropzone-icon">
                <Icon name="upload" size={30} />
              </div>
              <h3>Arrastrá un archivo o hacé clic para seleccionarlo</h3>
              <p className="muted">PDF, Word, Excel, imágenes o texto · máximo {MAX_FILE_MB} MB</p>
              <p className="muted small">El archivo se procesa solo en tu navegador: no se sube a ningún servidor.</p>
              <input ref={inputRef} type="file" hidden onChange={onInput} />
            </section>
          )}

          {phase !== 'select' && file && form && (
            <section className="card">
              <div className="file-banner">
                <FileTypeIcon extension={file.extension} size="lg" />
                <div className="grow">
                  <strong>{file.name}</strong>
                  <div className="muted small">
                    {formatSize(file.sizeKb)} · {file.content ? `${file.content.length.toLocaleString('es-AR')} caracteres leídos` : 'Contenido binario: texto obtenido por OCR simulado'}
                  </div>
                </div>
                {phase !== 'validating' && phase !== 'registered' && (
                  <button className="btn btn-ghost btn-sm" onClick={reset}>
                    Cambiar archivo
                  </button>
                )}
              </div>

              {phase === 'registered' && registered ? (
                <div className="success-box">
                  <span className="success-icon">
                    <Icon name="check" size={26} />
                  </span>
                  <h3>Documento registrado</h3>
                  <p>
                    Se asignó el código <strong className="mono">{registered.code}</strong> y el documento quedó en la cola de validación.
                  </p>
                  <StatusBadge status={registered.status} />
                  <div className="row-center">
                    <button className="btn btn-primary" onClick={() => navigate(`/documentos?id=${registered.id}`)}>
                      <Icon name="eye" size={15} />
                      Ver documento
                    </button>
                    <Link to="/validacion" className="btn btn-secondary">
                      Ir a validación
                    </Link>
                    <button className="btn btn-ghost" onClick={reset}>
                      Cargar otro
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="ai-hint">
                    <Icon name="sparkles" size={16} />
                    <span>
                      Clasificación sugerida: <strong>{suggested?.type}</strong> ({Math.round((suggested?.confidence ?? 0) * 100)} % de confianza).
                      {form.type !== suggested?.type && ' Tipo corregido manualmente.'}
                    </span>
                  </div>
                  <fieldset className="form-grid" disabled={phase === 'validating'}>
                    <label className="span-2">
                      <span className="field-label">Título</span>
                      <input value={form.title} onChange={(e) => updateForm({ title: e.target.value })} />
                    </label>
                    <label>
                      <span className="field-label">Tipo documental</span>
                      <select value={form.type} onChange={(e) => onTypeChange(e.target.value as DocType)}>
                        {DOC_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Área</span>
                      <select value={form.area} onChange={(e) => updateForm({ area: e.target.value as Area })}>
                        {AREAS.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Confidencialidad</span>
                      <select value={form.confidentiality} onChange={(e) => updateForm({ confidentiality: e.target.value as Confidentiality })}>
                        {CONFIDENTIALITY_LEVELS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Responsable</span>
                      <input value={CURRENT_USER.name} readOnly />
                    </label>
                    <div className="span-2">
                      <span className="field-label">Etiquetas</span>
                      <div className="tag-editor">
                        {form.tags.map((t) => (
                          <span key={t} className="tag">
                            {t}
                            <button type="button" onClick={() => updateForm({ tags: form.tags.filter((x) => x !== t) })} aria-label={`Quitar ${t}`}>
                              <Icon name="x" size={11} />
                            </button>
                          </span>
                        ))}
                        <input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              addTag();
                            }
                          }}
                          onBlur={addTag}
                          placeholder="Agregar etiqueta y Enter"
                        />
                      </div>
                    </div>
                    <label className="span-2">
                      <span className="field-label">Resumen</span>
                      <textarea rows={2} value={form.summary} onChange={(e) => updateForm({ summary: e.target.value })} />
                    </label>
                  </fieldset>

                  {phase === 'details' && (
                    <div className="row-end">
                      <button className="btn btn-ghost" onClick={reset}>
                        Cancelar
                      </button>
                      <button className="btn btn-primary" onClick={startValidation} disabled={!form.title.trim()}>
                        <Icon name="shield" size={15} />
                        Validar documento
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {(phase === 'validating' || phase === 'validated') && (
            <section className="card">
              <div className="card-head">
                <h3>Validación automática</h3>
                {phase === 'validated' && result && (
                  <span className="muted small">
                    {summary.ok} correctos · {summary.warnings} advertencias · {summary.errors} errores
                  </span>
                )}
              </div>
              {phase === 'validating' ? (
                <ul className="stepper">
                  {VALIDATION_STEPS.map((s, i) => (
                    <li key={s.id} className={i < stepIndex ? 'done' : i === stepIndex ? 'running' : ''}>
                      <span className="stepper-dot">{i < stepIndex ? <Icon name="check" size={12} /> : i === stepIndex ? <span className="spinner sm" /> : null}</span>
                      {s.label}
                    </li>
                  ))}
                </ul>
              ) : (
                result && (
                  <>
                    <ValidationChecks result={result} />
                    {summary.errors > 0 && (
                      <div className="notice notice-error">
                        <Icon name="x-circle" size={16} />
                        El documento tiene errores bloqueantes. Corregí los datos o seleccioná otro archivo.
                      </div>
                    )}
                    <div className="row-end">
                      <button className="btn btn-ghost" onClick={() => setPhase('details')}>
                        Editar datos
                      </button>
                      <button className="btn btn-primary" onClick={register} disabled={summary.errors > 0}>
                        <Icon name="check" size={15} />
                        Registrar documento
                      </button>
                    </div>
                  </>
                )
              )}
            </section>
          )}
        </div>

        <aside className="stack">
          {file && form && phase !== 'select' && (
            <section className="card">
              <div className="card-head">
                <h3>
                  <Icon name="sparkles" size={15} /> Datos extraídos
                </h3>
              </div>
              {file.previewUrl && <img className="img-preview" src={file.previewUrl} alt="Vista previa del archivo" />}
              <ul className="field-list compact">
                {fields.map((f) => (
                  <li key={f.label}>
                    <div className="field-row">
                      <span className="muted">{f.label}</span>
                      <strong>{f.value}</strong>
                    </div>
                  </li>
                ))}
              </ul>
              {file.content && <pre className="content-preview short">{file.content.slice(0, 600)}</pre>}
            </section>
          )}
          <section className="card">
            <div className="card-head">
              <h3>Requisitos de carga</h3>
            </div>
            <ul className="req-list">
              <li>
                <Icon name="check" size={14} /> Formatos: {ALLOWED_EXTENSIONS.slice(0, 9).map((e) => `.${e}`).join(', ')} y más
              </li>
              <li>
                <Icon name="check" size={14} /> Tamaño máximo de {MAX_FILE_MB} MB por archivo
              </li>
              <li>
                <Icon name="check" size={14} /> Título y área obligatorios
              </li>
              <li>
                <Icon name="check" size={14} /> Datos personales requieren nivel Confidencial
              </li>
              <li>
                <Icon name="check" size={14} /> Los archivos .txt, .csv, .md y .json se leen completos para la búsqueda
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
