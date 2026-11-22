import { useMemo, useRef, useState } from 'react';
import { VOTI, type Voto } from '../lib/fsrs';
import { isCorrect } from '../lib/grade';
import { shuffle } from '../lib/queue';
import { breveDistretto, NOMI_TIPO, type CardT } from '../lib/schema';
import { resolveSrc } from '../lib/useData';
import { Button, cx, Pill } from './ui';

export interface QuizResult {
  voto: Voto;
  correct: boolean;
  ms: number;
}

interface Props {
  card: CardT;
  images: { id: string; dataUrl: string }[];
  /** Etichette degli intervalli FSRS per voto (assenti = modalità senza programmazione). */
  intervals?: Record<Voto, string>;
  onDone: (r: QuizResult) => void;
}

export function ImageWithHotspots({
  src,
  hotspot = [],
  target,
  onTap,
  onMarkerTap,
  selected,
  className,
}: {
  src: string;
  hotspot?: { x: number; y: number }[];
  target?: number;
  onTap?: (x: number, y: number) => void;
  onMarkerTap?: (i: number) => void;
  selected?: number | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={cx('relative mx-auto w-full overflow-hidden rounded-xl border border-line bg-white select-none', className)}
      onClick={(e) => {
        if (!onTap || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        onTap(+(((e.clientX - r.left) / r.width) * 100).toFixed(1), +(((e.clientY - r.top) / r.height) * 100).toFixed(1));
      }}
    >
      <img src={src} alt="Schema anatomico" className="block w-full" draggable={false} />
      {hotspot.map((h, i) => {
        const isT = target === undefined || target === i;
        return (
          <span
            key={i}
            data-testid={`hotspot-${i + 1}`}
            onClick={
              onMarkerTap
                ? (e) => {
                    e.stopPropagation();
                    onMarkerTap(i);
                  }
                : undefined
            }
            className={cx(
              'absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-sm font-bold shadow',
              isT ? 'hotspot-pulse border-white bg-accent text-accent-fg' : 'border-white/80 bg-black/55 text-white',
              selected === i && 'ring-4 ring-warn',
            )}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            {i + 1}
          </span>
        );
      })}
    </div>
  );
}

export function Feedback({ card, correct }: { card: CardT; correct: boolean | null }) {
  return (
    <div className="space-y-3" data-testid="feedback">
      {correct !== null && (
        <div className={cx('rounded-xl px-4 py-3 text-lg font-bold', correct ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad')}>
          {correct ? '✓ Corretto' : '✗ Non corretto'}
        </div>
      )}
      {card.tipo === 'flash' && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">Risposta</div>
          <p className="mt-1 whitespace-pre-line">{card.corrette as string}</p>
        </div>
      )}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Spiegazione</div>
        <p className="mt-1 whitespace-pre-line">{card.spiegazione}</p>
      </div>
      {card.perla && (
        <div className="rounded-xl border border-pearl/40 bg-pearl/10 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-pearl">Perla chirurgica</div>
          <p className="mt-1 whitespace-pre-line">{card.perla}</p>
        </div>
      )}
      <p className="text-sm text-muted">
        <span className="font-semibold">Fonte:</span> {card.fonte.testo} — {card.fonte.riferimento}
      </p>
    </div>
  );
}

export function QuizCard({ card, images, intervals, onDone }: Props) {
  const t0 = useRef(performance.now());
  const [ms, setMs] = useState(0);
  const [phase, setPhase] = useState<'answer' | 'feedback'>('answer');
  const [selected, setSelected] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [correct, setCorrect] = useState<boolean | null>(null);

  // ordine di visualizzazione delle opzioni (mescolato a ogni presentazione)
  const display = useMemo(() => {
    const idx = (card.opzioni ?? []).map((_, i) => i);
    if (card.tipo !== 'ordina') return shuffle(idx, Math.floor(Math.random() * 1e9));
    let s = shuffle(idx, Math.floor(Math.random() * 1e9));
    const ok = card.corrette as number[];
    for (let k = 0; k < 5 && s.length > 1 && s.every((v, i) => v === ok[i]); k++) s = shuffle(idx, k + 7);
    return s;
  }, [card]);

  const submit = (indici: number[]) => {
    setMs(performance.now() - t0.current);
    const r = isCorrect(card, card.tipo === 'ordina' ? { tipo: 'ordine', indici } : { tipo: 'scelta', indici });
    setCorrect(r);
    setPhase('feedback');
  };

  const reveal = () => {
    setMs(performance.now() - t0.current);
    setCorrect(null);
    setPhase('feedback');
  };

  const done = (voto: Voto) => onDone({ voto, correct: correct ?? voto !== 1, ms });
  const ok = Array.isArray(card.corrette) ? card.corrette : [];
  const fb = phase === 'feedback';

  const optionCls = (i: number) => {
    if (!fb) return selected.includes(i) ? 'border-accent bg-accent/15' : 'border-line bg-surface';
    if (ok.includes(i)) return 'border-good bg-good/15';
    if (selected.includes(i)) return 'border-bad bg-bad/15';
    return 'border-line bg-surface opacity-70';
  };

  return (
    <div className="flex flex-col gap-4" data-testid="quiz-card" data-card-id={card.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone="accent">{breveDistretto(card.distretto)}</Pill>
        <Pill>{NOMI_TIPO[card.tipo]}</Pill>
        <Pill>Livello {card.livello}</Pill>
        {card.tag.includes('a-rischio') && <Pill tone="bad">Struttura a rischio</Pill>}
        {card.tag.includes('variante') && <Pill tone="warn">Variante</Pill>}
        {!card.verificata && <Pill tone="warn">Non verificata</Pill>}
      </div>
      <div className="text-sm font-medium text-muted">{card.argomento}</div>
      <h2 className="text-xl font-semibold leading-snug whitespace-pre-line" data-testid="domanda">
        {card.domanda}
      </h2>

      {card.tipo === 'immagine' && card.immagine && (
        <ImageWithHotspots src={resolveSrc(card.immagine.src, images)} hotspot={card.immagine.hotspot} target={card.immagine.target} />
      )}

      {(card.tipo === 'mcq' || card.tipo === 'immagine' || card.tipo === 'multi') && (
        <div className="flex flex-col gap-2.5">
          {card.tipo === 'multi' && !fb && <div className="text-sm text-muted">Seleziona tutte le risposte corrette</div>}
          {display.map((i) => (
            <button
              key={i}
              disabled={fb}
              data-testid="opzione"
              onClick={() => {
                if (card.tipo === 'multi') setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
                else {
                  setSelected([i]);
                  submit([i]);
                }
              }}
              className={cx('min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-base font-medium transition', optionCls(i))}
            >
              {card.tipo === 'multi' && <span className="mr-2">{(fb ? ok.includes(i) : selected.includes(i)) ? '☑' : '☐'}</span>}
              {card.opzioni![i]}
            </button>
          ))}
        </div>
      )}

      {card.tipo === 'ordina' && (
        <div className="flex flex-col gap-3">
          {!fb && <div className="text-sm text-muted">Tocca gli elementi nell'ordine corretto. Tocca un elemento già messo per toglierlo.</div>}
          <ol className="flex flex-col gap-2" data-testid="ordine-scelto">
            {(fb ? ok : order).map((i, n) => {
              const right = fb && order[n] === i;
              return (
                <li key={`${i}-${n}`}>
                  <button
                    disabled={fb}
                    onClick={() => setOrder((o) => o.filter((x) => x !== i))}
                    className={cx(
                      'flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left',
                      fb ? (right ? 'border-good bg-good/10' : 'border-bad bg-bad/10') : 'border-accent bg-accent/10',
                    )}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface2 text-sm font-bold">{n + 1}</span>
                    <span>{card.opzioni![i]}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {fb && !correct && (
            <p className="text-sm text-muted">
              Il tuo ordine: {order.map((i) => card.opzioni![i]).join(' → ')}
            </p>
          )}
          {!fb && (
            <div className="flex flex-col gap-2">
              {display
                .filter((i) => !order.includes(i))
                .map((i) => (
                  <button
                    key={i}
                    data-testid="da-ordinare"
                    onClick={() => setOrder((o) => [...o, i])}
                    className="min-h-12 rounded-2xl border-2 border-dashed border-line bg-surface px-4 py-2 text-left"
                  >
                    {card.opzioni![i]}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {fb && <Feedback card={card} correct={correct} />}

      <div className="sticky bottom-0 -mx-4 mt-2 border-t border-line bg-bg/95 px-4 pt-3 pb-safe backdrop-blur">
        {!fb && card.tipo === 'flash' && (
          <Button big variant="primary" className="w-full" onClick={reveal}>
            Mostra risposta
          </Button>
        )}
        {!fb && card.tipo === 'multi' && (
          <Button big variant="primary" className="w-full" disabled={!selected.length} onClick={() => submit(selected)}>
            Conferma
          </Button>
        )}
        {!fb && card.tipo === 'ordina' && (
          <Button big variant="primary" className="w-full" disabled={order.length !== display.length} onClick={() => submit(order)}>
            Conferma ordine
          </Button>
        )}
        {!fb && (card.tipo === 'mcq' || card.tipo === 'immagine') && (
          <p className="py-3 text-center text-sm text-muted">Tocca una risposta</p>
        )}
        {fb && <RatingBar correct={correct} intervals={intervals} onRate={done} />}
      </div>
    </div>
  );
}

const TONO: Record<string, string> = {
  bad: 'bg-bad/15 text-bad border-bad/40',
  warn: 'bg-warn/15 text-warn border-warn/40',
  good: 'bg-good/15 text-good border-good/40',
  easy: 'bg-easy/15 text-easy border-easy/40',
};

export function RatingBar({
  correct,
  intervals,
  onRate,
}: {
  correct: boolean | null;
  intervals?: Record<Voto, string>;
  onRate: (v: Voto) => void;
}) {
  if (!intervals)
    return (
      <Button big variant="primary" className="w-full" onClick={() => onRate(correct === false ? 1 : 3)} data-testid="avanti">
        Avanti
      </Button>
    );
  if (correct === false)
    return (
      <div>
        <button
          data-testid="voto-1"
          onClick={() => onRate(1)}
          className={cx('flex min-h-14 w-full items-center justify-between rounded-2xl border px-5 text-lg font-bold', TONO.bad)}
        >
          <span>Di nuovo</span>
          <span className="text-sm font-medium opacity-80">{intervals[1]}</span>
        </button>
        <p className="pt-2 text-center text-xs text-muted">Risposta errata: la card torna più avanti in questa sessione.</p>
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      {VOTI.map((v) => (
        <button
          key={v.voto}
          data-testid={`voto-${v.voto}`}
          onClick={() => onRate(v.voto)}
          className={cx('flex min-h-14 flex-col items-center justify-center rounded-2xl border font-bold', TONO[v.tono])}
        >
          <span>{v.label}</span>
          <span className="text-xs font-medium opacity-80">{intervals[v.voto]}</span>
        </button>
      ))}
    </div>
  );
}
