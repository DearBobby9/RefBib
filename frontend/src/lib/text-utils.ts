export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildBigrams(value: string): Set<string> {
  const normalized = normalizeText(value).replace(/\s/g, "");
  const grams = new Set<string>();
  if (normalized.length < 2) return grams;
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
  }
  return grams;
}

export function titleSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const gramsA = buildBigrams(a);
  const gramsB = buildBigrams(b);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  let overlap = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) overlap += 1;
  }
  return (2 * overlap) / (gramsA.size + gramsB.size);
}
