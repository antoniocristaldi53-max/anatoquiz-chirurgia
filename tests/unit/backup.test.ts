import { describe, expect, it } from 'vitest';
import { AnatoDB, saveSettings, setMeta } from '../../src/lib/db';
import { exportBackup, restoreBackup, wipeAll } from '../../src/lib/backup';
import { importCards, parseImportText } from '../../src/lib/importer';
import { recordReview } from '../../src/lib/repo';
import { CardSchema } from '../../src/lib/schema';
import { mcq } from './fixtures';

const snapshot = async (d: AnatoDB) => ({
  cards: await d.cards.orderBy('id').toArray(),
  states: await d.states.orderBy('cardId').toArray(),
  reviews: await d.reviews.orderBy('id').toArray(),
  images: await d.images.toArray(),
  meta: await d.meta.orderBy('key').toArray(),
});

describe('backup', () => {
  it('export → cancella → reimport: progressi e card identici', async () => {
    const d = new AnatoDB(`b-${Math.random()}`);
    await importCards([mcq('bk-0001'), mcq('bk-0002'), mcq('bk-0003')], [], d);
    const c1 = CardSchema.parse(mcq('bk-0001'));
    const c2 = CardSchema.parse(mcq('bk-0002'));
    const t = new Date('2026-11-01T08:00:00Z');
    await recordReview({ card: c1, voto: 3, correct: true, ms: 4200, mode: 'giorno', schedula: true, now: t }, d);
    await recordReview({ card: c1, voto: 1, correct: false, ms: 3100, mode: 'giorno', schedula: true, now: new Date(+t + 6e5) }, d);
    await recordReview({ card: c2, voto: 4, correct: true, ms: 2500, mode: 'flash', schedula: true, now: t }, d);
    await d.images.add({ id: 'img-1', name: 'schema.jpg', dataUrl: 'data:image/jpeg;base64,AAAA', createdAt: 1 });
    await saveSettings({ newPerDay: 15 }, d);
    await setMeta('discarded', ['vecchia-0001'], d);

    const before = await snapshot(d);
    const json = JSON.stringify(await exportBackup(d));

    await wipeAll(d);
    expect(await d.cards.count()).toBe(0);

    const parsed = parseImportText(json, 'backup.json');
    expect(parsed.kind).toBe('backup');
    if (parsed.kind !== 'backup') return;
    await restoreBackup(parsed.backup, d);

    const after = await snapshot(d);
    expect(after).toEqual(before);
    expect(typeof after.states[0].due).toBe('number');
  });

  it('rifiuta un backup con card non valide senza toccare i dati', async () => {
    const d = new AnatoDB(`b-${Math.random()}`);
    await importCards([mcq('ok-0001')], [], d);
    const b = await exportBackup(d);
    b.cards.push({ ...b.cards[0], id: 'rotta', livello: 7 as 1 });
    await expect(restoreBackup(b, d)).rejects.toThrow(/non valide/);
    expect(await d.cards.count()).toBe(1);
  });
});
