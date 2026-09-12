/**
 * API de alto nivel: ocultar un secreto dentro de un texto visible y recuperarlo.
 */

import type { Bytes } from './bytes';

import { decrypt, encrypt, PBKDF2_ITERATIONS, WrongPasswordError } from './crypto';
import {
  encodePayload,
  findPayloadCandidates,
  headerBytes,
  KDF_PBKDF2_SHA256_600K,
  type Payload,
} from './payload';
import { bytesToSelectors, extractSelectorRuns } from './variation-selectors';

/** Carácter de reserva cuando no hay texto visible donde anclar los selectores. */
export const DEFAULT_CARRIER = '·';

const encoder = new TextEncoder();
// `fatal` hace que un UTF-8 inválido lance en vez de devolver caracteres de reemplazo:
// así distinguimos una carga dañada de un secreto legítimo.
const decoder = new TextDecoder('utf-8', { fatal: true });
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Inserta los selectores justo detrás del último grafema visible del texto.
 *
 * Dos motivos para hacerlo así. Uno: un variation selector solo es invisible si va
 * adosado a un carácter base; suelto o tras un espacio final algunos renderizadores
 * dibujan un cuadrito. Dos: se ancla al último *grafema* y no a la última unidad de
 * código porque partir un emoji compuesto con ZWJ, una bandera o una secuencia que
 * ya arrastra su VS16 rompería el texto visible.
 */
function anchorSelectors(visibleText: string, selectors: string, carrier: string): string {
  const segments = [...segmenter.segment(visibleText)];

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    if (segment.segment.trim() === '') continue;

    const end = segment.index + segment.segment.length;
    return visibleText.slice(0, end) + selectors + visibleText.slice(end);
  }

  // Texto vacío o solo espacios: no hay carácter base que sostenga los selectores.
  return visibleText + carrier + selectors;
}

export interface HideOptions {
  visibleText: string;
  secret: string;
  /** Si se omite o va vacía, el secreto viaja en claro. */
  password?: string;
  carrier?: string;
  /** Solo para tests: el default de producción es el mínimo OWASP. */
  iterations?: number;
}

export interface HideResult {
  /** El texto visible, intacto, con la carga invisible incrustada. */
  text: string;
  payload: Bytes;
  encrypted: boolean;
}

export async function hide({
  visibleText,
  secret,
  password,
  carrier = DEFAULT_CARRIER,
  iterations = PBKDF2_ITERATIONS,
}: HideOptions): Promise<HideResult> {
  const secretBytes = encoder.encode(secret);

  let payload: Payload;
  if (password && password.length > 0) {
    const kdfProfile = KDF_PBKDF2_SHA256_600K;
    const bundle = await encrypt(secretBytes, password, headerBytes(kdfProfile), iterations);
    payload = { mode: 'encrypted', kdfProfile, ...bundle };
  } else {
    payload = { mode: 'plain', data: secretBytes };
  }

  const encoded = encodePayload(payload);

  return {
    text: anchorSelectors(visibleText, bytesToSelectors(encoded), carrier),
    payload: encoded,
    encrypted: payload.mode === 'encrypted',
  };
}

export type RevealResult =
  | { status: 'none' }
  | { status: 'plain'; secret: string }
  | { status: 'encrypted'; secret: string }
  | { status: 'password-required' }
  | { status: 'wrong-password' }
  | { status: 'corrupt' };

/**
 * Tope de cargas candidatas a examinar. En la práctica siempre hay una; el límite
 * está para que un texto preparado con muchos magic falsos no dispare decenas de
 * derivaciones PBKDF2 y congele el navegador de quien lo pega.
 */
const MAX_CANDIDATES = 8;

interface Candidate {
  payload: Payload;
  byteLength: number;
}

function findCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];

  for (const run of extractSelectorRuns(text)) {
    for (const { payload, offset } of findPayloadCandidates(run)) {
      candidates.push({ payload, byteLength: run.length - offset });
      if (candidates.length >= MAX_CANDIDATES) return candidates;
    }
  }

  return candidates;
}

export interface PayloadInfo {
  encrypted: boolean;
  payloadBytes: number;
}

/**
 * Inspección síncrona y sin contraseña, para que la interfaz pueda avisar en vivo
 * de que un texto pegado lleva carga antes de pedir nada al usuario.
 */
export function inspect(text: string): PayloadInfo | null {
  const [first] = findCandidates(text);
  if (!first) return null;

  return {
    encrypted: first.payload.mode === 'encrypted',
    payloadBytes: first.byteLength,
  };
}

/**
 * Resuelve todo lo que no necesita la contraseña, de forma síncrona.
 *
 * Una carga en claro no requiere criptografía, así que puede resolverse durante el
 * render y mostrarse sin parpadeo ni efectos. Si lo que hay es una carga cifrada,
 * devuelve `password-required` y el trabajo pasa a `reveal`.
 */
export function revealPlain(text: string): RevealResult {
  const candidates = findCandidates(text);
  if (candidates.length === 0) return { status: 'none' };

  // Los candidatos vienen ordenados por offset y gana el primero que resuelva.
  //
  // El orden importa: el salt, el iv y el criptograma de una carga cifrada son
  // ~50 bytes pseudoaleatorios, así que alguno vale 0xA1 —el magic de texto
  // plano— una de cada seis veces. Eso genera candidatos «planos» espurios en
  // offsets posteriores. Si se les diera prioridad taparían la carga cifrada
  // real del offset 0, y como reveal() corta cuando el estado no es
  // 'password-required', ni siquiera la contraseña correcta la recuperaría.
  //
  // El caso simétrico no preocupa: para que un candidato cifrado espurio tapara
  // una carga plana real haría falta la pareja exacta 0xA2 0x01 dentro de datos
  // que son UTF-8 válido, y ahí 0xA2 solo aparece como byte de continuación,
  // nunca seguido de un 0x01.
  for (const { payload } of candidates) {
    if (payload.mode === 'encrypted') return { status: 'password-required' };

    const secret = decodeUtf8(payload.data);
    if (secret !== null) return { status: 'plain', secret };
  }

  return { status: 'corrupt' };
}

export async function reveal(
  text: string,
  password?: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<RevealResult> {
  const withoutPassword = revealPlain(text);

  // 'password-required' es el único estado que puede mejorar con la contraseña.
  if (withoutPassword.status !== 'password-required') return withoutPassword;
  if (!password || password.length === 0) return withoutPassword;

  for (const { payload } of findCandidates(text)) {
    if (payload.mode !== 'encrypted') continue;

    try {
      const plaintext = await decrypt(
        payload,
        password,
        headerBytes(payload.kdfProfile),
        iterations,
      );
      const secret = decodeUtf8(plaintext);
      if (secret !== null) return { status: 'encrypted', secret };
    } catch (error) {
      // Un candidato que no descifra puede ser un falso positivo; seguimos con el resto.
      if (!(error instanceof WrongPasswordError)) throw error;
    }
  }

  return { status: 'wrong-password' };
}
