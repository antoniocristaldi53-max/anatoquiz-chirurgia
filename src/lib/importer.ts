import { db as defaultDb, getDiscarded, setMeta, type AnatoDB } from './db';
import { parseMarkdownCards } from './markdown';
import { validateCard, type CardT } from './schema';
import { isBackup, type Backup } from './backup';

export interface ImportError {
  /** Posizione della card nel file (1-based). */
  posizione: number;
  id?: string;
  motivi: string[];
}

export interface ImportReport {
  aggiunte: string[];
  duplicate: string[];
  errori: ImportError[];
}

export type ParsedFile =
  | { kind: 'cards'; items: unknown[]; preErrors: ImportError[] }
  | { kind: 'backup'; backup: Backup };

/** Riconosce il contenuto di un file: backup completo, array/oggetto JSON di card, o Markdown. */
export function parseImportText(text: string, filename = ''): ParsedFile {
  const trimmed = text.trim();
  const looksJson = /\.json$/i.test(filename) || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (looksJson) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      return {
        kind: 'cards',
        items: [],
        preErrors: [{ posizione: 0, motivi: [`JSON non valido: ${(e as Error).message}`] }],
      };
    }
    if (isBackup(data)) return { kind: 'backup', backup: data };
    const items = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && Array.isArray((data as { cards?: unknown }).cards)
        ? (data as { cards: unknown[] }).cards
        : [data];
    return { kind: 'cards', items, preErrors: [] };
  }
  const md = parseMarkdownCards(text);
  return {
    kind: 'cards',
    items: md.items,
    preErrors: md.errors.map((e) => ({ posizione: e.index + 1, id: e.id, motivi: e.reasons })),
  };
}

export function validateCards(items: unknown[]): { valid: CardT[]; errors: ImportError[] } {
  const valid: CardT[] = [];
  const errors: ImportError[] = [];
  items.forEach((raw, i) => {
    const r = validateCard(raw);
    if (r.ok) valid.push(r.card);
    else {
      const id = raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string' ? (raw as { id: string }).id : undefined;
      errors.push({ posizione: i + 1, id, motivi: r.errors });
    }
  });
  return { valid, errors };
}

/** Valida e aggiunge le card nuove; le card con id già presente vengono saltate (nessun duplicato). */
export async function importCards(items: unknown[], preErrors: ImportError[] = [], d: AnatoDB = defaultDb): Promise<ImportReport> {
  const { valid, errors } = validateCards(items);
  const existing = new Set(await d.cards.toCollection().primaryKeys());
  const seen = new Set<string>();
  const toAdd: CardT[] = [];
  const duplicate: string[] = [];
  for (const c of valid) {
    if (existing.has(c.id) || seen.has(c.id)) duplicate.push(c.id);
    else {
      seen.add(c.id);
      toAdd.push(c);
    }
  }
  await d.transaction('rw', d.cards, d.meta, async () => {
    await d.cards.bulkAdd(toAdd);
    // Importare esplicitamente una card scartata la "riabilita".
    const discarded = await getDiscarded(d);
    if (toAdd.some((c) => discarded.includes(c.id)))
      await setMeta('discarded', discarded.filter((id) => !seen.has(id)), d);
  });
  return { aggiunte: toAdd.map((c) => c.id), duplicate, errori: [...preErrors, ...errors] };
}
