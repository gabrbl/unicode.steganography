import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Política de seguridad de contenido.
 *
 * La directiva que más importa aquí es `connect-src 'self'`: la aplicación no hace
 * ninguna petición de red, así que restringirla convierte la promesa de «nada sale
 * de tu navegador» en algo que el navegador hace cumplir, no en una declaración de
 * intenciones. `frame-ancestors 'none'` va detrás en importancia, porque embeber
 * esta página en un iframe ajeno es la vía obvia para robar lo que se teclea.
 *
 * `script-src` necesita 'unsafe-inline' porque Next inyecta scripts en línea para
 * hidratar. Evitarlo exigiría una CSP con nonce por petición, lo que obligaría a
 * renderizar dinámicamente una página que hoy es estática; no compensa cuando la
 * aplicación no muestra contenido de terceros.
 *
 * 'unsafe-eval' se añade sólo en desarrollo: React lo usa para reconstruir las
 * pilas de error del servidor en el navegador. Ni React ni Next recurren a eval()
 * en producción, así que la política que se sirve de verdad no lo incluye.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Sin referrer: la URL no debería filtrarse ni siquiera al abrir un enlace.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
