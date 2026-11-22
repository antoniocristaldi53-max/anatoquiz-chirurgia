import { Screen } from '../components/ui';
import type { AppData } from '../lib/useData';

export default function Immagini(_p: { data: AppData; params: URLSearchParams }) {
  return <Screen title="Immagini"><p className="text-muted">In arrivo.</p></Screen>;
}
