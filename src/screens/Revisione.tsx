import { Screen } from '../components/ui';
import type { AppData } from '../lib/useData';

export default function Revisione(_p: { data: AppData; params: URLSearchParams }) {
  return <Screen title="Revisione"><p className="text-muted">In arrivo.</p></Screen>;
}
