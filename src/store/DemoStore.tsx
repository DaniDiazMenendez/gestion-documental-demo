import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createSeedState, STATE_VERSION, SYSTEM_USER } from '../data/seed';
import { simulateValidation, toValidationInput } from '../lib/validation';
import { uid } from '../lib/utils';
import type {
  ActivityAction,
  ActivityEntry,
  ActivityResult,
  DemoState,
  DocStatus,
  DocumentItem,
  ValidationResult,
} from '../types';

const STORAGE_KEY = 'gestion-documental-demo:state';
const MAX_ACTIVITY = 600;

export const CURRENT_USER = { name: 'María González', role: 'Analista documental' };

export type NewDocumentDraft = Omit<DocumentItem, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'version' | 'comments'>;

export interface LogInput {
  action: ActivityAction;
  detail: string;
  documentId?: string | null;
  documentCode?: string | null;
  result?: ActivityResult;
  user?: string;
}

interface DemoStoreValue {
  documents: DocumentItem[];
  activity: ActivityEntry[];
  recentSearches: string[];
  addDocument: (draft: NewDocumentDraft) => DocumentItem;
  changeStatus: (ids: string[], status: DocStatus, comment?: string) => number;
  runValidation: (id: string) => ValidationResult | null;
  addComment: (id: string, text: string) => void;
  logActivity: (input: LogInput) => void;
  recordSearch: (query: string, resultCount: number) => void;
  generateActivity: (count?: number) => number;
  resetDemo: () => void;
}

const DemoStoreContext = createContext<DemoStoreValue | null>(null);

function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed && parsed.version === STATE_VERSION && Array.isArray(parsed.documents) && Array.isArray(parsed.activity)) {
        return { ...parsed, recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : [] };
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return createSeedState();
}

function makeEntry(input: LogInput, timestamp = new Date().toISOString()): ActivityEntry {
  return {
    id: uid('act'),
    timestamp,
    user: input.user ?? CURRENT_USER.name,
    action: input.action,
    documentId: input.documentId ?? null,
    documentCode: input.documentCode ?? null,
    detail: input.detail,
    result: input.result ?? 'Éxito',
  };
}

function prepend(activity: ActivityEntry[], entries: ActivityEntry[]): ActivityEntry[] {
  return [...entries, ...activity].slice(0, MAX_ACTIVITY);
}

const SIM_USERS = ['Lucía Fernández', 'Javier Méndez', 'Sofía Herrera', 'Diego Romero', 'Carolina Ruiz'];
const SIM_SEARCHES = ['contratos vigentes', 'facturas octubre', 'proveedor Northwind', 'actas 2026', 'política de retención', 'auditoría'];

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // El almacenamiento puede estar lleno o deshabilitado; la demo sigue funcionando en memoria.
    }
  }, [state]);

  const logActivity = useCallback((input: LogInput) => {
    const entry = makeEntry(input);
    setState((prev) => ({ ...prev, activity: prepend(prev.activity, [entry]) }));
  }, []);

  const addDocument = useCallback((draft: NewDocumentDraft) => {
    const now = new Date().toISOString();
    const maxCode = stateRef.current.documents.reduce((max, d) => {
      const num = Number.parseInt(d.code.split('-')[2] ?? '0', 10);
      return Number.isFinite(num) ? Math.max(max, num) : max;
    }, 100);
    const doc: DocumentItem = {
      ...draft,
      id: uid('doc'),
      code: `GD-${new Date().getFullYear()}-${String(maxCode + 1).padStart(4, '0')}`,
      createdAt: now,
      updatedAt: now,
      version: 1,
      comments: [],
    };
    const entries: ActivityEntry[] = [];
    if (doc.validation) {
      const warn = doc.validation.checks.some((c) => c.status !== 'ok');
      entries.push(
        makeEntry({
          user: SYSTEM_USER,
          action: 'Validación',
          documentId: doc.id,
          documentCode: doc.code,
          detail: `Validación automática · puntaje ${doc.validation.score}/100`,
          result: warn ? 'Advertencia' : 'Éxito',
        }),
      );
    }
    entries.push(makeEntry({ action: 'Carga', documentId: doc.id, documentCode: doc.code, detail: `Carga del archivo "${doc.fileName}"` }));
    setState((prev) => ({ ...prev, documents: [doc, ...prev.documents], activity: prepend(prev.activity, entries) }));
    return doc;
  }, []);

  const changeStatus = useCallback((ids: string[], status: DocStatus, comment?: string) => {
    const targets = stateRef.current.documents.filter((d) => ids.includes(d.id) && d.status !== status);
    if (!targets.length) return 0;
    const now = new Date().toISOString();
    const reason = comment?.trim();
    const entries = targets.map((d) =>
      makeEntry({
        action: 'Cambio de estado',
        documentId: d.id,
        documentCode: d.code,
        detail: `${d.status} → ${status}${reason ? `. Motivo: ${reason}` : ''}`,
        result: status === 'Rechazado' ? 'Advertencia' : 'Éxito',
      }),
    );
    const targetIds = new Set(targets.map((t) => t.id));
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        targetIds.has(d.id)
          ? {
              ...d,
              status,
              updatedAt: now,
              version: status === 'Aprobado' && d.status !== 'Archivado' ? d.version + 1 : d.version,
              comments: reason ? [...d.comments, { id: uid('c'), author: CURRENT_USER.name, date: now, text: reason }] : d.comments,
            }
          : d,
      ),
      activity: prepend(prev.activity, entries),
    }));
    return targets.length;
  }, []);

  const runValidation = useCallback((id: string) => {
    const doc = stateRef.current.documents.find((d) => d.id === id);
    if (!doc) return null;
    const others = stateRef.current.documents.filter((d) => d.id !== id).map((d) => d.title);
    const result = simulateValidation(toValidationInput(doc), others);
    const errors = result.checks.some((c) => c.status === 'error');
    const warnings = result.checks.some((c) => c.status === 'warning');
    const entry = makeEntry({
      user: SYSTEM_USER,
      action: 'Validación',
      documentId: doc.id,
      documentCode: doc.code,
      detail: `Validación solicitada por ${CURRENT_USER.name} · puntaje ${result.score}/100`,
      result: errors ? 'Error' : warnings ? 'Advertencia' : 'Éxito',
    });
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) => (d.id === id ? { ...d, validation: result, updatedAt: result.executedAt } : d)),
      activity: prepend(prev.activity, [entry]),
    }));
    return result;
  }, []);

  const addComment = useCallback((id: string, text: string) => {
    const doc = stateRef.current.documents.find((d) => d.id === id);
    const clean = text.trim();
    if (!doc || !clean) return;
    const now = new Date().toISOString();
    const entry = makeEntry({ action: 'Comentario', documentId: doc.id, documentCode: doc.code, detail: `Comentario: ${clean}` }, now);
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === id ? { ...d, comments: [...d.comments, { id: uid('c'), author: CURRENT_USER.name, date: now, text: clean }] } : d,
      ),
      activity: prepend(prev.activity, [entry]),
    }));
  }, []);

  const recordSearch = useCallback((query: string, resultCount: number) => {
    const q = query.trim();
    if (!q) return;
    const entry = makeEntry({ action: 'Búsqueda', detail: `"${q}" · ${resultCount} ${resultCount === 1 ? 'resultado' : 'resultados'}` });
    setState((prev) => ({
      ...prev,
      recentSearches: [q, ...prev.recentSearches.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 6),
      activity: prepend(prev.activity, [entry]),
    }));
  }, []);

  const generateActivity = useCallback((count = 6) => {
    const docs = stateRef.current.documents;
    const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const entries: ActivityEntry[] = [];
    for (let i = 0; i < count; i++) {
      const user = rand(SIM_USERS);
      const doc = rand(docs);
      const timestamp = new Date(Date.now() - Math.floor(Math.random() * 90) * 60000).toISOString();
      const kind = Math.floor(Math.random() * 5);
      let input: LogInput;
      if (kind === 0 || !doc) {
        const failed = Math.random() < 0.25;
        input = { user, action: 'Inicio de sesión', detail: failed ? 'Intento de acceso fallido: credenciales inválidas' : 'Inicio de sesión con Microsoft Entra ID (MFA)', result: failed ? 'Error' : 'Éxito' };
      } else if (kind === 1) {
        input = { user, action: 'Búsqueda', detail: `"${rand(SIM_SEARCHES)}" · ${1 + Math.floor(Math.random() * 6)} resultados` };
      } else if (kind === 2) {
        input = { user, action: 'Descarga', documentId: doc.id, documentCode: doc.code, detail: 'Descarga de la ficha del documento' };
      } else if (kind === 3 && doc.confidentiality === 'Confidencial') {
        input = { user, action: 'Consulta', documentId: doc.id, documentCode: doc.code, detail: 'Acceso a documento confidencial fuera del área asignada', result: 'Advertencia' };
      } else {
        input = { user, action: 'Consulta', documentId: doc.id, documentCode: doc.code, detail: 'Consulta del documento' };
      }
      entries.push(makeEntry(input, timestamp));
    }
    setState((prev) => ({
      ...prev,
      activity: [...entries, ...prev.activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, MAX_ACTIVITY),
    }));
    return entries.length;
  }, []);

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(createSeedState());
  }, []);

  const value = useMemo<DemoStoreValue>(
    () => ({
      documents: state.documents,
      activity: state.activity,
      recentSearches: state.recentSearches,
      addDocument,
      changeStatus,
      runValidation,
      addComment,
      logActivity,
      recordSearch,
      generateActivity,
      resetDemo,
    }),
    [state, addDocument, changeStatus, runValidation, addComment, logActivity, recordSearch, generateActivity, resetDemo],
  );

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore(): DemoStoreValue {
  const ctx = useContext(DemoStoreContext);
  if (!ctx) throw new Error('useDemoStore debe usarse dentro de DemoStoreProvider');
  return ctx;
}
