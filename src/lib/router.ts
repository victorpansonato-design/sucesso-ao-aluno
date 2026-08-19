import { useCallback, useEffect, useState } from 'react';

/* ==========================================================================
   Hash router
   --------------------------------------------------------------------------
   An operations tool must survive the browser Back button. Without real
   history, "voltar para a fila" is a lie and no view can be shared with a
   colleague. Hash routing gives both with zero dependencies and no server
   rewrite rules — which matters because this app is served as a static bundle.

   Routes
     #/cockpit
     #/fila                       #/fila/:caseId
     #/alunos                     #/alunos/:studentId
     #/radares                    #/radares/:radarKey
     #/onboarding
     #/jornada
     #/indicadores
     #/equipe
     #/playbook
     #/governanca
   ========================================================================== */

export type RouteName =
  | 'cockpit'
  | 'fila'
  | 'alunos'
  | 'radares'
  | 'onboarding'
  | 'jornada'
  | 'indicadores'
  | 'equipe'
  | 'playbook'
  | 'governanca';

export interface Route {
  name: RouteName;
  /** Second path segment: a case id, student id or radar key. */
  param: string | null;
}

const VALID: RouteName[] = [
  'cockpit',
  'fila',
  'alunos',
  'radares',
  'onboarding',
  'jornada',
  'indicadores',
  'equipe',
  'playbook',
  'governanca',
];

export const DEFAULT_ROUTE: Route = { name: 'cockpit', param: null };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  if (!clean) return DEFAULT_ROUTE;

  const [head, tail] = clean.split('/');
  const name = VALID.find((v) => v === head);
  if (!name) return DEFAULT_ROUTE;
  return { name, param: tail ? decodeURIComponent(tail) : null };
}

export function buildHash(name: RouteName, param?: string | null): string {
  return param ? `#/${name}/${encodeURIComponent(param)}` : `#/${name}`;
}

export function useRoute(): {
  route: Route;
  navigate: (name: RouteName, param?: string | null) => void;
  replace: (name: RouteName, param?: string | null) => void;
  back: () => void;
  href: (name: RouteName, param?: string | null) => string;
} {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    // Normalise a bare URL so the first entry in history is a real route.
    if (!window.location.hash) window.location.replace(buildHash(DEFAULT_ROUTE.name));
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((name: RouteName, param?: string | null) => {
    const next = buildHash(name, param);
    if (window.location.hash === next) return;
    window.location.hash = next;
  }, []);

  const replace = useCallback((name: RouteName, param?: string | null) => {
    const next = buildHash(name, param);
    window.history.replaceState(null, '', next);
    setRoute(parseHash(next));
  }, []);

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = buildHash(DEFAULT_ROUTE.name);
  }, []);

  const href = useCallback(
    (name: RouteName, param?: string | null) => buildHash(name, param),
    [],
  );

  return { route, navigate, replace, back, href };
}
