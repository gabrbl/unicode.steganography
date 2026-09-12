'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { DecodePanel } from '@/components/decode-panel';
import { EncodePanel } from '@/components/encode-panel';
import { cn } from '@/lib/cn';

const TABS = [
  { id: 'encode', label: 'ocultar' },
  { id: 'decode', label: 'revelar' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function StegoApp() {
  const [active, setActive] = useState<TabId>('encode');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (offset === 0) return;

    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === active);
    const next = TABS[(index + offset + TABS.length) % TABS.length];

    setActive(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <section className="border border-line-bright bg-bg">
      <div role="tablist" aria-label="Modo" className="flex border-b border-line">
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={onKeyDown}
              className={cn(
                'min-h-11 flex-1 border-r border-line px-4 py-3 text-xs tracking-[0.2em] uppercase last:border-r-0',
                'transition-colors duration-150',
                selected
                  ? 'bg-phosphor/10 text-phosphor'
                  : 'text-dim hover:bg-surface hover:text-muted active:bg-surface',
              )}
            >
              {selected ? <span className="mr-2 text-phosphor-dim">▚</span> : null}
              {tab.label}
            </button>
          );
        })}
      </div>

      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
          className="p-4 sm:p-7"
        >
          {tab.id === 'encode' ? <EncodePanel /> : <DecodePanel />}
        </div>
      ))}
    </section>
  );
}
