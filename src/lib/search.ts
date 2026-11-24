import type { DocStatus, DocType, DocumentItem } from '../types';
import { normalizeAligned, normalizeText } from './utils';

const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'en', 'con', 'para', 'por', 'del', 'que', 'a', 'al', 'un', 'una', 'unos', 'unas',
  'se', 'su', 'sus', 'o', 'documento', 'documentos', 'todos', 'todas', 'sobre',
]);

const TYPE_KEYWORDS: [string, DocType][] = [
  ['contrato', 'Contrato'],
  ['acuerdo', 'Contrato'],
  ['convenio', 'Contrato'],
  ['factura', 'Factura'],
  ['informe', 'Informe'],
  ['reporte', 'Informe'],
  ['politica', 'Política'],
  ['procedimiento', 'Política'],
  ['acta', 'Acta'],
  ['legajo', 'Legajo'],
];

const STATUS_KEYWORDS: [string, DocStatus[]][] = [
  ['pendiente', ['En revisión', 'Borrador']],
  ['aprobad', ['Aprobado']],
  ['vigent', ['Aprobado']],
  ['rechazad', ['Rechazado']],
  ['archivad', ['Archivado']],
  ['borrador', ['Borrador']],
];

export const SUGGESTED_SEARCHES = [
  'contratos que vencen en 2026',
  'facturas pendientes',
  'políticas de seguridad',
  'proveedor Contoso',
  'actas de directorio',
  'legajos confidenciales',
  'documentos rechazados',
  'auditoría de pagos',
];

export interface ParsedQuery {
  terms: string[];
  stems: string[];
  types: DocType[];
  statuses: DocStatus[];
}

export interface SearchHit {
  doc: DocumentItem;
  score: number;
  relevance: number;
  matchedIn: string[];
  snippet: string;
}

export interface SearchOutcome {
  parsed: ParsedQuery;
  hits: SearchHit[];
  partial: boolean;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 || /\d/.test(t));
}

function stem(term: string): string {
  return term.length > 5 ? term.slice(0, term.length - 2) : term;
}

export function parseQuery(query: string): ParsedQuery {
  const types = new Set<DocType>();
  const statuses = new Set<DocStatus>();
  const terms: string[] = [];
  for (const token of tokenize(query)) {
    if (STOPWORDS.has(token)) continue;
    const typeMatch = TYPE_KEYWORDS.find(([k]) => token.startsWith(k));
    if (typeMatch) {
      types.add(typeMatch[1]);
      continue;
    }
    const statusMatch = STATUS_KEYWORDS.find(([k]) => token.startsWith(k));
    if (statusMatch) {
      statusMatch[1].forEach((s) => statuses.add(s));
      continue;
    }
    terms.push(token);
  }
  return { terms, stems: terms.map(stem), types: [...types], statuses: [...statuses] };
}

export function buildSnippet(text: string, stems: string[], radius = 110): string {
  if (!text) return '';
  const norm = normalizeAligned(text);
  let index = -1;
  for (const s of stems) {
    const i = norm.indexOf(s);
    if (i >= 0 && (index < 0 || i < index)) index = i;
  }
  if (index < 0) return text.length > radius * 2 ? `${text.slice(0, radius * 2).trim()}…` : text;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

interface IndexedField {
  label: string;
  tokens: string[];
  weight: number;
}

function indexDocument(doc: DocumentItem): IndexedField[] {
  return [
    { label: 'título', tokens: tokenize(doc.title), weight: 5 },
    { label: 'código', tokens: tokenize(`${doc.code} ${doc.fileName}`), weight: 4 },
    { label: 'etiquetas', tokens: tokenize(doc.tags.join(' ')), weight: 3 },
    { label: 'datos extraídos', tokens: tokenize(doc.fields.map((f) => `${f.label} ${f.value}`).join(' ')), weight: 3 },
    { label: 'metadatos', tokens: tokenize(`${doc.area} ${doc.owner} ${doc.confidentiality}`), weight: 2 },
    { label: 'resumen', tokens: tokenize(doc.summary), weight: 2 },
    { label: 'contenido', tokens: tokenize(doc.content), weight: 1 },
  ];
}

export function searchDocuments(documents: DocumentItem[], query: string): SearchOutcome {
  const parsed = parseQuery(query);
  if (!query.trim()) return { parsed, hits: [], partial: false };

  const pool = documents.filter(
    (d) => (!parsed.types.length || parsed.types.includes(d.type)) && (!parsed.statuses.length || parsed.statuses.includes(d.status)),
  );

  if (!parsed.stems.length) {
    const hits = pool
      .map((doc) => ({ doc, score: 1, relevance: 95, matchedIn: ['filtros inteligentes'], snippet: doc.summary }))
      .sort((a, b) => b.doc.updatedAt.localeCompare(a.doc.updatedAt));
    return { parsed, hits, partial: false };
  }

  const scored = pool
    .map((doc) => {
      const fields = indexDocument(doc);
      const matchedIn = new Set<string>();
      let score = 0;
      let matched = 0;
      for (const s of parsed.stems) {
        let best = 0;
        for (const f of fields) {
          if (f.tokens.some((t) => t.startsWith(s))) {
            matchedIn.add(f.label);
            best = Math.max(best, f.weight);
          }
        }
        if (best > 0) matched++;
        score += best;
      }
      const relevance = Math.round(Math.min(99, 35 + (score / (parsed.stems.length * 5)) * 64));
      const source = buildSnippet(doc.content, parsed.stems) || doc.summary;
      return { doc, score, matched, relevance, matchedIn: [...matchedIn], snippet: source };
    })
    .filter((h) => h.matched > 0);

  const full = scored.filter((h) => h.matched === parsed.stems.length);
  const list = full.length ? full : scored;
  list.sort((a, b) => b.matched - a.matched || b.score - a.score || b.doc.updatedAt.localeCompare(a.doc.updatedAt));
  return {
    parsed,
    hits: list.map(({ doc, score, relevance, matchedIn, snippet }) => ({ doc, score, relevance, matchedIn, snippet })),
    partial: !full.length && scored.length > 0,
  };
}
