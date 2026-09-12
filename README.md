# Esteganografía Unicode

Oculta un mensaje dentro de otro usando **Unicode variation selectors**. El texto que
obtienes se ve exactamente igual que el que escribiste, pero arrastra caracteres
invisibles que solo esta herramienta sabe leer.

Todo ocurre en el navegador: ni el secreto ni la contraseña salen de la máquina.

**Pruébalo en vivo:** <https://unicode-steganography.vercel.app/>

## Puesta en marcha

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 71 tests sobre lib/
npm run build
```

## Cómo funciona

Unicode define exactamente **256 variation selectors**, repartidos entre
`U+FE00..U+FE0F` (16) y `U+E0100..U+E01EF` (240). Esa correspondencia uno a uno con
el rango de un byte es lo que hace viable la técnica: cada byte del mensaje se
convierte en un selector, y la cadena resultante se adosa al último grafema del texto
visible. Sin glifo propio, son invisibles, y el estándar exige preservarlos aunque el
sistema no reconozca su función, así que sobreviven al copiar y pegar.

### Formato binario

```
byte 0        magic + modo    0xA1 = texto plano | 0xA2 = cifrado
byte 1        perfil KDF      0x01 = PBKDF2-SHA256/600k + AES-256-GCM   (solo cifrado)
bytes 2..17   salt (16)                                                 (solo cifrado)
bytes 18..29  iv (12)                                                   (solo cifrado)
resto         ciphertext || tag(16), o el UTF-8 en claro si el modo es 0xA1
```

Overhead del modo cifrado: **46 bytes**.

Los magic valen `0xA1` y `0xA2` a propósito: al ser `>= 0x10` garantizan que el primer
selector emitido cae en el bloque suplementario, que no define secuencias de variación
para ningún carácter y por tanto nunca altera el renderizado del portador. Un primer
selector en `U+FE00..U+FE0F` podría cambiar la presentación texto/emoji y delatar el
mensaje.

## Sobre la criptografía

Un hash es irreversible por definición, así que no sirve para recuperar un mensaje. Lo
que se implementa es **cifrado simétrico autenticado con clave derivada de la
contraseña**: `PBKDF2-HMAC-SHA256` con 600.000 iteraciones (el mínimo que recomienda
OWASP) y `AES-256-GCM`, todo sobre **WebCrypto nativo, sin dependencias criptográficas
de terceros**.

El detalle que condiciona el diseño: **el criptograma viaja en público** dentro del
mensaje compartido, así que quien lo reciba puede atacarlo sin conexión y sin límite de
intentos. El KDF es el único freno real, de ahí el coste alto y el salt nuevo por
mensaje. Coste medido: ~440 ms cifrar, ~380 ms descifrar.

Alternativas evaluadas y por qué no: **Argon2id** resiste mucho mejor el ataque con GPU
por ser memory-hard, pero exige WebAssembly (no es viable en JS puro) y una dependencia
externa; el byte de perfil KDF del formato queda reservado para poder migrar sin
invalidar los mensajes ya generados. **XChaCha20-Poly1305** aporta un nonce de 192 bits
y mejor rendimiento sin AES-NI, a cambio de 12 bytes más de overhead y otra dependencia.

## Limitaciones

- **La contraseña es la defensa real.** Una palabra del diccionario cae en minutos por
  muchas iteraciones que se pongan.
- **No todas las plataformas respetan los selectores.** Sobrevive bien al copiar y pegar,
  a los documentos y a la mayoría de mensajería, pero algunos formularios, saneadores y
  clientes de correo normalizan el texto y se los llevan por delante.
- **Es ocultación, no invisibilidad.** Quien sospeche puede detectar los caracteres y,
  sin contraseña, leer el mensaje. La esteganografía esconde que hay un mensaje; solo el
  cifrado protege su contenido.

## Estructura

```
lib/
  variation-selectors.ts   códec bytes <-> selectores
  payload.ts               formato binario
  crypto.ts                PBKDF2 + AES-GCM sobre WebCrypto
  stego.ts                 API de alto nivel: hide() / reveal()
  password-strength.ts     estimación de resistencia al ataque offline
components/                interfaz (client components)
app/                       App Router + tema terminal
```
