import { useState } from 'react';
import { Button, Empty, Field, inputCls, Screen } from '../components/ui';
import { listInterventi } from '../lib/queue';
import { go } from '../lib/router';
import { DISTRETTI, NOMI_TIPO, TIPI } from '../lib/schema';
import type { AppData } from '../lib/useData';

export function PreSala({ data }: { data: AppData }) {
  const [q, setQ] = useState('');
  const cards = data.settings.includeUnverified ? data.cards : data.cards.filter((c) => c.verificata);
  const list = listInterventi(cards).filter((i) => i.nome.toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen title="Pre-sala" back="/">
      <input className={`${inputCls} mb-3`} placeholder="Cerca intervento…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!list.length && <Empty>Nessun intervento trovato.</Empty>}
      <div className="flex flex-col gap-2">
        {list.map((i) => (
          <button
            key={i.nome}
            data-testid="intervento"
            onClick={() => go('/sessione', { mode: 'presala', intervento: i.nome })}
            className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left"
          >
            <span className="font-semibold">{i.nome}</span>
            <span className="shrink-0 text-sm text-muted">
              {i.n} card{i.rischio ? ` · ${i.rischio} a rischio` : ''}
            </span>
          </button>
        ))}
      </div>
    </Screen>
  );
}

export function Esplora({ data }: { data: AppData }) {
  const [tipo, setTipo] = useState('');
  const [livello, setLivello] = useState('');
  const count = (d: string) => data.cards.filter((c) => c.distretto === d && (!tipo || c.tipo === tipo) && (!livello || c.livello === +livello)).length;
  return (
    <Screen title="Esplora" back="/">
      <p className="mb-3 text-sm text-muted">Modalità libera: le risposte vengono registrate nelle statistiche ma non cambiano la programmazione FSRS.</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Field label="Tipo">
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Tutti</option>
            {TIPI.map((t) => <option key={t} value={t}>{NOMI_TIPO[t]}</option>)}
          </select>
        </Field>
        <Field label="Livello">
          <select className={inputCls} value={livello} onChange={(e) => setLivello(e.target.value)}>
            <option value="">Tutti</option>
            <option value="1">1 · base</option>
            <option value="2">2 · specializzando</option>
            <option value="3">3 · avanzato</option>
          </select>
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        {DISTRETTI.map((d) => (
          <button
            key={d.id}
            data-testid={`distretto-${d.id}`}
            disabled={!count(d.id)}
            onClick={() => go('/sessione', { mode: 'esplora', distretto: d.id, tipo, livello })}
            className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left disabled:opacity-40"
          >
            <span className="font-semibold">{d.nome}</span>
            <span className="shrink-0 text-sm text-muted">{count(d.id)}</span>
          </button>
        ))}
      </div>
      <Button className="mt-4 w-full" onClick={() => go('/sessione', { mode: 'esplora', tipo, livello })}>Tutti i distretti (mescolati)</Button>
    </Screen>
  );
}
