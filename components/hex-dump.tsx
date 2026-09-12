'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import {
  CIPHERTEXT_OFFSET,
  HEADER_LEN_ENCRYPTED,
  IV_OFFSET,
  SALT_OFFSET,
  TAG_LEN,
} from '@/lib/payload';

interface Region {
  start: number;
  end: number;
  name: string;
  color: string;
}

/** Tramos del formato binario, para que el volcado explique la carga en vez de solo mostrarla. */
function regionsFor(length: number, encrypted: boolean): Region[] {
  if (!encrypted) {
    return [
      { start: 0, end: 1, name: 'modo', color: 'text-cyan' },
      { start: 1, end: length, name: 'secreto (en claro)', color: 'text-amber' },
    ];
  }

  return [
    { start: 0, end: 1, name: 'modo', color: 'text-cyan' },
    { start: 1, end: HEADER_LEN_ENCRYPTED, name: 'perfil KDF', color: 'text-cyan' },
    { start: SALT_OFFSET, end: IV_OFFSET, name: 'salt', color: 'text-phosphor' },
    { start: IV_OFFSET, end: CIPHERTEXT_OFFSET, name: 'iv', color: 'text-muted' },
    { start: CIPHERTEXT_OFFSET, end: length - TAG_LEN, name: 'criptograma', color: 'text-amber' },
    { start: length - TAG_LEN, end: length, name: 'tag', color: 'text-danger' },
  ].filter((region) => region.end > region.start);
}

const BYTES_PER_ROW = 16;

export function HexDump({ bytes, encrypted }: { bytes: Uint8Array; encrypted: boolean }) {
  const [open, setOpen] = useState(false);
  const regions = regionsFor(bytes.length, encrypted);

  function colorAt(index: number): string {
    return regions.find((region) => index >= region.start && index < region.end)?.color ?? 'text-dim';
  }

  const rows = Math.ceil(bytes.length / BYTES_PER_ROW);

  return (
    <div className="border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] tracking-[0.14em] text-muted uppercase transition-colors hover:text-text"
      >
        <span className="text-phosphor-dim">{open ? '▼' : '▶'}</span>
        volcado hexadecimal · {bytes.length} bytes
      </button>

      {open ? (
        <div className="border-t border-line px-3 py-3">
          <div className="overflow-x-auto">
            <pre className="text-[11px] leading-5">
              {Array.from({ length: rows }, (_, row) => {
                const offset = row * BYTES_PER_ROW;
                const slice = Array.from(bytes.subarray(offset, offset + BYTES_PER_ROW));

                return (
                  <div key={offset} className="whitespace-pre">
                    <span className="text-dim">{offset.toString(16).padStart(4, '0')}</span>
                    <span className="text-line-bright"> │ </span>
                    {slice.map((byte, index) => (
                      <span key={index} className={colorAt(offset + index)}>
                        {byte.toString(16).padStart(2, '0')}
                        {index === 7 ? '  ' : ' '}
                      </span>
                    ))}
                  </div>
                );
              })}
            </pre>
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px] tracking-[0.12em] uppercase">
            {regions.map((region) => (
              <li key={region.name} className={cn('flex items-center gap-1.5', region.color)}>
                <span aria-hidden>■</span>
                {region.name}
                <span className="text-dim">{region.end - region.start}B</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
