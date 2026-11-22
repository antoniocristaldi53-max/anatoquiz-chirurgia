import { useMemo } from 'react';
import { MasteryGrid, RecallHeatmap, SeqLegend, TrendChart } from '../components/Charts';
import { nRisposte, Panel, Screen, pct } from '../components/ui';
import { makeScheduler } from '../lib/fsrs';
import { dueCards } from '../lib/queue';
import { avgSeconds, lastNDays, masteryMap, recallHeatmap, streak } from '../lib/stats';
import type { AppData } from '../lib/useData';

const WEEKS = 6;

function Kpi({ label, value, sub, testid }: { label: string; value: string | number; sub?: string; testid?: string }) {
  return (
    <Panel className="p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold" data-testid={testid}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Panel>
  );
}

export default function Statistiche({ data }: { data: AppData }) {
  const f = useMemo(() => makeScheduler({ retention: data.settings.retention }), [data.settings.retention]);
  const now = new Date();
  const due = dueCards({ cards: data.cards, states: data.states, reviews: data.reviews, f, now, newPerDay: 0, includeUnverified: data.settings.includeUnverified }).length;
  const days = lastNDays(data.reviews, 30, now);
  const tot30 = days.reduce((a, d) => a + d.n, 0);
  const ok30 = days.reduce((a, d) => a + d.correct, 0);
  const avg = avgSeconds(data.reviews, 30, now);
  const heat = recallHeatmap(data.reviews, WEEKS, now);
  const mastery = masteryMap(data.cards, data.states, f, now);

  return (
    <Screen title="Statistiche">
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Kpi label="In scadenza oggi" value={due} testid="stat-scadenza" />
        <Kpi label="Serie" value={`${streak(data.reviews, now)} gg`} sub="giorni consecutivi" />
        <Kpi label="Richiamo 30 gg" value={pct(tot30 ? ok30 / tot30 : null)} sub={nRisposte(tot30)} />
        <Kpi label="Tempo medio" value={avg === null ? '—' : `${avg.toFixed(1).replace('.', ',')} s`} sub="per risposta" />
      </div>

      <Panel className="mb-4">
        <h2 className="mb-2 font-bold">Andamento a 30 giorni</h2>
        <TrendChart days={days} />
      </Panel>

      <Panel className="mb-4">
        <h2 className="font-bold">Richiamo per distretto</h2>
        <p className="mb-2 text-xs text-muted">% di risposte corrette per settimana (colonne) e totale delle ultime {WEEKS} settimane.</p>
        <RecallHeatmap rows={heat} weeks={WEEKS} />
        <SeqLegend />
      </Panel>

      <Panel>
        <h2 className="font-bold">Mappa di padronanza</h2>
        <p className="mb-2 text-xs text-muted">Richiamo stimato da FSRS su tutte le card del distretto (le non viste contano zero). Tocca un distretto per esplorarlo.</p>
        <MasteryGrid mastery={mastery} />
        <SeqLegend />
      </Panel>
    </Screen>
  );
}
