/** Une clases condicionales sin arrastrar una dependencia para algo de tres líneas. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
