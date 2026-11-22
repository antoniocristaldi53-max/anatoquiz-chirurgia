import Dexie, { type Table } from 'dexie';
import type { Card as FsrsCard } from 'ts-fsrs';
import type { CardT } from './schema';

/** Stato FSRS di una card (assente = card mai vista). */
export interface StateRow extends FsrsCard {
  cardId: string;
  /** Timestamp della prima risposta (per il limite di nuove card al giorno). */
  firstReview: number;
}

export type ModeId = 'giorno' | 'flash' | 'presala' | 'esplora' | 'deboli';

export interface ReviewRow {
  id?: number;
  cardId: string;
  distretto: string;
  ts: number;
  /** 1 Di nuovo, 2 Difficile, 3 Bene, 4 Facile */
  rating: 1 | 2 | 3 | 4;
  correct: boolean;
  ms: number;
  mode: ModeId;
}

export interface ImageRow {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface Settings {
  newPerDay: number;
  includeUnverified: boolean;
  retention: number;
  theme: 'dark' | 'light';
  reminderTime: string;
  badge: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  includeUnverified: true,
  retention: 0.9,
  theme: 'dark',
  reminderTime: '20:30',
  badge: false,
};

export class AnatoDB extends Dexie {
  cards!: Table<CardT, string>;
  states!: Table<StateRow, string>;
  reviews!: Table<ReviewRow, number>;
  images!: Table<ImageRow, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'anatoquiz') {
    super(name);
    this.version(1).stores({
      cards: 'id, distretto, tipo, *interventi',
      states: 'cardId, due',
      reviews: '++id, cardId, ts, distretto',
      images: 'id',
      meta: 'key',
    });
  }
}

export const db = new AnatoDB();

export async function getMeta<T>(key: string, fallback: T, d: AnatoDB = db): Promise<T> {
  const row = await d.meta.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setMeta(key: string, value: unknown, d: AnatoDB = db) {
  await d.meta.put({ key, value });
}

export async function getSettings(d: AnatoDB = db): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getMeta<Partial<Settings>>('settings', {}, d)) };
}

export async function saveSettings(patch: Partial<Settings>, d: AnatoDB = db) {
  const cur = await getSettings(d);
  await setMeta('settings', { ...cur, ...patch }, d);
}

export async function getDiscarded(d: AnatoDB = db): Promise<string[]> {
  return getMeta<string[]>('discarded', [], d);
}

/** Scarta una card: la rimuove con il suo stato e ne ricorda l'id per non reimportarla dal set di base. */
export async function discardCard(id: string, d: AnatoDB = db) {
  await d.transaction('rw', d.cards, d.states, d.meta, async () => {
    await d.cards.delete(id);
    await d.states.delete(id);
    const list = await getDiscarded(d);
    if (!list.includes(id)) await setMeta('discarded', [...list, id], d);
  });
}
