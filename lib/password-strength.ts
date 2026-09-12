/**
 * Estimación de la resistencia de una contraseña frente al ataque que aplica aquí.
 *
 * El criptograma viaja en público dentro del mensaje, así que el atacante prueba
 * contraseñas sin conexión y sin límite de intentos. Lo único que lo frena es el
 * coste del KDF, y por eso la cifra que mostramos no es un «fuerte/débil» abstracto
 * sino el tiempo aproximado de búsqueda a la velocidad real de PBKDF2.
 */

/**
 * Intentos por segundo de PBKDF2-HMAC-SHA256 con 600.000 iteraciones en una GPU de
 * gama alta. Es un orden de magnitud: varía con el hardware y con cuántas GPU
 * dedique el atacante. Tirar por lo bajo aquí sería engañar al usuario.
 */
export const GPU_GUESSES_PER_SECOND = 10_000;

export type StrengthLevel = 'empty' | 'weak' | 'fair' | 'strong' | 'excellent';

export interface PasswordAssessment {
  bits: number;
  level: StrengthLevel;
  /** Tiempo aproximado para recorrer media parte del espacio de búsqueda. */
  crackTime: string;
  label: string;
}

function charsetSize(password: string): number {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/[0-9]/.test(password)) size += 10;
  if (/[^a-zA-Z0-9\s]/.test(password)) size += 33;
  if (/\s/.test(password)) size += 1;
  // Cualquier cosa fuera de ASCII amplía mucho el alfabeto, pero de forma previsible.
  if (/[^\x00-\x7F]/.test(password)) size += 100;
  return Math.max(size, 2);
}

const LABELS: Record<StrengthLevel, string> = {
  empty: 'sin contraseña',
  weak: 'débil',
  fair: 'aceptable',
  strong: 'fuerte',
  excellent: 'excelente',
};

function levelFor(bits: number): StrengthLevel {
  if (bits < 35) return 'weak';
  if (bits < 60) return 'fair';
  if (bits < 80) return 'strong';
  return 'excellent';
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds > 1e17) return 'más que la edad del universo';
  if (seconds < 1) return 'instantáneo';
  if (seconds < MINUTE) return `${Math.round(seconds)} s`;
  if (seconds < HOUR) return `${Math.round(seconds / MINUTE)} min`;
  if (seconds < DAY) return `${Math.round(seconds / HOUR)} h`;
  if (seconds < YEAR) return `${Math.round(seconds / DAY)} días`;

  const years = seconds / YEAR;
  if (years < 1000) return `${Math.round(years)} años`;
  if (years < 1e6) return `${Math.round(years / 1000)} mil años`;
  if (years < 1e9) return `${Math.round(years / 1e6)} millones de años`;
  return `${(years / 1e9).toPrecision(2)} miles de millones de años`;
}

export function assessPassword(password: string): PasswordAssessment {
  if (password.length === 0) {
    return { bits: 0, level: 'empty', crackTime: 'instantáneo', label: LABELS.empty };
  }

  // Los caracteres repetidos no aportan entropía completa: "aaaaaaaa" no vale por ocho.
  const unique = new Set(password).size;
  const effectiveLength = unique + (password.length - unique) * 0.25;
  const bits = Math.round(effectiveLength * Math.log2(charsetSize(password)));

  // Media del espacio de búsqueda: de ahí el bits - 1.
  const seconds = Math.pow(2, Math.min(bits - 1, 200)) / GPU_GUESSES_PER_SECOND;
  const level = levelFor(bits);

  return { bits, level, crackTime: formatDuration(seconds), label: LABELS[level] };
}
