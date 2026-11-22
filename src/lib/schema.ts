import { z } from 'zod';

/** Tassonomia dei distretti di anatomia chirurgica (ordine = ordine di visualizzazione). */
export const DISTRETTI = [
  { id: 'collo', nome: 'Collo', breve: 'Collo' },
  { id: 'parete', nome: 'Parete addominale e regione inguino-crurale', breve: 'Parete/inguine' },
  { id: 'esofago', nome: 'Esofago, giunzione EG, iato, vaghi', breve: 'Esofago/iato' },
  { id: 'stomaco', nome: 'Stomaco e duodeno', breve: 'Stomaco/duodeno' },
  { id: 'fegato', nome: 'Fegato', breve: 'Fegato' },
  { id: 'vie-biliari', nome: 'Vie biliari e colecisti', breve: 'Vie biliari' },
  { id: 'pancreas', nome: 'Pancreas e regione duodeno-pancreatica', breve: 'Pancreas' },
  { id: 'milza', nome: 'Milza', breve: 'Milza' },
  { id: 'tenue', nome: 'Intestino tenue e mesentere', breve: 'Tenue/mesentere' },
  { id: 'colon-retto', nome: 'Colon e retto', breve: 'Colon/retto' },
  { id: 'ano-pelvi', nome: 'Ano e pavimento pelvico', breve: 'Ano/pelvi' },
  { id: 'retroperitoneo', nome: 'Retroperitoneo, surreni, grandi vasi, uretere', breve: 'Retroperitoneo' },
  { id: 'mammella', nome: 'Mammella e cavo ascellare', breve: 'Mammella/ascella' },
  { id: 'vascolare', nome: 'Anatomia vascolare periferica', breve: 'Vascolare' },
  { id: 'laparoscopia', nome: 'Anatomia laparoscopica', breve: 'Laparoscopia' },
] as const;

export type DistrettoId = (typeof DISTRETTI)[number]['id'];
export const DISTRETTO_IDS = DISTRETTI.map((d) => d.id) as [DistrettoId, ...DistrettoId[]];
export const nomeDistretto = (id: string) => DISTRETTI.find((d) => d.id === id)?.nome ?? id;
export const breveDistretto = (id: string) => DISTRETTI.find((d) => d.id === id)?.breve ?? id;

export const TIPI = ['mcq', 'multi', 'flash', 'ordina', 'immagine'] as const;
export type Tipo = (typeof TIPI)[number];
export const NOMI_TIPO: Record<Tipo, string> = {
  mcq: 'Scelta multipla',
  multi: 'Risposta multipla',
  flash: 'Flashcard',
  ordina: 'Ordinamento',
  immagine: 'Immagine',
};

const nonVuota = (campo: string) => z.string().trim().min(1, { error: `${campo} vuoto` });

export const HotspotSchema = z.object({
  x: z.number().min(0, { error: 'x fuori da 0–100' }).max(100, { error: 'x fuori da 0–100' }),
  y: z.number().min(0, { error: 'y fuori da 0–100' }).max(100, { error: 'y fuori da 0–100' }),
});

export const CardSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*$/, { error: 'id: solo minuscole, numeri e trattini (es. "fegato-0012")' }),
    distretto: z.enum(DISTRETTO_IDS, { error: `distretto non valido (ammessi: ${DISTRETTO_IDS.join(', ')})` }),
    argomento: nonVuota('argomento'),
    interventi: z.array(nonVuota('intervento')).default([]),
    tipo: z.enum(TIPI, { error: `tipo non valido (ammessi: ${TIPI.join(', ')})` }),
    livello: z.union([z.literal(1), z.literal(2), z.literal(3)], { error: 'livello deve essere 1, 2 o 3' }),
    domanda: nonVuota('domanda'),
    opzioni: z.array(nonVuota('opzione')).optional(),
    corrette: z.union([z.array(z.number().int().nonnegative()), z.string()], {
      error: 'corrette deve essere un elenco di indici o un testo',
    }),
    spiegazione: nonVuota('spiegazione'),
    perla: z.string().optional(),
    fonte: z.object(
      { testo: nonVuota('fonte.testo'), riferimento: nonVuota('fonte.riferimento') },
      { error: 'fonte mancante: serve { testo, riferimento }' },
    ),
    immagine: z
      .object({
        src: nonVuota('immagine.src'),
        hotspot: z.array(HotspotSchema).optional(),
        /** Indice (0-based) del punto chiesto nella domanda. */
        target: z.number().int().nonnegative().optional(),
      })
      .optional(),
    tag: z.array(z.string()).default([]),
    verificata: z.boolean().default(false),
  })
  .superRefine((c, ctx) => {
    const err = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] });
    const n = c.opzioni?.length ?? 0;
    const idx = Array.isArray(c.corrette) ? c.corrette : null;
    const fuori = idx?.some((i) => i >= n);

    if (c.tipo === 'flash') {
      if (typeof c.corrette !== 'string' || !c.corrette.trim()) err('flash: "corrette" deve essere il testo della risposta', 'corrette');
      return;
    }
    if (n < 2) return err(`${c.tipo}: servono almeno 2 opzioni`, 'opzioni');
    if (!idx) return err(`${c.tipo}: "corrette" deve essere un elenco di indici (0-based)`, 'corrette');
    if (fuori) err(`indice in "corrette" oltre il numero di opzioni (${n})`, 'corrette');
    if (new Set(idx).size !== idx.length) err('indici duplicati in "corrette"', 'corrette');
    if (new Set(c.opzioni!.map((o) => o.trim().toLowerCase())).size !== n) err('opzioni duplicate', 'opzioni');

    switch (c.tipo) {
      case 'mcq':
        if (idx.length !== 1) err('mcq: serve esattamente 1 risposta corretta', 'corrette');
        break;
      case 'multi':
        if (idx.length < 1) err('multi: serve almeno 1 risposta corretta', 'corrette');
        break;
      case 'ordina':
        if (idx.length !== n) err('ordina: "corrette" deve contenere tutti gli indici delle opzioni nell\'ordine giusto', 'corrette');
        break;
      case 'immagine': {
        if (idx.length !== 1) err('immagine: serve esattamente 1 risposta corretta', 'corrette');
        const hs = c.immagine?.hotspot ?? [];
        if (!c.immagine) err('immagine: manca il campo "immagine"', 'immagine');
        else if (hs.length < 1) err('immagine: serve almeno 1 hotspot', 'immagine');
        else if (c.immagine.target !== undefined && c.immagine.target >= hs.length)
          err('immagine.target oltre il numero di hotspot', 'immagine');
        break;
      }
    }
  });

export type CardT = z.output<typeof CardSchema>;
export type CardInputT = z.input<typeof CardSchema>;

/** Formatta gli errori di Zod in frasi leggibili. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.join('.');
    const msg = i.message;
    return path && !msg.startsWith(path.split('.')[0]) ? `${path}: ${msg}` : msg;
  });
}

export function validateCard(raw: unknown): { ok: true; card: CardT } | { ok: false; errors: string[] } {
  const r = CardSchema.safeParse(raw);
  return r.success ? { ok: true, card: r.data } : { ok: false, errors: formatIssues(r.error) };
}
