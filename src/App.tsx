import { lazy, Suspense, useEffect, useState } from 'react';
import { BottomNav } from './components/ui';
import { BASE_CARDS } from './lib/content';
import { seedCards } from './lib/seed';
import { useRoute } from './lib/router';
import { useData } from './lib/useData';
import { updateBadge } from './lib/reminder';
import Home from './screens/Home';
import Session from './screens/Session';
import { Esplora, PreSala } from './screens/Pickers';

const Statistiche = lazy(() => import('./screens/Statistiche'));
const Revisione = lazy(() => import('./screens/Revisione'));
const Immagini = lazy(() => import('./screens/Immagini'));
const Impostazioni = lazy(() => import('./screens/Impostazioni'));

export default function App() {
  const route = useRoute();
  const data = useData();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    seedCards(BASE_CARDS)
      .catch((e) => console.error('Seed fallito', e))
      .finally(() => setSeeded(true));
    // chiede al browser di non cancellare i dati locali (importante su iOS)
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!data) return;
    document.documentElement.classList.toggle('dark', data.settings.theme === 'dark');
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', data.settings.theme === 'dark' ? '#0b1016' : '#f4f6f8');
    if (data.settings.badge) updateBadge(data);
  }, [data]);

  if (!data || !seeded) return <div className="grid min-h-screen place-items-center text-muted">Caricamento…</div>;

  const p = route.path;
  let screen;
  if (p === '/sessione') screen = <Session key={route.params.toString()} params={route.params} />;
  else if (p === '/presala') screen = <PreSala data={data} />;
  else if (p === '/esplora') screen = <Esplora data={data} />;
  else if (p === '/statistiche') screen = <Statistiche data={data} />;
  else if (p.startsWith('/revisione')) screen = <Revisione data={data} params={route.params} />;
  else if (p === '/immagini') screen = <Immagini data={data} params={route.params} />;
  else if (p === '/impostazioni') screen = <Impostazioni data={data} />;
  else screen = <Home data={data} />;

  return (
    <>
      <Suspense fallback={<div className="p-6 text-muted">Caricamento…</div>}>{screen}</Suspense>
      {p !== '/sessione' && <BottomNav path={p} />}
    </>
  );
}
