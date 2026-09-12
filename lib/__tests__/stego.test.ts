import { describe, expect, it } from 'vitest';
import { DEFAULT_CARRIER, hide, inspect, reveal, revealPlain } from '../stego';
import {
  ENCRYPTED_OVERHEAD,
  KDF_PBKDF2_SHA256_600K,
  MAGIC_ENCRYPTED,
  MAGIC_PLAIN,
} from '../payload';
import { bytesToSelectors, stripVariationSelectors } from '../variation-selectors';

/**
 * Comprueba que lo único que hide() tocó fue insertar su carga.
 *
 * No vale con stripVariationSelectors: eso borraría también los selectores
 * legítimos del propio texto visible —el VS16 que lleva ❤️, por ejemplo— y daría
 * un falso negativo.
 */
function sinCarga(text: string, payload: Uint8Array): string {
  return text.replace(bytesToSelectors(payload), '');
}

const FAST = 1_000;

describe('ida y vuelta sin contraseña', () => {
  it('recupera el secreto', async () => {
    const { text, encrypted } = await hide({
      visibleText: 'Nos vemos a las ocho',
      secret: 'plaza mayor',
    });

    expect(encrypted).toBe(false);
    await expect(reveal(text)).resolves.toEqual({ status: 'plain', secret: 'plaza mayor' });
  });

  it('no añade más de un byte de cabecera', async () => {
    const { payload } = await hide({ visibleText: 'x', secret: 'abc' });
    expect(payload.length).toBe(1 + 3);
  });
});

describe('ida y vuelta con contraseña', () => {
  it('recupera el secreto con la contraseña correcta', async () => {
    const { text, encrypted } = await hide({
      visibleText: 'Buenos días',
      secret: 'la llave está bajo el felpudo',
      password: 'ábrete sésamo',
      iterations: FAST,
    });

    expect(encrypted).toBe(true);
    await expect(reveal(text, 'ábrete sésamo', FAST)).resolves.toEqual({
      status: 'encrypted',
      secret: 'la llave está bajo el felpudo',
    });
  });

  it('avisa de que hace falta contraseña en vez de devolver basura', async () => {
    const { text } = await hide({
      visibleText: 'Hola',
      secret: 'secreto',
      password: 'clave',
      iterations: FAST,
    });

    await expect(reveal(text)).resolves.toEqual({ status: 'password-required' });
  });

  it('distingue una contraseña incorrecta', async () => {
    const { text } = await hide({
      visibleText: 'Hola',
      secret: 'secreto',
      password: 'clave',
      iterations: FAST,
    });

    await expect(reveal(text, 'otra', FAST)).resolves.toEqual({ status: 'wrong-password' });
  });

  it('cuesta exactamente 46 bytes de overhead frente al texto plano', async () => {
    const secret = 'mismo secreto';
    const plain = await hide({ visibleText: 'x', secret });
    const sealed = await hide({ visibleText: 'x', secret, password: 'clave', iterations: FAST });

    expect(sealed.payload.length - plain.payload.length).toBe(ENCRYPTED_OVERHEAD - 1);
  });

  it('detecta la manipulación del texto portador', async () => {
    const { text } = await hide({
      visibleText: 'Hola',
      secret: 'secreto',
      password: 'clave',
      iterations: FAST,
    });

    const chars = [...text];
    const last = chars.length - 1;
    const flipped = chars[last].codePointAt(0) === 0xe0100 ? 0xe0101 : 0xe0100;
    chars[last] = String.fromCodePoint(flipped);

    await expect(reveal(chars.join(''), 'clave', FAST)).resolves.toEqual({
      status: 'wrong-password',
    });
  });
});

describe('el texto visible queda intacto', () => {
  const casos: Array<[string, string]> = [
    ['texto simple', 'Nos vemos mañana'],
    ['termina en emoji con VS16', 'Te quiero ❤️'],
    ['emoji compuesto con ZWJ', 'La familia 👨‍👩‍👧‍👦'],
    ['bandera', 'Desde España 🇪🇸'],
    ['espacios al final', 'con cola   '],
    ['salto de línea al final', 'primera y segunda '],
    ['CJK', '日本語のテキスト'],
    ['puntuación', '¿Vienes? ¡Claro!'],
  ];

  it.each(casos)('%s', async (_nombre, visibleText) => {
    const { text, payload } = await hide({ visibleText, secret: 'oculto' });

    expect(sinCarga(text, payload)).toBe(visibleText);
    await expect(reveal(text)).resolves.toEqual({ status: 'plain', secret: 'oculto' });
  });

  it('también cuando va cifrado y el portador ya arrastra su propio selector', async () => {
    const visibleText = 'Te quiero ❤️';
    const { text, payload } = await hide({
      visibleText,
      secret: 'y mucho',
      password: 'clave',
      iterations: FAST,
    });

    expect(sinCarga(text, payload)).toBe(visibleText);
    await expect(reveal(text, 'clave', FAST)).resolves.toEqual({
      status: 'encrypted',
      secret: 'y mucho',
    });
  });
});

describe('carácter portador', () => {
  it('añade uno cuando no hay texto visible', async () => {
    const { text } = await hide({ visibleText: '', secret: 'huérfano' });

    expect(stripVariationSelectors(text)).toBe(DEFAULT_CARRIER);
    await expect(reveal(text)).resolves.toEqual({ status: 'plain', secret: 'huérfano' });
  });

  it('añade uno cuando el texto visible es solo espacios', async () => {
    const { text } = await hide({ visibleText: '   ', secret: 'huérfano' });

    expect(stripVariationSelectors(text)).toBe('   ' + DEFAULT_CARRIER);
    await expect(reveal(text)).resolves.toEqual({ status: 'plain', secret: 'huérfano' });
  });

  it('respeta un portador personalizado', async () => {
    const { text } = await hide({ visibleText: '', secret: 'x', carrier: '😀' });
    expect(stripVariationSelectors(text)).toBe('😀');
  });
});

describe('contenido del secreto', () => {
  it('soporta un kilobyte largo', async () => {
    const secret = 'á'.repeat(512);
    const { text } = await hide({
      visibleText: 'tapadera',
      secret,
      password: 'clave',
      iterations: FAST,
    });

    await expect(reveal(text, 'clave', FAST)).resolves.toEqual({ status: 'encrypted', secret });
  });

  it('soporta emoji, tabulaciones y acentos', async () => {
    const secret = 'línea uno y dos 😀🇪🇸👨‍👩‍👧‍👦';
    const { text } = await hide({ visibleText: 'nada que ver', secret });

    await expect(reveal(text)).resolves.toEqual({ status: 'plain', secret });
  });

  it('soporta un secreto vacío', async () => {
    const { text } = await hide({ visibleText: 'tapadera', secret: '' });
    await expect(reveal(text)).resolves.toEqual({ status: 'plain', secret: '' });
  });
});

describe('textos sin carga', () => {
  it.each([
    ['texto normal', 'Aquí no hay nada escondido'],
    ['texto vacío', ''],
    ['emoji con su VS16 legítimo', 'Te quiero ❤️'],
    ['solo espacios', '   '],
  ])('%s devuelve none', async (_nombre, texto) => {
    await expect(reveal(texto)).resolves.toEqual({ status: 'none' });
    expect(inspect(texto)).toBeNull();
  });
});

describe('inspect', () => {
  it('detecta carga en claro sin necesitar contraseña', async () => {
    const { text, payload } = await hide({ visibleText: 'hola', secret: 'abc' });

    expect(inspect(text)).toEqual({ encrypted: false, payloadBytes: payload.length });
  });

  it('detecta carga cifrada sin necesitar contraseña', async () => {
    const { text, payload } = await hide({
      visibleText: 'hola',
      secret: 'abc',
      password: 'clave',
      iterations: FAST,
    });

    expect(inspect(text)).toEqual({ encrypted: true, payloadBytes: payload.length });
  });
});

describe('revealPlain', () => {
  it('resuelve una carga en claro sin promesas', async () => {
    const { text } = await hide({ visibleText: 'hola', secret: 'a la vista' });
    expect(revealPlain(text)).toEqual({ status: 'plain', secret: 'a la vista' });
  });

  it('señala que hace falta contraseña ante una carga cifrada', async () => {
    const { text } = await hide({
      visibleText: 'hola',
      secret: 'oculto',
      password: 'clave',
      iterations: FAST,
    });

    expect(revealPlain(text)).toEqual({ status: 'password-required' });
  });

  it('devuelve none cuando no hay nada', () => {
    expect(revealPlain('texto limpio')).toEqual({ status: 'none' });
  });

  it('coincide con reveal() cuando no se aporta contraseña', async () => {
    const { text } = await hide({ visibleText: 'hola', secret: 'x' });
    expect(revealPlain(text)).toEqual(await reveal(text));
  });
});

/**
 * El salt, el iv y el criptograma son bytes pseudoaleatorios: uno de cada 256
 * vale 0xA1, el magic de texto plano. Cada uno de esos bytes abre un candidato
 * «plano» espurio que no debe adelantar a la carga cifrada real del offset 0.
 *
 * Las cargas se montan a mano en lugar de con hide() porque con bytes aleatorios
 * el fallo solo aparecía una de cada doce ejecuciones.
 */
describe('revealPlain frente a magic espurios dentro de una carga cifrada', () => {
  /** Carga cifrada bien formada, rellena de ceros salvo lo que planten los tests. */
  function cargaCifrada(extra: number): Uint8Array {
    const bytes = new Uint8Array(ENCRYPTED_OVERHEAD + extra);
    bytes[0] = MAGIC_ENCRYPTED;
    bytes[1] = KDF_PBKDF2_SHA256_600K;
    return bytes;
  }

  it('no deja que un 0xA1 en el último byte se lea como carga plana vacía', () => {
    const bytes = cargaCifrada(4);
    bytes[bytes.length - 1] = MAGIC_PLAIN;

    expect(revealPlain('hola' + bytesToSelectors(bytes))).toEqual({
      status: 'password-required',
    });
  });

  it('no deja que un 0xA1 seguido de UTF-8 válido se lea como el secreto', () => {
    const bytes = cargaCifrada(8);
    const señuelo = new TextEncoder().encode('basura');
    bytes[ENCRYPTED_OVERHEAD - 1] = MAGIC_PLAIN;
    bytes.set(señuelo, ENCRYPTED_OVERHEAD);

    expect(revealPlain('hola' + bytesToSelectors(bytes))).toEqual({
      status: 'password-required',
    });
  });

  it('mantiene inspect() y revealPlain() de acuerdo sobre la misma entrada', () => {
    const bytes = cargaCifrada(4);
    bytes[bytes.length - 1] = MAGIC_PLAIN;
    const text = 'hola' + bytesToSelectors(bytes);

    expect(inspect(text)?.encrypted).toBe(true);
    expect(revealPlain(text).status).toBe('password-required');
  });
});
