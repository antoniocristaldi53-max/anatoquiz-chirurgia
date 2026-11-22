import { useMemo } from 'react';
import { MasteryGrid } from '../components/Charts';
import { Panel, Screen } from '../components/ui';
import { makeScheduler } from '../lib/fsrs';
import { dueCards, newCards, weakCards, type QueueInput } from '../lib/queue';
import { go } from '../lib/router';
import { masteryMap, streak } from '../lib/stats';
import type { AppData } from '../lib/useData';

function ModeButton({ title, sub, badge, onClick, testid, primary }: { title: string; sub: string; badge?: number | string; onClick: () => void; testid: string; primary?: boolean }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${primary ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface'}`}
    >
      <div className="flex-1">
        <div className="text-lg font-bold">{title}</div>
        <div className={`text-sm ${primary ? 'opacity-80' : 'text-muted'}`}>{sub}</div>
      </div>
      {badge !== undefined && (
        <span className={`min-w-10 rounded-full px-3 py-1 text-center text-lg font-bold ${primary ? 'bg-black/15' : 'bg-surface2'}`}>{badge}</span>
      )}
    </button>
  );
}

export default function Home({ data }: { data: AppData }) {
  const f = useMemo(() => makeScheduler({ retention: data.settings.retention }), [data.settings.retention]);
  const input: QueueInput = { cards: data.cards, states: data.states, reviews: data.reviews, f, now: new Date(), newPerDay: data.settings.newPerDay, includeUnverified: data.settings.includeUnverified };
  const due = dueCards(input).length;
  const nuove = newCards(input).length;
  const deboli = weakCards(input).length;
  const s = streak(data.reviews);
  const mastery = masteryMap(data.cards, data.states, f);
  const oggi = data.reviews.filter((r) => r.ts >= new Date().setHours(0, 0, 0, 0)).length;

  return (
    <Screen title="AnatoQuiz" right={<span className="rounded-full bg-surface2 px-3 py-1 text-sm font-semibold" title="Giorni consecutivi">🔥 {s} {s === 1 ? 'giorno' : 'giorni'}</span>}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Panel className="p-3"><div className="text-2xl font-bold" data-testid="kpi-scadenza">{due}</div><div className="text-xs text-muted">in scadenza</div></Panel>
        <Panel className="p-3"><div className="text-2xl font-bold">{nuove}</div><div className="text-xs text-muted">nuove oggi</div></Panel>
        <Panel className="p-3"><div className="text-2xl font-bold">{oggi}</div><div className="text-xs text-muted">risposte oggi</div></Panel>
      </div>
      <div className="flex flex-col gap-2.5">
        <ModeButton primary testid="mode-giorno" title="Ripasso del giorno" sub={`${due} in scadenza + ${nuove} nuove`} badge={due + nuove} onClick={() => go('/sessione', { mode: 'giorno' })} />
        <ModeButton testid="mode-flash" title="Flash 5 minuti" sub="Tempo fisso: scadute, poi le più deboli" badge="5′" onClick={() => go('/sessione', { mode: 'flash' })} />
        <ModeButton testid="mode-presala" title="Pre-sala" sub="Scegli l'intervento, ripassa le strutture a rischio" onClick={() => go('/presala')} />
        <ModeButton testid="mode-deboli" title="Punti deboli" sub="Molti errori o richiamo basso" badge={deboli} onClick={() => go('/sessione', { mode: 'deboli' })} />
        <ModeButton testid="mode-esplora" title="Esplora per distretto" sub="Libera, non cambia la programmazione" onClick={() => go('/esplora')} />
      </div>
      <h2 className="mt-6 mb-2 text-lg font-bold">Mappa di padronanza</h2>
      <MasteryGrid mastery={mastery} compact />
      {data.cards.length === 0 && <p className="mt-4 text-muted">Nessuna card: importa un file da Altro → Importa.</p>}
    </Screen>
  );
}
