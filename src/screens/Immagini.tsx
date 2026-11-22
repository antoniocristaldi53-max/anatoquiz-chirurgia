import { useMemo, useState } from 'react';
import { ImageWithHotspots } from '../components/QuizCard';
import { Button, cx, Empty, Field, inputCls, Panel, Pill, Screen } from '../components/ui';
import { db } from '../lib/db';
import { go } from '../lib/router';
import { DISTRETTI, validateCard, type CardT, type DistrettoId } from '../lib/schema';
import { resolveSrc, type AppData } from '../lib/useData';

/** Schemi SVG originali inclusi nell'app. */
export const BUILTIN_IMAGES: { src: string; nome: string }[] = [
  { src: 'img/collo-ricorrente.svg', nome: 'Lobo tiroideo e ricorrente' },
  { src: 'img/parete-strati.svg', nome: 'Strati della parete' },
  { src: 'img/iato.svg', nome: 'Iato esofageo (VLS)' },
  { src: 'img/tronco-celiaco.svg', nome: 'Tronco celiaco' },
  { src: 'img/couinaud.svg', nome: 'Segmenti di Couinaud' },
  { src: 'img/calot.svg', nome: 'Triangolo epatocistico' },
  { src: 'img/pancreas.svg', nome: 'Pancreas e vasi' },
  { src: 'img/mesenterica.svg', nome: 'Vasi mesenterici' },
  { src: 'img/ano.svg', nome: 'Canale anale (coronale)' },
  { src: 'img/retroperitoneo.svg', nome: 'Retroperitoneo' },
  { src: 'img/ascella.svg', nome: 'Cavo ascellare' },
  { src: 'img/safena.svg', nome: 'Giunzione safeno-femorale' },
  { src: 'img/tapp.svg', nome: 'Regione inguinale in TAPP' },
];

/** Ridimensiona una foto (lato lungo max 1600 px) e la converte in JPEG per contenere le dimensioni del backup. */
async function fileToDataUrl(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Immagine non leggibile'));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Immagini({ data, params }: { data: AppData; params: URLSearchParams }) {
  const cardId = params.get('card');
  const img = params.get('img');
  const [msg, setMsg] = useState('');

  const editCard = cardId ? data.cards.find((c) => c.id === cardId) : undefined;
  if (editCard?.immagine) return <HotspotEditor data={data} src={editCard.immagine.src} card={editCard} />;
  if (img) return <HotspotEditor data={data} src={img} />;

  const usage = (src: string) => data.cards.filter((c) => c.immagine?.src === src).length;

  return (
    <Screen title="Immagini">
      <Panel className="mb-4 space-y-2">
        <h2 className="font-bold">Carica una tua immagine</h2>
        <p className="text-sm text-muted">
          Foto di uno schema tuo o fotogramma di un video dei tuoi interventi. L'immagine resta solo su questo dispositivo (e nel backup). Non caricare
          tavole di atlanti protette da copyright né immagini che identifichino pazienti.
        </p>
        <label className="block">
          <span className="sr-only">Scegli immagine</span>
          <input
            type="file"
            accept="image/*"
            data-testid="upload-immagine"
            className="block w-full text-sm file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-accent file:px-4 file:font-semibold file:text-accent-fg"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const dataUrl = await fileToDataUrl(file);
                const id = `img-${Date.now().toString(36)}`;
                await db.images.add({ id, name: file.name, dataUrl, createdAt: Date.now() });
                go('/immagini', { img: `idb:${id}` });
              } catch (err) {
                setMsg((err as Error).message);
              }
            }}
          />
        </label>
        {msg && <p className="text-sm text-bad">{msg}</p>}
      </Panel>

      {data.images.length > 0 && (
        <>
          <h2 className="mb-2 font-bold">Le tue immagini</h2>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {data.images.map((i) => (
              <div key={i.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                <button className="block w-full" onClick={() => go('/immagini', { img: `idb:${i.id}` })}>
                  <img src={i.dataUrl} alt={i.name} className="aspect-square w-full object-cover" />
                </button>
                <div className="flex items-center justify-between gap-1 p-2 text-xs">
                  <span className="truncate">{i.name}</span>
                  <button
                    className="shrink-0 font-semibold text-bad"
                    onClick={async () => {
                      const n = usage(`idb:${i.id}`);
                      if (n) return setMsg(`L'immagine è usata da ${n} card: eliminale o modificale prima.`);
                      if (confirm(`Eliminare definitivamente "${i.name}"?`)) await db.images.delete(i.id);
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-2 font-bold">Schemi originali inclusi</h2>
      <div className="grid grid-cols-2 gap-2">
        {BUILTIN_IMAGES.map((b) => (
          <button key={b.src} onClick={() => go('/immagini', { img: b.src })} className="overflow-hidden rounded-xl border border-line bg-surface text-left">
            <img src={resolveSrc(b.src, [])} alt={b.nome} className="aspect-square w-full bg-white object-contain" />
            <div className="p-2 text-xs">
              <div className="font-semibold">{b.nome}</div>
              <div className="text-muted">{usage(b.src)} card</div>
            </div>
          </button>
        ))}
      </div>
    </Screen>
  );
}

const FONTE_DEFAULT = { testo: 'Immagine personale', riferimento: 'schema/fotogramma personale' };

function HotspotEditor({ data, src, card }: { data: AppData; src: string; card?: CardT }) {
  const [points, setPoints] = useState<{ x: number; y: number }[]>(card?.immagine?.hotspot ?? []);
  const [target, setTarget] = useState<number>(card?.immagine?.target ?? 0);
  const [sel, setSel] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState({
    distretto: (card?.distretto ?? 'vie-biliari') as DistrettoId,
    argomento: '',
    livello: 2 as 1 | 2 | 3,
    domanda: 'Quale struttura indica il punto evidenziato?',
    opzioni: '',
    corretta: 1,
    spiegazione: '',
    perla: '',
    fonteTesto: src.startsWith('idb:') ? FONTE_DEFAULT.testo : 'Schema originale AnatoQuiz',
    fonteRif: src.startsWith('idb:') ? FONTE_DEFAULT.riferimento : '',
    interventi: '',
    tag: 'immagine',
  });
  const usedBy = useMemo(() => data.cards.filter((c) => c.immagine?.src === src), [data.cards, src]);
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const onTap = (x: number, y: number) => {
    if (moving && sel !== null) {
      setPoints((p) => p.map((pt, i) => (i === sel ? { x, y } : pt)));
      setMoving(false);
      return;
    }
    setPoints((p) => [...p, { x, y }]);
    setSel(points.length);
  };

  const removeSel = () => {
    if (sel === null) return;
    setPoints((p) => p.filter((_, i) => i !== sel));
    setTarget((t) => (t === sel ? 0 : t > sel ? t - 1 : t));
    setSel(null);
  };

  const saveCardPoints = async () => {
    if (!card) return;
    const next = { ...card, immagine: { ...card.immagine!, hotspot: points, target: Math.min(target, Math.max(0, points.length - 1)) } };
    const r = validateCard(next);
    if (!r.ok) return setErrors(r.errors);
    await db.cards.put(r.card);
    go('/revisione', { id: card.id });
  };

  const createCard = async () => {
    const opzioni = form.opzioni
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const raw = {
      id: `${form.distretto}-img-${Date.now().toString(36)}`,
      distretto: form.distretto,
      argomento: form.argomento.trim() || 'Identificazione su immagine',
      interventi: form.interventi
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      tipo: 'immagine',
      livello: form.livello,
      domanda: form.domanda,
      opzioni,
      corrette: [form.corretta - 1],
      spiegazione: form.spiegazione,
      perla: form.perla.trim() || undefined,
      fonte: { testo: form.fonteTesto, riferimento: form.fonteRif },
      immagine: { src, hotspot: points, target },
      tag: form.tag
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      verificata: true,
    };
    const r = validateCard(raw);
    if (!r.ok) return setErrors(r.errors);
    await db.cards.add(r.card);
    setErrors([]);
    go('/revisione', { id: r.card.id });
  };

  return (
    <Screen title={card ? 'Punti della card' : 'Editor immagine'} back={card ? '' : '/immagini'} nav={false}>
      <p className="mb-2 text-sm text-muted">
        {moving ? 'Tocca il punto in cui spostare il marcatore selezionato.' : 'Tocca l\'immagine per aggiungere un punto numerato. Tocca un punto per selezionarlo.'}
      </p>
      <ImageWithHotspots
        src={resolveSrc(src, data.images)}
        hotspot={points}
        target={points.length ? target : undefined}
        onTap={onTap}
        onMarkerTap={(i) => setSel(i === sel ? null : i)}
        selected={sel}
        className="cursor-crosshair"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={sel === null} onClick={() => setMoving(true)}>
          Sposta
        </Button>
        <Button disabled={sel === null} onClick={() => sel !== null && setTarget(sel)}>
          Punto della domanda
        </Button>
        <Button variant="danger" disabled={sel === null} onClick={removeSel}>
          Elimina punto
        </Button>
      </div>
      <p className="mt-2 text-sm">
        {points.length} punti · punto chiesto: <Pill tone="accent">{points.length ? target + 1 : '—'}</Pill>
        {sel !== null && <> · selezionato: <Pill tone="warn">{sel + 1}</Pill></>}
      </p>

      {card ? (
        <Button big variant="primary" className="mt-4 w-full" onClick={saveCardPoints} data-testid="salva-punti">
          Salva i punti nella card
        </Button>
      ) : (
        <Panel className="mt-4 space-y-3">
          <h2 className="font-bold">Crea una card da questa immagine</h2>
          {usedBy.length > 0 && <p className="text-xs text-muted">Immagine già usata da {usedBy.length} card.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Distretto">
              <select className={inputCls} value={form.distretto} onChange={(e) => set({ distretto: e.target.value as DistrettoId })}>
                {DISTRETTI.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.breve}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Livello">
              <select className={inputCls} value={form.livello} onChange={(e) => set({ livello: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </Field>
          </div>
          <Field label="Argomento">
            <input className={inputCls} value={form.argomento} onChange={(e) => set({ argomento: e.target.value })} />
          </Field>
          <Field label="Domanda">
            <textarea className={`${inputCls} h-20`} value={form.domanda} onChange={(e) => set({ domanda: e.target.value })} />
          </Field>
          <Field label="Opzioni (una per riga)">
            <textarea className={`${inputCls} h-28`} value={form.opzioni} onChange={(e) => set({ opzioni: e.target.value })} />
          </Field>
          <Field label="Numero dell'opzione corretta">
            <input type="number" min={1} className={inputCls} value={form.corretta} onChange={(e) => set({ corretta: Number(e.target.value) })} />
          </Field>
          <Field label="Spiegazione">
            <textarea className={`${inputCls} h-24`} value={form.spiegazione} onChange={(e) => set({ spiegazione: e.target.value })} />
          </Field>
          <Field label="Perla chirurgica (facoltativa)">
            <textarea className={`${inputCls} h-16`} value={form.perla} onChange={(e) => set({ perla: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fonte – testo">
              <input className={inputCls} value={form.fonteTesto} onChange={(e) => set({ fonteTesto: e.target.value })} />
            </Field>
            <Field label="Fonte – riferimento">
              <input className={inputCls} value={form.fonteRif} onChange={(e) => set({ fonteRif: e.target.value })} />
            </Field>
          </div>
          <Field label="Interventi (uno per riga)">
            <textarea className={`${inputCls} h-16`} value={form.interventi} onChange={(e) => set({ interventi: e.target.value })} />
          </Field>
          <Field label="Tag (separati da virgola)">
            <input className={inputCls} value={form.tag} onChange={(e) => set({ tag: e.target.value })} />
          </Field>
          <Button big variant="primary" className="w-full" onClick={createCard} data-testid="crea-card-immagine">
            Crea card (già verificata)
          </Button>
        </Panel>
      )}
      {errors.length > 0 && (
        <div className={cx('mt-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad')}>
          <ul className="list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {!card && usedBy.length === 0 && points.length === 0 && <Empty>Aggiungi almeno un punto per creare una card.</Empty>}
    </Screen>
  );
}
