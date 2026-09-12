'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { TRAILING_BUTTON } from './field';

type State = 'idle' | 'pasted' | 'denied' | 'unsupported';

const MESSAGES: Record<State, string> = {
  idle: 'pegar',
  pasted: '✓ pegado',
  denied: 'sin permiso',
  unsupported: 'pega a mano',
};

/**
 * Pegar no es el reflejo de copiar.
 *
 * No hay plan B: `document.execCommand('paste')` lleva años bloqueado en todos
 * los navegadores por seguridad, así que cuando `readText` no está disponible
 * (Firefox fuera de una extensión) lo único honesto es decirlo y dejar que el
 * usuario pegue con el teclado o el menú del sistema.
 */
export function PasteButton({
  onPaste,
  disabled,
}: {
  onPaste: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function settle(next: State) {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  function paste() {
    // Sin `await` por delante y con `.then` en lugar de una función async: Safari
    // revoca la activación transitoria del gesto en cuanto se cede el hilo, y
    // readText() falla si no se invoca dentro del propio manejador del clic.
    if (!navigator.clipboard?.readText) {
      settle('unsupported');
      return;
    }

    navigator.clipboard.readText().then(
      (text) => {
        onPaste(text);
        settle('pasted');
      },
      () => settle('denied'),
    );
  }

  return (
    <button
      type="button"
      onClick={paste}
      disabled={disabled}
      className={cn(TRAILING_BUTTON, 'min-w-[7.5rem] justify-center')}
    >
      <span aria-live="polite">{MESSAGES[state]}</span>
    </button>
  );
}
