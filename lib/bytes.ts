/**
 * Uint8Array respaldado por un ArrayBuffer real.
 *
 * Desde TypeScript 5.7 `Uint8Array` es genérico y por defecto admite también un
 * SharedArrayBuffer, que WebCrypto no acepta como BufferSource. Fijar el respaldo
 * en la firma evita tener que sembrar de casts cada llamada a `crypto.subtle`.
 */
export type Bytes = Uint8Array<ArrayBuffer>;
