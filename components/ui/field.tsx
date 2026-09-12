'use client';

import { useId, useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Base compartida de todos los controles de texto.
 *
 * El salto `text-base sm:text-sm` no es estética: iOS Safari hace zoom sobre la
 * página al enfocar un control cuyo font-size sea menor que 16px, y no lo
 * revierte al salir del campo. Se corrige subiendo a 16px en móvil, no con
 * `maximum-scale`, que además impediría ampliar a quien lo necesita.
 */
export const CONTROL = cn(
  'w-full resize-y border border-line-bright bg-surface px-3 py-2.5 text-base leading-relaxed text-text sm:text-sm',
  'placeholder:text-dim',
  'focus:border-phosphor',
  'transition-colors duration-150',
);

/** Los textarea de resultado: mismo control, borde de fósforo para marcar que es salida. */
export const OUTPUT_CONTROL = cn(
  'w-full resize-y border border-phosphor-dim bg-raised px-3 py-2.5 text-base leading-relaxed text-text sm:text-sm',
);

/** Botón compacto para el slot `trailing`, con área táctil de 44px en móvil. */
export const TRAILING_BUTTON = cn(
  'inline-flex min-h-11 items-center border border-line-bright px-2.5 text-[11px] tracking-[0.14em] text-muted uppercase sm:min-h-0 sm:py-1',
  'transition-[color,border-color,transform] duration-150',
  'hover:border-phosphor-dim hover:text-text active:scale-[0.97] active:border-phosphor',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

interface FieldProps {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  trailing?: ReactNode;
}

export function Field({ label, hint, htmlFor, children, trailing }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* items-center y no items-baseline: el slot `trailing` lleva botones con borde. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label
          htmlFor={htmlFor}
          className="text-[11px] tracking-[0.16em] text-muted uppercase"
        >
          <span className="mr-1.5 text-phosphor-dim">$</span>
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-dim">{hint}</p> : null}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  trailing?: ReactNode;
}

export function TextAreaField({ label, hint, trailing, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} trailing={trailing}>
      <textarea id={id} className={cn(CONTROL, className)} {...props} />
    </Field>
  );
}

interface PasswordFieldProps {
  label: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PasswordField({
  label,
  hint,
  trailing,
  value,
  onChange,
  placeholder,
  autoFocus,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} hint={hint} htmlFor={id} trailing={trailing}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          // pr-24 reserva el hueco del botón de al lado: si ese botón cambia de
          // ancho (texto, padding o tipografía) hay que recalcular esta reserva.
          className={cn(CONTROL, 'resize-none pr-24')}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          className="absolute top-1/2 right-2 inline-flex min-h-11 -translate-y-1/2 items-center border border-line-bright px-2 text-[11px] tracking-[0.14em] text-muted uppercase transition-[color,border-color,transform] duration-150 hover:border-phosphor-dim hover:text-text active:scale-[0.97] active:border-phosphor sm:min-h-0 sm:py-1"
        >
          {visible ? 'ocultar' : 'ver'}
        </button>
      </div>
    </Field>
  );
}
