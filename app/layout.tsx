import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Esteganografía Unicode',
  description:
    'Oculta un mensaje cifrado dentro de un texto corriente usando Unicode variation selectors. Todo ocurre en tu navegador.',
};

/**
 * Deliberadamente sin `maximumScale` ni `userScalable: false`. Serían el atajo
 * para el zoom de iOS al enfocar un campo, pero impedirían ampliar la página
 * (WCAG 1.4.4). El zoom se evita subiendo los controles a 16px en móvil.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Deja que el contenido llegue al borde para poder gestionar el notch y la
  // home indicator a mano con env(safe-area-inset-*).
  viewportFit: 'cover',
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
