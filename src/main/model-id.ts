/**
 * Turns a product name into the lowercase, hyphenated part of a model ID:
 * "Signature M650 L" becomes "signature-m650-l". Empty when nothing is left.
 */
export function modelSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
