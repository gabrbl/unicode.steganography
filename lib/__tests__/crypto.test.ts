import { describe, expect, it } from 'vitest';
import { decrypt, deriveKey, encrypt, PBKDF2_ITERATIONS, WrongPasswordError } from '../crypto';
import { headerBytes, IV_LEN, KDF_PBKDF2_SHA256_600K, SALT_LEN } from '../payload';

// Las iteraciones reales harían la suite insoportablemente lenta. El default de
// producción se comprueba aparte, como constante.
const FAST = 1_000;

const aad = headerBytes(KDF_PBKDF2_SHA256_600K);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const plaintext = encoder.encode('el mensaje que nadie debería leer');

describe('parámetros', () => {
  it('mantiene el mínimo que recomienda OWASP para PBKDF2-HMAC-SHA256', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });
});

describe('encrypt / decrypt', () => {
  it('recupera el texto original con la contraseña correcta', async () => {
    const bundle = await encrypt(plaintext, 'contraseña-correcta', aad, FAST);
    const recovered = await decrypt(bundle, 'contraseña-correcta', aad, FAST);

    expect(decoder.decode(recovered)).toBe('el mensaje que nadie debería leer');
  });

  it('genera salt e iv del tamaño previsto y distintos en cada llamada', async () => {
    const a = await encrypt(plaintext, 'clave', aad, FAST);
    const b = await encrypt(plaintext, 'clave', aad, FAST);

    expect(a.salt).toHaveLength(SALT_LEN);
    expect(a.iv).toHaveLength(IV_LEN);
    expect(a.salt).not.toEqual(b.salt);
    expect(a.iv).not.toEqual(b.iv);
    // Misma contraseña y mismo texto, criptogramas distintos: no hay fuga por repetición.
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('añade exactamente el tag de 16 bytes al criptograma', async () => {
    const bundle = await encrypt(plaintext, 'clave', aad, FAST);
    expect(bundle.ciphertext.length).toBe(plaintext.length + 16);
  });

  it('falla con WrongPasswordError si la contraseña no es la correcta', async () => {
    const bundle = await encrypt(plaintext, 'la-buena', aad, FAST);
    await expect(decrypt(bundle, 'la-mala', aad, FAST)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('detecta que el criptograma ha sido manipulado', async () => {
    const bundle = await encrypt(plaintext, 'clave', aad, FAST);
    bundle.ciphertext[0] ^= 0x01;

    await expect(decrypt(bundle, 'clave', aad, FAST)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('detecta que la cabecera autenticada ha sido manipulada', async () => {
    const bundle = await encrypt(plaintext, 'clave', aad, FAST);
    const tampered = Uint8Array.from(aad);
    tampered[1] = 0x02;

    await expect(decrypt(bundle, 'clave', tampered, FAST)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('cifra y descifra un secreto vacío', async () => {
    const bundle = await encrypt(new Uint8Array(0), 'clave', aad, FAST);
    expect(await decrypt(bundle, 'clave', aad, FAST)).toEqual(new Uint8Array(0));
  });
});

describe('normalización de la contraseña', () => {
  it('trata como iguales las formas precompuesta y descompuesta', async () => {
    // «contraseña» tecleada en macOS (n + tilde combinante) frente a Windows (ñ precompuesta).
    const precomposed = 'contrase\u00F1a';
    const decomposed = 'contrasen\u0303a';
    expect(precomposed).not.toBe(decomposed);

    const bundle = await encrypt(plaintext, precomposed, aad, FAST);
    const recovered = await decrypt(bundle, decomposed, aad, FAST);

    expect(decoder.decode(recovered)).toBe('el mensaje que nadie debería leer');
  });

  it('sigue distinguiendo contraseñas realmente distintas', async () => {
    const bundle = await encrypt(plaintext, 'cafe', aad, FAST);
    await expect(decrypt(bundle, 'café', aad, FAST)).rejects.toBeInstanceOf(WrongPasswordError);
  });
});

describe('deriveKey', () => {
  it('produce una clave AES-GCM no exportable', async () => {
    const salt = new Uint8Array(SALT_LEN);
    const key = await deriveKey('clave', salt, FAST);

    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(expect.arrayContaining(['encrypt', 'decrypt']));
  });
});
