'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
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

/**
 * Una fila de 16 bytes mide unos 370px y en un móvil solo hay ~275px libres, así
 * que desbordaba y dejaba un scroll horizontal anidado peleando con el vertical.
 * A 8 bytes la fila cabe entera.
 */
const BYTES_PER_ROW_WIDE = 16;
const BYTES_PER_ROW_NARROW = 8;

export function HexDump({ bytes, encrypted }: { bytes: Uint8Array; encrypted: boolean }) {
  const [open, setOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 640px)', true);
  const bytesPerRow = wide ? BYTES_PER_ROW_WIDE : BYTES_PER_ROW_NARROW;
  const regions = regionsFor(bytes.length, encrypted);

  function colorAt(index: number): string {
    return regions.find((region) => index >= region.start && index < region.end)?.color ?? 'text-dim';
  }

  const rows = Math.ceil(bytes.length / bytesPerRow);

  return (
    <div className="border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-[11px] tracking-[0.14em] text-muted uppercase transition-colors hover:text-text active:text-text sm:min-h-0"
      >
        <span className="text-phosphor-dim">{open ? '▼' : '▶'}</span>
        volcado hexadecimal · {bytes.length} bytes
      </button>

      {open ? (
        <div className="border-t border-line px-3 py-3">
          {/* overscroll-contain evita que al llegar al final del scroll lateral el
              gesto se propague y dispare el swipe-back de iOS. */}
          <div className="overflow-x-auto overscroll-x-contain">
            <pre className="text-[11px] leading-5">
              {Array.from({ length: rows }, (_, row) => {
                const offset = row * bytesPerRow;
                const slice = Array.from(bytes.subarray(offset, offset + bytesPerRow));

                return (
                  <div key={offset} className="whitespace-pre">
                    <span className="text-dim">{offset.toString(16).padStart(4, '0')}</span>
                    <span className="text-line-bright"> │ </span>
                    {slice.map((byte, index) => (
                      <span key={index} className={colorAt(offset + index)}>
                        {byte.toString(16).padStart(2, '0')}
                        {/* Respiro a mitad de fila, solo cuando la fila es larga. */}
                        {wide && index === 7 ? '  ' : ' '}
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
