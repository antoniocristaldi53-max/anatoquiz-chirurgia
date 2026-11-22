import { db as defaultDb, getDiscarded, type AnatoDB } from './db';
import { validateCard, type CardT } from './schema';

/**
 * Aggiunge al DB le card del set di base che mancano (confronto per id).
 * Non sovrascrive mai card già presenti (potresti averle modificate in Revisione)
 * e non reinserisce quelle scartate.
 */
export async function seedCards(base: unknown[], d: AnatoDB = defaultDb) {
  const discarded = new Set(await getDiscarded(d));
  const existing = new Set(await d.cards.toCollection().primaryKeys());
  const toAdd: CardT[] = [];
  const invalid: { id?: string; errors: string[] }[] = [];
  for (const raw of base) {
    const r = validateCard(raw);
    if (!r.ok) {
      invalid.push({ id: (raw as { id?: string })?.id, errors: r.errors });
      continue;
    }
    if (!existing.has(r.card.id) && !discarded.has(r.card.id)) {
      existing.add(r.card.id);
      toAdd.push(r.card);
    }
  }
  if (toAdd.length) await d.cards.bulkAdd(toAdd);
  if (invalid.length) console.warn('Card di base non valide', invalid);
  return { added: toAdd.length, invalid };
}
