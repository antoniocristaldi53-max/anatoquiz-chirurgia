import { useEffect, useMemo, useRef, useState } from 'react';
import { QuizCard, type QuizResult } from '../components/QuizCard';
import { Button, Empty, Panel, Screen, pct } from '../components/ui';
import { db, type ModeId, type StateRow } from '../lib/db';
import { makeScheduler, previewIntervals, type Voto } from '../lib/fsrs';
import { buildQueue, MODES, SessionEngine, TAG_RISCHIO, type ModeOptions } from '../lib/queue';
import { loadAll, recordReview } from '../lib/repo';
import { go } from '../lib/router';
import { breveDistretto, type CardT } from '../lib/schema';

interface Loaded {
  cards: Map<string, CardT>;
  states: Map<string, StateRow>;
  queue: CardT[];
  retention: number;
  images: { id: string; dataUrl: string }[];
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

export default function Session({ params }: { params: URLSearchParams }) {
  const mode = (params.get('mode') ?? 'giorno') as ModeId;
  const info = MODES[mode] ?? MODES.giorno;
  const opts: ModeOptions = {
    intervento: params.get('intervento') ?? undefined,
    distretto: params.get('distretto') ?? undefined,
    tipo: params.get('tipo') ?? undefined,
    livello: params.get('livello') ? Number(params.get('livello')) : undefined,
  };
  const [data, setData] = useState<Loaded | null>(null);
  const engine = useRef<SessionEngine | null>(null);
  const [tick, setTick] = useState(0);
  const [started, setStarted] = useState(mode !== 'presala');
  const [ended, setEnded] = useState(false);
  const [left, setLeft] = useState(info.durata ?? 0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const all = await loadAll();
      const f = makeScheduler({ retention: all.settings.retention });
      const queue = buildQueue(
        mode,
        { cards: all.cards, states: all.states, reviews: all.reviews, f, now: new Date(), newPerDay: all.settings.newPerDay, includeUnverified: all.settings.includeUnverified },
        opts,
      );
      engine.current = new SessionEngine(queue.map((c) => c.id));
      setData({
        cards: new Map(all.cards.map((c) => [c.id, c])),
        states: all.states,
        queue,
        retention: all.settings.retention,
        images: await db.images.toArray(),
      });
      startedAt.current = Date.now();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // timer della sessione flash
  useEffect(() => {
    if (!info.durata || !data || !started || ended) return;
    const id = setInterval(() => {
      const l = info.durata! - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(l);
    }, 500);
    return () => clearInterval(id);
  }, [info.durata, data, started, ended]);

  const f = useMemo(() => makeScheduler({ retention: data?.retention }), [data?.retention]);
  const e = engine.current;
  const currentId = e?.current;
  const card = currentId ? data?.cards.get(currentId) : undefined;
  const intervals = useMemo(
    () => (info.schedula && card && data ? previewIntervals(f, data.states.get(card.id)) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card?.id, tick, info.schedula, data],
  );

  if (!data || !e) return <Screen title={info.nome} back="/" nav={false}><p className="text-muted">Preparo la sessione…</p></Screen>;

  const timeUp = !!info.durata && left <= 0;

  const onDone = async (r: QuizResult) => {
    if (!card) return;
    const next = await recordReview({
      card,
      voto: r.voto as Voto,
      correct: r.correct,
      ms: r.ms,
      mode,
      schedula: info.schedula,
      retention: data.retention,
    });
    if (next) data.states.set(card.id, next);
    e.answer(r.voto, r.correct);
    if (!e.current || (info.durata && Date.now() - startedAt.current >= info.durata * 1000)) setEnded(true);
    setTick((t) => t + 1);
  };

  const header = (
    <div className="flex items-center gap-3 text-sm">
      {info.durata ? (
        <span className={`rounded-full px-3 py-1 font-mono font-bold ${timeUp ? 'bg-bad/15 text-bad' : 'bg-surface2'}`} data-testid="timer">
          {fmtClock(Math.max(0, left))}
        </span>
      ) : (
        <span className="text-muted" data-testid="contatore">
          {e.answered} fatte · {e.remaining} rimaste
        </span>
      )}
      <button onClick={() => setEnded(true)} className="rounded-full px-3 py-1 font-semibold text-accent" data-testid="termina">
        Termina
      </button>
    </div>
  );

  const titolo = mode === 'presala' && opts.intervento ? `Pre-sala` : mode === 'esplora' && opts.distretto ? breveDistretto(opts.distretto) : info.nome;

  if (!data.queue.length)
    return (
      <Screen title={titolo} back="/" nav={false}>
        <Empty>
          {mode === 'giorno' && 'Nessuna card in scadenza e nessuna nuova disponibile oggi. Ottimo lavoro!'}
          {mode === 'flash' && 'Nessuna card ancora studiata: inizia dal ripasso del giorno.'}
          {mode === 'deboli' && 'Nessun punto debole al momento.'}
          {(mode === 'presala' || mode === 'esplora') && 'Nessuna card corrisponde alla selezione.'}
        </Empty>
        <Button big variant="primary" className="mt-4 w-full" onClick={() => go('/')}>
          Torna a Oggi
        </Button>
      </Screen>
    );

  if (!started) {
    const risk = [...new Set(data.queue.filter((c) => c.tag.includes(TAG_RISCHIO)).map((c) => c.argomento))];
    return (
      <Screen title="Pre-sala" back="/presala" nav={false}>
        <Panel className="space-y-3">
          <div className="text-sm text-muted">Intervento</div>
          <div className="text-xl font-bold">{opts.intervento}</div>
          <div className="text-sm text-muted">{data.queue.length} card collegate</div>
          {risk.length > 0 && (
            <div>
              <div className="mb-1 text-sm font-semibold text-bad">Strutture a rischio</div>
              <ul className="list-disc space-y-0.5 pl-5" data-testid="strutture-rischio">
                {risk.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <Button big variant="primary" className="mt-4 w-full" onClick={() => { setStarted(true); startedAt.current = Date.now(); }}>
          Inizia
        </Button>
      </Screen>
    );
  }

  if (ended || !card) {
    const mins = Math.round((Date.now() - startedAt.current) / 60000);
    return (
      <Screen title="Sessione completata" nav={false}>
        <Panel className="space-y-2" >
          <div data-testid="riepilogo" className="text-lg">
            <b>{e.answered}</b> {e.answered === 1 ? 'risposta' : 'risposte'} · <b>{pct(e.answered ? e.correct / e.answered : null)}</b> corrette
          </div>
          <div className="text-muted">Durata: {mins < 1 ? 'meno di 1 minuto' : `${mins} min`}</div>
          {e.remaining > 0 && <div className="text-muted">{e.remaining} card rimaste in coda per la prossima volta.</div>}
          {!info.schedula && <div className="text-muted">Modalità libera: la programmazione non è stata modificata.</div>}
        </Panel>
        <Button big variant="primary" className="mt-4 w-full" onClick={() => go('/')}>
          Torna a Oggi
        </Button>
      </Screen>
    );
  }

  return (
    <Screen title={titolo} nav={false} right={header}>
      {timeUp && <div className="mb-3 rounded-xl bg-bad/15 px-3 py-2 text-sm text-bad">Tempo scaduto: completa questa card.</div>}
      <QuizCard key={`${card.id}-${e.answered}`} card={card} images={data.images} intervals={intervals} onDone={onDone} />
    </Screen>
  );
}
