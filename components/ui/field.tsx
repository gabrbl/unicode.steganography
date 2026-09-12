'use client';

import { useId, useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL = cn(
  'w-full resize-y border border-line-bright bg-surface px-3 py-2.5 text-sm leading-relaxed text-text',
  'placeholder:text-dim',
  'focus:border-phosphor',
  'transition-colors duration-150',
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
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
          className={cn(CONTROL, 'resize-none pr-24')}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          className="absolute top-1/2 right-2 -translate-y-1/2 border border-line-bright px-2 py-1 text-[11px] tracking-[0.14em] text-muted uppercase transition-colors hover:border-phosphor-dim hover:text-text"
        >
          {visible ? 'ocultar' : 'ver'}
        </button>
      </div>
    </Field>
  );
}
