'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Suscripción a una media query sin `useState` ni `useEffect`.
 *
 * `useSyncExternalStore` evita el parpadeo del patrón clásico (montar con un
 * valor por defecto y corregirlo en un efecto) y deja explícito el valor que se
 * usa durante el render en servidor.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // En servidor no hay viewport que medir. Devolver el caso de escritorio
    // mantiene el HTML coherente con lo que ve la mayoría y evita un desajuste
    // de hidratación: si acierta no hay repintado, y si no, React lo corrige.
    () => serverFallback,
  );
}
