import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'border-phosphor-dim bg-phosphor/10 text-phosphor hover:bg-phosphor/20 hover:border-phosphor',
  ghost: 'border-line-bright bg-transparent text-muted hover:border-phosphor-dim hover:text-text',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 border px-4 py-2 text-xs tracking-[0.18em] uppercase',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-dim disabled:opacity-70',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
