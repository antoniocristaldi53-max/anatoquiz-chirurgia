import { useMemo, useState } from 'react';
import { ImageWithHotspots } from '../components/QuizCard';
import { Button, cx, Empty, Field, inputCls, Panel, Pill, Screen } from '../components/ui';
import { db, discardCard, getMeta, setMeta } from '../lib/db';
import { go } from '../lib/router';
import { breveDistretto, DISTRETTI, NOMI_TIPO, validateCard, type CardT } from '../lib/schema';
import { resolveSrc, type AppData } from '../lib/useData';

type Stato = 'da-verificare' | 'verificate' | 'tutte';

const FILTER_KEY = 'revisione-filtri';
const ORD = Object.fromEntries(DISTRETTI.map((d, i) => [d.id, i])) as Record<string, number>;

function useFilters() {
  const [f, setF] = useState<{ distretto: string; stato: Stato; q: string }>(() => {
    try {
      return { distretto: '', stato: 'da-verificare', q: '', ...JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? '{}') };
    } catch {
      return { distretto: '', stato: 'da-verificare', q: '' };
    }
  });
  const set = (patch: Partial<typeof f>) =>
    setF((cur) => {
      const n = { ...cur, ...patch };
      try {
        sessionStorage.setItem(FILTER_KEY, JSON.stringify(n));
      } catch {
        /* storage non disponibile */
      }
      return n;
    });
  return [f, set] as const;
}

export default function Revisione({ data, params }: { data: AppData; params: URLSearchParams }) {
  const [f, setF] = useFilters();
  const id = params.get('id');

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return data.cards
      .filter(
        (c) =>
          (!f.distretto || c.distretto === f.distretto) &&
          (f.stato === 'tutte' || (f.stato === 'verificate' ? c.verificata : !c.verificata)) &&
          (!q || `${c.id} ${c.argomento} ${c.domanda} ${c.tag.join(' ')}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => ORD[a.distretto] - ORD[b.distretto] || a.id.localeCompare(b.id, 'it', { numeric: true }));
  }, [data.cards, f]);

  const card = id ? data.cards.find((c) => c.id === id) : undefined;
  if (id && card) return <Detail card={card} data={data} list={filtered} />;

  const daVerificare = data.cards.filter((c) => !c.verificata && (!f.distretto || c.distretto === f.distretto)).length;

  return (
    <Screen title="Revisione">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Field label="Distretto">
          <select className={inputCls} value={f.distretto} onChange={(e) => setF({ distretto: e.target.value })} data-testid="filtro-distretto">
            <option value="">Tutti</option>
            {DISTRETTI.map((d) => (
              <option key={d.id} value={d.id}>
                {d.breve}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stato">
          <select className={inputCls} value={f.stato} onChange={(e) => setF({ stato: e.target.value as Stato })}>
            <option value="da-verificare">Da verificare</option>
            <option value="verificate">Verificate</option>
            <option value="tutte">Tutte</option>
          </select>
        </Field>
      </div>
      <input className={`${inputCls} mb-3`} placeholder="Cerca per testo, id o tag…" value={f.q} onChange={(e) => setF({ q: e.target.value })} />
      <p className="mb-3 text-sm text-muted">
        {filtered.length} card nel filtro · {daVerificare} da verificare{f.distretto ? ` in ${breveDistretto(f.distretto)}` : ''}
      </p>
      {!filtered.length && <Empty>Nessuna card corrisponde ai filtri.</Empty>}
      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <button
            key={c.id}
            data-testid="riga-revisione"
            onClick={() => go('/revisione', { id: c.id })}
            className="rounded-2xl border border-line bg-surface p-3 text-left"
          >
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs text-muted">{c.id}</span>
              <Pill>{NOMI_TIPO[c.tipo]}</Pill>
              <Pill>L{c.livello}</Pill>
              {c.verificata ? <Pill tone="good">Verificata</Pill> : <Pill tone="warn">Da verificare</Pill>}
            </div>
            <div className="line-clamp-2 font-medium">{c.domanda}</div>
            <div className="text-xs text-muted">{c.argomento}</div>
          </button>
        ))}
      </div>
    </Screen>
  );
}

function Detail({ card, data, list }: { card: CardT; data: AppData; list: CardT[] }) {
  const [editing, setEditing] = useState(false);
  const idx = list.findIndex((c) => c.id === card.id);
  const next = () => {
    const rest = list.filter((c) => c.id !== card.id && !c.verificata);
    const after = rest.find((c) => list.indexOf(c) > idx) ?? rest[0];
    go('/revisione', after ? { id: after.id } : {});
  };

  if (editing) return <CardEditor card={card} images={data.images} onClose={() => setEditing(false)} />;

  const ok = Array.isArray(card.corrette) ? card.corrette : [];
  return (
    <Screen title="Revisione card" back="/revisione">
      <Panel className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-muted">{card.id}</span>
          <Pill tone="accent">{breveDistretto(card.distretto)}</Pill>
          <Pill>{NOMI_TIPO[card.tipo]}</Pill>
          <Pill>Livello {card.livello}</Pill>
          {card.verificata ? <Pill tone="good">Verificata</Pill> : <Pill tone="warn">Da verificare</Pill>}
        </div>
        <div className="text-sm text-muted">{card.argomento}</div>
        <h2 className="text-lg font-semibold whitespace-pre-line">{card.domanda}</h2>
        {card.immagine && (
          <ImageWithHotspots src={resolveSrc(card.immagine.src, data.images)} hotspot={card.immagine.hotspot} target={card.immagine.target} />
        )}
        {card.tipo === 'flash' ? (
          <div className="rounded-xl bg-accent/10 p-3">
            <b>Risposta:</b> {card.corrette as string}
          </div>
        ) : card.tipo === 'ordina' ? (
          <ol className="list-decimal space-y-1 pl-5">
            {ok.map((i) => (
              <li key={i}>{card.opzioni![i]}</li>
            ))}
          </ol>
        ) : (
          <ul className="space-y-1">
            {card.opzioni!.map((o, i) => (
              <li key={i} className={cx('rounded-lg px-3 py-2', ok.includes(i) ? 'bg-good/15 font-semibold text-good' : 'bg-surface2')}>
                {ok.includes(i) ? '✓ ' : ''}
                {o}
              </li>
            ))}
          </ul>
        )}
        <div>
          <div className="text-xs font-semibold uppercase text-muted">Spiegazione</div>
          <p className="whitespace-pre-line">{card.spiegazione}</p>
        </div>
        {card.perla && (
          <div className="rounded-xl border border-pearl/40 bg-pearl/10 p-3">
            <div className="text-xs font-semibold uppercase text-pearl">Perla chirurgica</div>
            <p className="whitespace-pre-line">{card.perla}</p>
          </div>
        )}
        <p className="text-sm text-muted">
          <b>Fonte:</b> {card.fonte.testo} — {card.fonte.riferimento}
        </p>
        <p className="text-sm text-muted">
          <b>Interventi:</b> {card.interventi.join(', ') || '—'} · <b>Tag:</b> {card.tag.join(', ') || '—'}
        </p>
      </Panel>

      <div className="sticky bottom-0 -mx-4 mt-4 grid grid-cols-3 gap-2 border-t border-line bg-bg/95 px-4 pt-3 pb-safe backdrop-blur">
        <Button
          variant="danger"
          data-testid="scarta"
          onClick={async () => {
            if (!confirm(`Scartare la card ${card.id}? Verrà eliminata (con i suoi progressi) e non sarà ricaricata dal set di base.`)) return;
            await discardCard(card.id);
            next();
          }}
        >
          Scarta
        </Button>
        <Button onClick={() => setEditing(true)} data-testid="modifica">
          Modifica
        </Button>
        <Button
          variant="primary"
          data-testid="approva"
          onClick={async () => {
            await db.cards.update(card.id, { verificata: !card.verificata });
            if (!card.verificata) next();
          }}
        >
          {card.verificata ? 'Annulla ✓' : 'Approva'}
        </Button>
      </div>
    </Screen>
  );
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export function CardEditor({ card, images, onClose, isNew }: { card: CardT; images: AppData['images']; onClose: () => void; isNew?: boolean }) {
  const [c, setC] = useState(() => ({
    ...card,
    opzioniText: (card.opzioni ?? []).join('\n'),
    corretteText: Array.isArray(card.corrette) ? card.corrette.map((i) => i + 1).join(', ') : card.corrette,
    interventiText: card.interventi.join('\n'),
    tagText: card.tag.join(', '),
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [json, setJson] = useState<string | null>(null);
  const set = (patch: Partial<typeof c>) => setC((cur) => ({ ...cur, ...patch }));

  const build = (): unknown => {
    const { opzioniText, corretteText, interventiText, tagText, ...rest } = c;
    const out: Record<string, unknown> = {
      ...rest,
      interventi: lines(interventiText),
      tag: tagText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      perla: c.perla?.trim() ? c.perla : undefined,
    };
    if (c.tipo === 'flash') {
      out.corrette = corretteText;
      delete out.opzioni;
    } else {
      out.opzioni = lines(opzioniText);
      out.corrette = corretteText
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((n) => Number(n) - 1);
    }
    return out;
  };

  const save = async (raw: unknown) => {
    const r = validateCard(raw);
    if (!r.ok) return setErrors(r.errors);
    if (isNew && (await db.cards.get(r.card.id))) return setErrors([`Esiste già una card con id "${r.card.id}"`]);
    if (!isNew && r.card.id !== card.id) return setErrors(['L\'id non può essere cambiato: crea una nuova card']);
    await db.cards.put(r.card);
    // la card era stata scartata in passato? rimuovila dalla lista
    const disc = await getMeta<string[]>('discarded', []);
    if (disc.includes(r.card.id)) await setMeta('discarded', disc.filter((x) => x !== r.card.id));
    onClose();
  };

  return (
    <Screen title={isNew ? 'Nuova card' : 'Modifica card'} nav={false} right={<Button variant="ghost" onClick={onClose}>Annulla</Button>}>
      <div className="space-y-3 pb-24">
        <Button variant="ghost" onClick={() => setJson(json === null ? JSON.stringify(build(), null, 2) : null)}>
          {json === null ? 'Modifica come JSON' : 'Torna al modulo'}
        </Button>
        {json !== null ? (
          <textarea className={`${inputCls} h-[60vh] font-mono text-xs`} value={json} onChange={(e) => setJson(e.target.value)} />
        ) : (
          <>
            <Field label="Id">
              <input className={inputCls} value={c.id} readOnly={!isNew} onChange={(e) => set({ id: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Distretto">
                <select className={inputCls} value={c.distretto} onChange={(e) => set({ distretto: e.target.value as CardT['distretto'] })}>
                  {DISTRETTI.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.breve}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Livello">
                <select className={inputCls} value={c.livello} onChange={(e) => set({ livello: Number(e.target.value) as 1 | 2 | 3 })}>
                  <option value={1}>1 · base</option>
                  <option value={2}>2 · specializzando</option>
                  <option value={3}>3 · avanzato</option>
                </select>
              </Field>
            </div>
            <Field label="Argomento">
              <input className={inputCls} value={c.argomento} onChange={(e) => set({ argomento: e.target.value })} />
            </Field>
            <Field label="Domanda">
              <textarea className={`${inputCls} h-24`} value={c.domanda} onChange={(e) => set({ domanda: e.target.value })} />
            </Field>
            {c.tipo !== 'flash' && (
              <Field label="Opzioni (una per riga)">
                <textarea className={`${inputCls} h-32`} value={c.opzioniText} onChange={(e) => set({ opzioniText: e.target.value })} />
              </Field>
            )}
            <Field
              label={c.tipo === 'flash' ? 'Risposta' : c.tipo === 'ordina' ? 'Ordine corretto (numeri delle opzioni, 1-based)' : 'Risposte corrette (numeri delle opzioni, 1-based)'}
              hint={c.tipo === 'flash' ? undefined : 'Es. "1" oppure "1, 3"'}
            >
              <textarea className={`${inputCls} ${c.tipo === 'flash' ? 'h-24' : 'h-12'}`} value={c.corretteText} onChange={(e) => set({ corretteText: e.target.value })} />
            </Field>
            <Field label="Spiegazione">
              <textarea className={`${inputCls} h-28`} value={c.spiegazione} onChange={(e) => set({ spiegazione: e.target.value })} />
            </Field>
            <Field label="Perla chirurgica (facoltativa)">
              <textarea className={`${inputCls} h-20`} value={c.perla ?? ''} onChange={(e) => set({ perla: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Fonte – testo">
                <input className={inputCls} value={c.fonte.testo} onChange={(e) => set({ fonte: { ...c.fonte, testo: e.target.value } })} />
              </Field>
              <Field label="Fonte – riferimento">
                <input className={inputCls} value={c.fonte.riferimento} onChange={(e) => set({ fonte: { ...c.fonte, riferimento: e.target.value } })} />
              </Field>
            </div>
            <Field label="Interventi (uno per riga)">
              <textarea className={`${inputCls} h-20`} value={c.interventiText} onChange={(e) => set({ interventiText: e.target.value })} />
            </Field>
            <Field label="Tag (separati da virgola)" hint='"a-rischio" mette la card tra le strutture a rischio in pre-sala.'>
              <input className={inputCls} value={c.tagText} onChange={(e) => set({ tagText: e.target.value })} />
            </Field>
            <label className="flex min-h-12 items-center justify-between">
              <span>Verificata</span>
              <input type="checkbox" className="size-6 accent-[var(--accent)]" checked={c.verificata} onChange={(e) => set({ verificata: e.target.checked })} />
            </label>
            {c.immagine && (
              <div className="space-y-2">
                <ImageWithHotspots src={resolveSrc(c.immagine.src, images)} hotspot={c.immagine.hotspot} target={c.immagine.target} />
                <Button className="w-full" onClick={() => go('/immagini', { card: card.id })}>
                  Modifica i punti sull'immagine
                </Button>
              </div>
            )}
          </>
        )}
        {errors.length > 0 && (
          <div className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad" data-testid="errori-editor">
            <ul className="list-disc pl-5">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 px-4 pt-3 pb-safe backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button
            big
            variant="primary"
            className="w-full"
            data-testid="salva-card"
            onClick={() => {
              if (json !== null) {
                try {
                  save(JSON.parse(json));
                } catch (e) {
                  setErrors([`JSON non valido: ${(e as Error).message}`]);
                }
              } else save(build());
            }}
          >
            Salva
          </Button>
        </div>
      </div>
    </Screen>
  );
}
