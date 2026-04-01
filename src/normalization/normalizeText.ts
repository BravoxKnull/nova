export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeNormalizedText(input: string): string[] {
  return input.length === 0 ? [] : input.split(" ");
}
