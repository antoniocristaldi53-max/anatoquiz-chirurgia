import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(): Route {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [path, q = ''] = h.split('?');
  return { path: path || '/', params: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(path: string, params?: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') q.set(k, v);
  const s = q.toString();
  window.location.hash = s ? `${path}?${s}` : path;
}
