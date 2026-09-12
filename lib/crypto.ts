/**
 * Cifrado autenticado con clave derivada de contraseña, sobre WebCrypto nativo.
 *
 * PBKDF2-HMAC-SHA256 (600.000 iteraciones, el mínimo que recomienda OWASP para
 * SHA-256) + AES-256-GCM. Sin dependencias externas.
 *
 * Un apunte sobre el modelo de amenaza, porque condiciona los parámetros: aquí el
 * criptograma viaja en público dentro del mensaje compartido, así que quien lo
 * reciba puede atacarlo sin conexión y sin límite de intentos. El KDF es el único
 * freno real, de ahí el coste deliberadamente alto y el salt nuevo en cada mensaje.
 */

import type { Bytes } from './bytes';

import { IV_LEN, SALT_LEN } from './payload';

/** Mínimo OWASP para PBKDF2-HMAC-SHA256. Nunca bajarlo en producción. */
export const PBKDF2_ITERATIONS = 600_000;

const AES_KEY_BITS = 256;
const GCM_TAG_BITS = 128;

export class WrongPasswordError extends Error {
  constructor(message = 'Contraseña incorrecta o mensaje alterado') {
    super(message);
    this.name = 'WrongPasswordError';
  }
}

const encoder = new TextEncoder();

/**
 * Normaliza a NFC antes de codificar.
 *
 * Sin esto, una «ó» tecleada en macOS (o + acento combinante) y la misma «ó» en
 * Windows (carácter precompuesto) producen bytes distintos, claves distintas y un
 * fallo de descifrado sin causa aparente. Escribiendo en español es un caso muy real.
 */
function passwordBytes(password: string): Bytes {
  return encoder.encode(password.normalize('NFC'));
}

export async function deriveKey(
  password: string,
  salt: Bytes,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', passwordBytes(password), 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedBundle {
  salt: Bytes;
  iv: Bytes;
  /** Incluye el tag de autenticación de 16 bytes al final. */
  ciphertext: Bytes;
}

export async function encrypt(
  plaintext: Bytes,
  password: string,
  additionalData: Bytes,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<EncryptedBundle> {
  // Salt e IV frescos en cada llamada: reutilizarlos con la misma clave rompe GCM.
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt, iterations);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData, tagLength: GCM_TAG_BITS },
    key,
    plaintext,
  );

  return { salt, iv, ciphertext: new Uint8Array(ciphertext) };
}

export async function decrypt(
  bundle: EncryptedBundle,
  password: string,
  additionalData: Bytes,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<Bytes> {
  const key = await deriveKey(password, bundle.salt, iterations);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bundle.iv, additionalData, tagLength: GCM_TAG_BITS },
      key,
      bundle.ciphertext,
    );
    return new Uint8Array(plaintext);
  } catch {
    // AES-GCM es autenticado: si el tag no cuadra es que la contraseña no es la
    // correcta o alguien tocó el mensaje. No hay forma de distinguir ambos casos,
    // y tampoco conviene: devolver basura en vez de un error sería peor.
    throw new WrongPasswordError();
  }
}
