import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db, type ImageRow } from './db';
import { loadAll } from './repo';

export type AppData = Awaited<ReturnType<typeof loadAll>> & { images: ImageRow[] };

/** Dati dell'app aggiornati in automatico a ogni modifica di IndexedDB. */
export function useData(): AppData | null {
  const [data, setData] = useState<AppData | null>(null);
  useEffect(() => {
    const sub = liveQuery(async () => ({ ...(await loadAll()), images: await db.images.toArray() })).subscribe({
      next: setData,
      error: (e) => console.error(e),
    });
    return () => sub.unsubscribe();
  }, []);
  return data;
}

export function resolveSrc(src: string, images: { id: string; dataUrl: string }[]): string {
  if (src.startsWith('idb:')) return images.find((i) => i.id === src.slice(4))?.dataUrl ?? '';
  if (/^(data:|https?:|blob:)/.test(src)) return src;
  return import.meta.env.BASE_URL + src.replace(/^\//, '');
}
