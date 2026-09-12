/**
 * Formato binario de la carga oculta.
 *
 *   byte 0        magic + modo    0xA1 = texto plano | 0xA2 = cifrado
 *   byte 1        perfil KDF      0x01 = PBKDF2-SHA256/600k + AES-256-GCM   (solo cifrado)
 *   bytes 2..17   salt (16)                                                 (solo cifrado)
 *   bytes 18..29  iv (12)                                                   (solo cifrado)
 *   resto         ciphertext || tag(16), o el UTF-8 en claro si el modo es 0xA1
 *
 * Los magic valen 0xA1 y 0xA2 a propósito: al ser >= 0x10 garantizan que el primer
 * selector emitido cae siempre en el bloque suplementario (U+E0100+), que no define
 * secuencias de variación para ningún carácter y por tanto nunca altera el
 * renderizado del carácter portador.
 */

import type { Bytes } from './bytes';


export const MAGIC_PLAIN = 0xa1;
export const MAGIC_ENCRYPTED = 0xa2;

/** Único perfil definido hoy. El byte queda reservado para migrar a Argon2id sin romper mensajes antiguos. */
export const KDF_PBKDF2_SHA256_600K = 0x01;

export const SALT_LEN = 16;
export const IV_LEN = 12;
export const TAG_LEN = 16;

export const HEADER_LEN_ENCRYPTED = 2;
export const SALT_OFFSET = HEADER_LEN_ENCRYPTED;
export const IV_OFFSET = SALT_OFFSET + SALT_LEN;
export const CIPHERTEXT_OFFSET = IV_OFFSET + IV_LEN;

/** Bytes que añade el cifrado frente al texto plano: 1 magic + 1 perfil + salt + iv + tag = 46. */
export const ENCRYPTED_OVERHEAD = CIPHERTEXT_OFFSET + TAG_LEN;

export type Payload =
  | { mode: 'plain'; data: Bytes }
  | {
      mode: 'encrypted';
      kdfProfile: number;
      salt: Bytes;
      iv: Bytes;
      ciphertext: Bytes;
    };

export class CorruptPayloadError extends Error {
  constructor(message = 'La carga oculta está incompleta o dañada') {
    super(message);
    this.name = 'CorruptPayloadError';
  }
}

/**
 * Cabecera que se autentica como datos asociados (AAD) del AES-GCM.
 * Sale gratis y hace que manipular el byte de modo o el de perfil KDF
 * invalide el tag en lugar de pasar desapercibido.
 */
export function headerBytes(kdfProfile: number): Bytes {
  return Uint8Array.from([MAGIC_ENCRYPTED, kdfProfile]);
}

export function encodePayload(payload: Payload): Bytes {
  if (payload.mode === 'plain') {
    const out = new Uint8Array(1 + payload.data.length);
    out[0] = MAGIC_PLAIN;
    out.set(payload.data, 1);
    return out;
  }

  const out = new Uint8Array(CIPHERTEXT_OFFSET + payload.ciphertext.length);
  out[0] = MAGIC_ENCRYPTED;
  out[1] = payload.kdfProfile;
  out.set(payload.salt, SALT_OFFSET);
  out.set(payload.iv, IV_OFFSET);
  out.set(payload.ciphertext, CIPHERTEXT_OFFSET);
  return out;
}

export function decodePayload(bytes: Bytes): Payload {
  if (bytes.length === 0) throw new CorruptPayloadError('Carga vacía');

  if (bytes[0] === MAGIC_PLAIN) {
    return { mode: 'plain', data: bytes.subarray(1) };
  }

  if (bytes[0] === MAGIC_ENCRYPTED) {
    if (bytes.length < ENCRYPTED_OVERHEAD) {
      throw new CorruptPayloadError('La carga cifrada está truncada');
    }
    const kdfProfile = bytes[1];
    if (kdfProfile !== KDF_PBKDF2_SHA256_600K) {
      throw new CorruptPayloadError(`Perfil de derivación de clave desconocido: 0x${kdfProfile.toString(16)}`);
    }
    return {
      mode: 'encrypted',
      kdfProfile,
      salt: bytes.subarray(SALT_OFFSET, IV_OFFSET),
      iv: bytes.subarray(IV_OFFSET, CIPHERTEXT_OFFSET),
      ciphertext: bytes.subarray(CIPHERTEXT_OFFSET),
    };
  }

  throw new CorruptPayloadError('No se reconoce la cabecera de la carga');
}

/**
 * Devuelve todas las cargas que podrían empezar en esta racha de selectores.
 *
 * No basta con mirar el byte 0: si el texto portador termina en un emoji que ya
 * lleva su propio selector —como ❤️, que arrastra un VS16— la racha empieza con
 * ese byte ajeno y nuestra carga viene justo detrás.
 *
 * Y tampoco basta con quedarse en el primer magic que aparezca: un 0xA1 o 0xA2
 * fortuito dentro de datos ajenos puede decodificar como carga «válida» en
 * apariencia y tapar la real. Se devuelven todos los candidatos en orden para que
 * quien llame los pruebe hasta que uno descifre o decodifique de verdad.
 */
export function findPayloadCandidates(run: Bytes): Array<{ payload: Payload; offset: number }> {
  const candidates: Array<{ payload: Payload; offset: number }> = [];

  for (let offset = 0; offset < run.length; offset++) {
    if (run[offset] !== MAGIC_PLAIN && run[offset] !== MAGIC_ENCRYPTED) continue;
    try {
      candidates.push({ payload: decodePayload(run.subarray(offset)), offset });
    } catch {
      // Un magic por casualidad seguido de algo que no encaja: no es candidato.
    }
  }

  return candidates;
}
