// Set di base: tutti i file JSON in /content vengono inclusi nel bundle (disponibili offline).
const modules = import.meta.glob('../../content/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export const BASE_CARDS: unknown[] = Object.values(modules).flatMap((m) => (Array.isArray(m) ? m : []));
