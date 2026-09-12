import { describe, expect, it } from 'vitest';
import {
  byteToCodePoint,
  bytesToSelectors,
  codePointToByte,
  extractSelectorRuns,
  isSupplementarySelector,
  isVariationSelector,
  selectorsToBytes,
  stripVariationSelectors,
} from '../variation-selectors';

describe('byteToCodePoint / codePointToByte', () => {
  it('mapea los 256 bytes de ida y vuelta sin colisiones', () => {
    const codePoints = new Set<number>();

    for (let byte = 0; byte <= 0xff; byte++) {
      const cp = byteToCodePoint(byte);
      expect(codePointToByte(cp)).toBe(byte);
      codePoints.add(cp);
    }

    expect(codePoints.size).toBe(256);
  });

  it('coloca la frontera de bloque entre el byte 15 y el 16', () => {
    expect(byteToCodePoint(0)).toBe(0xfe00);
    expect(byteToCodePoint(15)).toBe(0xfe0f);
    expect(byteToCodePoint(16)).toBe(0xe0100);
    expect(byteToCodePoint(255)).toBe(0xe01ef);
  });

  it('rechaza valores fuera del rango de un byte', () => {
    expect(() => byteToCodePoint(-1)).toThrow(RangeError);
    expect(() => byteToCodePoint(256)).toThrow(RangeError);
    expect(() => byteToCodePoint(1.5)).toThrow(RangeError);
  });

  it('devuelve null para code points que no son selectores', () => {
    for (const cp of [0x41, 0xfdff, 0xfe10, 0xe00ff, 0xe01f0, 0x1f600]) {
      expect(codePointToByte(cp)).toBeNull();
      expect(isVariationSelector(cp)).toBe(false);
    }
  });

  it('distingue el bloque suplementario del bajo', () => {
    expect(isSupplementarySelector(0xfe0f)).toBe(false);
    expect(isSupplementarySelector(0xe0100)).toBe(true);
  });
});

describe('bytesToSelectors / selectorsToBytes', () => {
  it('conserva los datos aunque los selectores sean pares suplentes', () => {
    const bytes = Uint8Array.from([0x00, 0x0f, 0x10, 0x7f, 0xa2, 0xff]);
    const text = bytesToSelectors(bytes);

    // Los bytes >= 16 viven fuera del BMP y ocupan dos unidades de código cada uno.
    expect([...text].length).toBe(6);
    expect(text.length).toBe(2 + 4 * 2);
    expect(selectorsToBytes(text)).toEqual(bytes);
  });

  it('ignora todo lo que no sea un selector', () => {
    const bytes = Uint8Array.from([0xa1, 0x42]);
    const noisy = `hola ${bytesToSelectors(bytes)} mundo 😀`;
    expect(selectorsToBytes(noisy)).toEqual(bytes);
  });

  it('devuelve vacío cuando no hay nada oculto', () => {
    expect(selectorsToBytes('texto normal')).toEqual(new Uint8Array(0));
  });
});

describe('extractSelectorRuns', () => {
  it('separa las rachas interrumpidas por caracteres visibles', () => {
    const a = Uint8Array.from([0xa1, 0x01]);
    const b = Uint8Array.from([0xa2, 0x02, 0x03]);
    const text = `x${bytesToSelectors(a)}y${bytesToSelectors(b)}z`;

    expect(extractSelectorRuns(text)).toEqual([a, b]);
  });

  it('cierra la racha que llega al final del texto', () => {
    const bytes = Uint8Array.from([0xa1, 0x7a]);
    expect(extractSelectorRuns(`fin${bytesToSelectors(bytes)}`)).toEqual([bytes]);
  });

  it('no devuelve rachas si no hay selectores', () => {
    expect(extractSelectorRuns('nada que ver')).toEqual([]);
  });
});

describe('stripVariationSelectors', () => {
  it('recupera el texto original', () => {
    const visible = 'Hola, ¿qué tal? 😀';
    const dirty = visible + bytesToSelectors(Uint8Array.from([0xa1, 0x00, 0xff]));
    expect(stripVariationSelectors(dirty)).toBe(visible);
  });
});
