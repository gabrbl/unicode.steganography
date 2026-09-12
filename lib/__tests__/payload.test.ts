import { describe, expect, it } from 'vitest';
import {
  CorruptPayloadError,
  decodePayload,
  encodePayload,
  ENCRYPTED_OVERHEAD,
  findPayloadCandidates,
  headerBytes,
  IV_LEN,
  KDF_PBKDF2_SHA256_600K,
  MAGIC_ENCRYPTED,
  MAGIC_PLAIN,
  SALT_LEN,
  type Payload,
} from '../payload';
import { bytesToSelectors, isSupplementarySelector } from '../variation-selectors';

const salt = Uint8Array.from({ length: SALT_LEN }, (_, i) => i);
const iv = Uint8Array.from({ length: IV_LEN }, (_, i) => 100 + i);
const ciphertext = Uint8Array.from({ length: 20 }, (_, i) => 200 + (i % 50));

const encryptedPayload: Payload = {
  mode: 'encrypted',
  kdfProfile: KDF_PBKDF2_SHA256_600K,
  salt,
  iv,
  ciphertext,
};

describe('formato', () => {
  it('el overhead cifrado es de 46 bytes', () => {
    expect(ENCRYPTED_OVERHEAD).toBe(46);
    expect(encodePayload(encryptedPayload).length).toBe(ENCRYPTED_OVERHEAD - 16 + ciphertext.length);
  });

  it('los magic caen por encima de 0x0F, así el primer selector va al bloque suplementario', () => {
    // Esto es lo que evita que la carga altere el renderizado del carácter portador:
    // un primer selector en U+FE00..U+FE0F podría cambiar la presentación texto/emoji.
    for (const magic of [MAGIC_PLAIN, MAGIC_ENCRYPTED]) {
      expect(magic).toBeGreaterThan(0x0f);
    }

    for (const payload of [{ mode: 'plain', data: new Uint8Array(0) } as Payload, encryptedPayload]) {
      const selectors = bytesToSelectors(encodePayload(payload));
      expect(isSupplementarySelector(selectors.codePointAt(0)!)).toBe(true);
    }
  });

  it('la cabecera autenticada describe modo y perfil de KDF', () => {
    expect(headerBytes(KDF_PBKDF2_SHA256_600K)).toEqual(
      Uint8Array.from([MAGIC_ENCRYPTED, KDF_PBKDF2_SHA256_600K]),
    );
  });
});

describe('encodePayload / decodePayload', () => {
  it('va y vuelve en texto plano', () => {
    const data = new TextEncoder().encode('secreto en claro');
    const decoded = decodePayload(encodePayload({ mode: 'plain', data }));

    expect(decoded.mode).toBe('plain');
    if (decoded.mode !== 'plain') throw new Error('modo inesperado');
    expect(decoded.data).toEqual(data);
  });

  it('va y vuelve cifrado conservando salt, iv y criptograma', () => {
    const decoded = decodePayload(encodePayload(encryptedPayload));

    expect(decoded.mode).toBe('encrypted');
    if (decoded.mode !== 'encrypted') throw new Error('modo inesperado');
    expect(decoded.kdfProfile).toBe(KDF_PBKDF2_SHA256_600K);
    expect(decoded.salt).toEqual(salt);
    expect(decoded.iv).toEqual(iv);
    expect(decoded.ciphertext).toEqual(ciphertext);
  });

  it('acepta un secreto vacío en claro', () => {
    const decoded = decodePayload(encodePayload({ mode: 'plain', data: new Uint8Array(0) }));
    if (decoded.mode !== 'plain') throw new Error('modo inesperado');
    expect(decoded.data.length).toBe(0);
  });

  it('rechaza carga vacía, magic desconocido, truncamiento y perfil KDF no soportado', () => {
    expect(() => decodePayload(new Uint8Array(0))).toThrow(CorruptPayloadError);
    expect(() => decodePayload(Uint8Array.from([0x42, 0x01]))).toThrow(CorruptPayloadError);

    const truncated = encodePayload(encryptedPayload).subarray(0, ENCRYPTED_OVERHEAD - 1);
    expect(() => decodePayload(truncated)).toThrow(CorruptPayloadError);

    const badProfile = encodePayload(encryptedPayload);
    badProfile[1] = 0x7f;
    expect(() => decodePayload(badProfile)).toThrow(CorruptPayloadError);
  });
});

describe('findPayloadCandidates', () => {
  it('encuentra la carga aunque la racha empiece con selectores ajenos', () => {
    // El caso real: el texto termina en ❤️, que arrastra su propio VS16 (byte 0x0F),
    // y nuestra carga viene justo detrás.
    const encoded = encodePayload(encryptedPayload);
    const run = Uint8Array.from([0x0f, ...encoded]);

    const candidates = findPayloadCandidates(run);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].offset).toBe(1);
    expect(candidates[0].payload.mode).toBe('encrypted');
  });

  it('no devuelve nada cuando la racha no contiene ninguna carga', () => {
    expect(findPayloadCandidates(Uint8Array.from([0x00, 0x0f, 0x20]))).toEqual([]);
  });

  it('devuelve en orden los magic ambiguos en vez de quedarse con el primero', () => {
    // Un 0xA2 fortuito seguido de bytes suficientes decodifica como carga «válida»
    // en apariencia. Si nos quedáramos con él, taparíamos la carga real de detrás.
    const encoded = encodePayload(encryptedPayload);
    const run = Uint8Array.from([MAGIC_ENCRYPTED, KDF_PBKDF2_SHA256_600K, 0x02, ...encoded]);

    const offsets = findPayloadCandidates(run).map((candidate) => candidate.offset);
    expect(offsets).toContain(0);
    expect(offsets).toContain(3);
    expect(offsets.indexOf(0)).toBeLessThan(offsets.indexOf(3));
  });

  it('descarta un magic al que no le siguen bytes suficientes', () => {
    const run = Uint8Array.from([MAGIC_ENCRYPTED, KDF_PBKDF2_SHA256_600K, 0x01, 0x02]);
    expect(findPayloadCandidates(run)).toEqual([]);
  });
});
