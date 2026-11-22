import { db as defaultDb, type AnatoDB, type ImageRow, type MetaRow, type ReviewRow, type StoredState } from './db';
import { validateCard, type CardT } from './schema';

export const BACKUP_APP = 'anatoquiz-chirurgia';
export const BACKUP_SCHEMA = 1;

type SerializedState = Omit<StoredState, 'due' | 'last_review'> & { due: string; last_review?: string };

export interface Backup {
  app: typeof BACKUP_APP;
  schema: number;
  exportedAt: string;
  cards: CardT[];
  states: SerializedState[];
  reviews: ReviewRow[];
  images: ImageRow[];
  meta: MetaRow[];
}

export function isBackup(x: unknown): x is Backup {
  return !!x && typeof x === 'object' && (x as { app?: unknown }).app === BACKUP_APP;
}

export async function exportBackup(d: AnatoDB = defaultDb): Promise<Backup> {
  const [cards, states, reviews, images, meta] = await Promise.all([
    d.cards.toArray(),
    d.states.toArray(),
    d.reviews.toArray(),
    d.images.toArray(),
    d.meta.toArray(),
  ]);
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    cards,
    states: states.map((s) => ({
      ...s,
      due: new Date(s.due).toISOString(),
      last_review: s.last_review != null ? new Date(s.last_review).toISOString() : undefined,
    })),
    reviews,
    images,
    meta,
  };
}

const reviveState = (s: SerializedState): StoredState => {
  const { last_review, ...rest } = s;
  const out: StoredState = { ...rest, due: Date.parse(s.due) };
  if (last_review) out.last_review = Date.parse(last_review);
  return out;
};

/** Sostituisce TUTTI i dati locali con quelli del backup. Le card non valide vengono rifiutate prima di toccare il DB. */
export async function restoreBackup(data: Backup, d: AnatoDB = defaultDb): Promise<{ cards: number; reviews: number }> {
  if (!isBackup(data)) throw new Error('Il file non è un backup di AnatoQuiz');
  if (data.schema > BACKUP_SCHEMA) throw new Error('Backup creato da una versione più recente dell\'app');
  const bad = data.cards.map((c) => [c, validateCard(c)] as const).filter(([, r]) => !r.ok);
  if (bad.length) {
    const [c, r] = bad[0];
    throw new Error(`Backup con ${bad.length} card non valide (es. "${(c as CardT).id}": ${!r.ok && r.errors.join('; ')})`);
  }
  await d.transaction('rw', [d.cards, d.states, d.reviews, d.images, d.meta], async () => {
    await Promise.all([d.cards.clear(), d.states.clear(), d.reviews.clear(), d.images.clear(), d.meta.clear()]);
    await d.cards.bulkAdd(data.cards);
    await d.states.bulkAdd(data.states.map(reviveState));
    await d.reviews.bulkAdd(data.reviews);
    await d.images.bulkAdd(data.images ?? []);
    await d.meta.bulkAdd(data.meta ?? []);
  });
  return { cards: data.cards.length, reviews: data.reviews.length };
}

export async function wipeAll(d: AnatoDB = defaultDb) {
  await d.transaction('rw', [d.cards, d.states, d.reviews, d.images, d.meta], async () => {
    await Promise.all([d.cards.clear(), d.states.clear(), d.reviews.clear(), d.images.clear(), d.meta.clear()]);
  });
}

export function backupFilename(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `anatoquiz-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}
