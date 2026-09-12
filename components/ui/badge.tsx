import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'phosphor' | 'amber' | 'danger' | 'neutral' | 'cyan';

const TONES: Record<Tone, string> = {
  phosphor: 'border-phosphor-dim text-phosphor',
  amber: 'border-amber/50 text-amber',
  danger: 'border-danger/50 text-danger',
  cyan: 'border-cyan/40 text-cyan',
  neutral: 'border-line-bright text-muted',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] tracking-[0.14em] uppercase',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const CALLOUT_TONES: Record<Tone, string> = {
  phosphor: 'border-l-phosphor-dim bg-phosphor/5 text-muted',
  amber: 'border-l-amber bg-amber/5 text-amber/90',
  danger: 'border-l-danger bg-danger/5 text-danger/90',
  cyan: 'border-l-cyan bg-cyan/5 text-cyan/90',
  neutral: 'border-l-line-bright bg-surface text-muted',
};

export function Callout({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <p
      className={cn(
        'border-l-2 py-2 pr-3 pl-3 text-xs leading-relaxed',
        CALLOUT_TONES[tone],
      )}
    >
      {children}
    </p>
  );
}
