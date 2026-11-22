/**
 * Parser del formato Markdown strutturato per le card.
 *
 * ## <id>                      ← ogni card inizia con un titolo di livello 2
 * distretto: vie-biliari       ← campi "chiave: valore"
 * argomento: Triangolo di Calot
 * interventi: colecistectomia VLS; VLS di via biliare   (separati da ;)
 * tipo: mcq | multi | flash | ordina | immagine
 * livello: 1 | 2 | 3
 * tag: calot, cvs                                        (separati da ,)
 * immagine: img/calot.svg      (solo tipo immagine)
 * hotspot: 30,40; 55,62        (x,y in % separati da ;)
 * punto: 2                     (numero del punto chiesto, 1-based)
 * verificata: no
 *
 * ### Domanda     testo libero
 * ### Opzioni     "- [x] corretta" / "- [ ] errata"   (mcq, multi, immagine)
 * ### Ordine      elenco nell'ordine corretto (ordina; l'app lo mescola)
 * ### Risposta    testo (flash)
 * ### Spiegazione / ### Perla
 * ### Fonte       "Testo | riferimento"
 */

export interface MdParseResult {
  items: unknown[];
  /** Errori strutturali (blocchi che non è stato possibile leggere). */
  errors: { index: number; id?: string; reasons: string[] }[];
}

const KEY_ALIASES: Record<string, string> = {
  distretto: 'distretto',
  argomento: 'argomento',
  interventi: 'interventi',
  intervento: 'interventi',
  tipo: 'tipo',
  livello: 'livello',
  tag: 'tag',
  tags: 'tag',
  immagine: 'immagine',
  hotspot: 'hotspot',
  punto: 'punto',
  verificata: 'verificata',
};

const split = (s: string, sep: string) =>
  s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

export function parseMarkdownCards(text: string): MdParseResult {
  const items: unknown[] = [];
  const errors: MdParseResult['errors'] = [];
  const blocks = text.replace(/\r\n?/g, '\n').split(/^##(?!#)\s*/m).slice(1);

  blocks.forEach((block, index) => {
    const lines = block.split('\n');
    const id = lines[0].trim();
    const fields: Record<string, string> = {};
    const sections: Record<string, string[]> = {};
    let current: string | null = null;
    const reasons: string[] = [];

    for (const raw of lines.slice(1)) {
      const line = raw.trimEnd();
      const h = line.match(/^###\s*(.+)$/);
      if (h) {
        current = h[1].trim().toLowerCase();
        sections[current] = [];
        continue;
      }
      if (current) {
        sections[current].push(line);
        continue;
      }
      if (!line.trim() || line.trim() === '---') continue;
      const kv = line.match(/^([A-Za-zàèéìòù]+)\s*:\s*(.*)$/);
      if (kv && KEY_ALIASES[kv[1].toLowerCase()]) fields[KEY_ALIASES[kv[1].toLowerCase()]] = kv[2].trim();
      else reasons.push(`riga non riconosciuta: "${line.trim()}"`);
    }

    const sec = (name: string) =>
      (sections[name] ?? [])
        .join('\n')
        .replace(/\n---\s*$/, '')
        .trim();

    const card: Record<string, unknown> = {
      id,
      distretto: fields.distretto,
      argomento: fields.argomento,
      interventi: fields.interventi ? split(fields.interventi, ';') : [],
      tipo: fields.tipo,
      livello: fields.livello ? Number(fields.livello) : undefined,
      domanda: sec('domanda'),
      spiegazione: sec('spiegazione'),
      tag: fields.tag ? split(fields.tag, ',') : [],
      verificata: /^(s[iì]|true|1)$/i.test(fields.verificata ?? ''),
    };
    const perla = sec('perla');
    if (perla) card.perla = perla;

    const fonte = sec('fonte');
    if (fonte) {
      const [t, ...r] = fonte.split('|');
      card.fonte = { testo: t.trim(), riferimento: r.join('|').trim() };
    }

    const listItems = (name: string) =>
      (sections[name] ?? []).map((l) => l.trim()).filter((l) => /^(-|\*|\d+[.)])\s+/.test(l));

    if (fields.tipo === 'flash') {
      card.corrette = sec('risposta');
    } else if (fields.tipo === 'ordina') {
      const ord = listItems('ordine').map((l) => l.replace(/^(-|\*|\d+[.)])\s+/, ''));
      card.opzioni = ord;
      card.corrette = ord.map((_, i) => i);
    } else {
      const opts = listItems('opzioni');
      card.opzioni = opts.map((l) => l.replace(/^(-|\*)\s+\[[ xX]\]\s*/, '').replace(/^(-|\*)\s+/, ''));
      card.corrette = opts.flatMap((l, i) => (/^(-|\*)\s+\[[xX]\]/.test(l) ? [i] : []));
      if (opts.length && !opts.some((l) => /^(-|\*)\s+\[[ xX]\]/.test(l)))
        reasons.push('opzioni: segna le corrette con "- [x]" e le errate con "- [ ]"');
    }

    if (fields.immagine) {
      const hotspot = fields.hotspot
        ? split(fields.hotspot, ';').map((p) => {
            const [x, y] = p.split(',').map((n) => Number(n.trim()));
            return { x, y };
          })
        : [];
      const img: Record<string, unknown> = { src: fields.immagine, hotspot };
      if (fields.punto) img.target = Number(fields.punto) - 1;
      card.immagine = img;
    }

    if (!id) reasons.push('manca l\'id dopo "##"');
    if (reasons.length) errors.push({ index, id: id || undefined, reasons });
    else items.push(card);
  });

  return { items, errors };
}

/** Converte una card in Markdown (usato per l'esempio nel README e per esportare). */
export function cardToMarkdown(c: {
  id: string;
  distretto: string;
  argomento: string;
  interventi: string[];
  tipo: string;
  livello: number;
  domanda: string;
  opzioni?: string[];
  corrette: number[] | string;
  spiegazione: string;
  perla?: string;
  fonte: { testo: string; riferimento: string };
  tag: string[];
}): string {
  const out = [
    `## ${c.id}`,
    `distretto: ${c.distretto}`,
    `argomento: ${c.argomento}`,
    `interventi: ${c.interventi.join('; ')}`,
    `tipo: ${c.tipo}`,
    `livello: ${c.livello}`,
    `tag: ${c.tag.join(', ')}`,
    '',
    '### Domanda',
    c.domanda,
    '',
  ];
  if (c.tipo === 'flash') out.push('### Risposta', String(c.corrette), '');
  else if (c.tipo === 'ordina' && Array.isArray(c.corrette))
    out.push('### Ordine', ...c.corrette.map((i, n) => `${n + 1}. ${c.opzioni![i]}`), '');
  else if (Array.isArray(c.corrette))
    out.push('### Opzioni', ...(c.opzioni ?? []).map((o, i) => `- [${(c.corrette as number[]).includes(i) ? 'x' : ' '}] ${o}`), '');
  out.push('### Spiegazione', c.spiegazione, '');
  if (c.perla) out.push('### Perla', c.perla, '');
  out.push('### Fonte', `${c.fonte.testo} | ${c.fonte.riferimento}`, '');
  return out.join('\n');
}
