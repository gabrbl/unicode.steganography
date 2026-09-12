'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './button';

type State = 'idle' | 'copied' | 'error';

/**
 * El portapapeles moderno exige contexto seguro. Como copiar y pegar *es* la función
 * de esta herramienta, conviene un plan B antes que dejar al usuario sin salida.
 */
function legacyCopy(value: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

const MESSAGES: Record<State, string> = {
  idle: 'copiar',
  copied: '✓ copiado',
  error: 'no se pudo copiar',
};

export function CopyButton({ value, disabled }: { value: string; disabled?: boolean }) {
  const [state, setState] = useState<State>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = legacyCopy(value);
    }

    setState(ok ? 'copied' : 'error');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <Button type="button" onClick={copy} disabled={disabled} className="min-w-[8.5rem]">
      <span aria-live="polite">{MESSAGES[state]}</span>
    </Button>
  );
}
