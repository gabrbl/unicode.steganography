/**
 * Códec de bytes <-> Unicode variation selectors.
 *
 * Unicode define exactamente 256 variation selectors repartidos en dos bloques:
 *
 *   VS1..VS16     U+FE00..U+FE0F     16 selectores  ->  bytes 0x00..0x0F
 *   VS17..VS256   U+E0100..U+E01EF   240 selectores ->  bytes 0x10..0xFF
 *
 * Esa correspondencia exacta de 256 con el rango de un byte es lo que hace
 * viable la técnica. Un variation selector no tiene glifo propio: adosado a un
 * carácter base es invisible, y el estándar exige preservarlo aunque el sistema
 * no reconozca su función, así que sobrevive al copiar y pegar.
 */

const VS_LOW_START = 0xfe00;
const VS_LOW_END = 0xfe0f;
const VS_HIGH_START = 0xe0100;
const VS_HIGH_END = 0xe01ef;

/** Cuántos valores de byte cubre el bloque bajo (VS1..VS16). */
const LOW_BLOCK_SIZE = 16;

/** Convierte un byte (0..255) en el code point del variation selector que lo representa. */
import type { Bytes } from './bytes';


export function byteToCodePoint(byte: number): number {
  if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
    throw new RangeError(`Byte fuera de rango: ${byte}`);
  }
  return byte < LOW_BLOCK_SIZE
    ? VS_LOW_START + byte
    : VS_HIGH_START + (byte - LOW_BLOCK_SIZE);
}

/** Convierte un code point en su byte, o null si no es un variation selector. */
export function codePointToByte(codePoint: number): number | null {
  if (codePoint >= VS_LOW_START && codePoint <= VS_LOW_END) {
    return codePoint - VS_LOW_START;
  }
  if (codePoint >= VS_HIGH_START && codePoint <= VS_HIGH_END) {
    return codePoint - VS_HIGH_START + LOW_BLOCK_SIZE;
  }
  return null;
}

export function isVariationSelector(codePoint: number): boolean {
  return codePointToByte(codePoint) !== null;
}

/**
 * Los selectores del bloque bajo (U+FE00..U+FE0F) sí tienen significado definido
 * para ciertos caracteres: VS15 y VS16 alternan la presentación texto/emoji. Si el
 * primer selector de una carga cayera ahí, podría alterar el renderizado del
 * carácter portador y delatar el mensaje. El bloque suplementario, en cambio, no
 * define ninguna secuencia de variación, así que siempre se ignora al renderizar.
 */
export function isSupplementarySelector(codePoint: number): boolean {
  return codePoint >= VS_HIGH_START && codePoint <= VS_HIGH_END;
}

export function bytesToSelectors(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += String.fromCodePoint(byteToCodePoint(byte));
  }
  return out;
}

/**
 * Decodifica todos los variation selectors del texto, ignorando el resto.
 *
 * Recorre por code points: U+E0100 está fuera del BMP y en JavaScript ocupa un
 * par suplente, así que iterar por índice de unidad de código corrompería los datos.
 */
export function selectorsToBytes(text: string): Bytes {
  const bytes: number[] = [];
  for (const char of text) {
    const byte = codePointToByte(char.codePointAt(0)!);
    if (byte !== null) bytes.push(byte);
  }
  return Uint8Array.from(bytes);
}

/**
 * Devuelve cada racha contigua de variation selectors ya decodificada a bytes.
 *
 * Separar por rachas (en lugar de concatenar todos los selectores del texto)
 * permite que convivan varias cargas en un mismo texto y evita que selectores
 * legítimos sueltos —un ❤️ con su VS16— contaminen la carga real.
 */
export function extractSelectorRuns(text: string): Bytes[] {
  const runs: Bytes[] = [];
  let current: number[] = [];

  for (const char of text) {
    const byte = codePointToByte(char.codePointAt(0)!);
    if (byte !== null) {
      current.push(byte);
    } else if (current.length > 0) {
      runs.push(Uint8Array.from(current));
      current = [];
    }
  }
  if (current.length > 0) runs.push(Uint8Array.from(current));

  return runs;
}

/**
 * Elimina todos los variation selectors del texto.
 *
 * Ojo: borra *todos*, incluidos los legítimos. Un ❤️ (U+2764 U+FE0F) pierde su
 * VS16 y pasa a renderizarse como corazón de texto ❤. Es el comportamiento que se
 * espera de un saneador, pero no sirve para comprobar si un texto fue alterado.
 */
export function stripVariationSelectors(text: string): string {
  let out = '';
  for (const char of text) {
    if (!isVariationSelector(char.codePointAt(0)!)) out += char;
  }
  return out;
}
