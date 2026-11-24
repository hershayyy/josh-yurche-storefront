export const PRINT_TYPES = ["art-print", "poster"] as const;

export type PrintType = (typeof PRINT_TYPES)[number];

export function isPrintType(value: unknown): value is PrintType {
  return value === "art-print" || value === "poster";
}

export function printTypeLabel(type: PrintType) {
  return type === "poster" ? "Poster" : "Art print";
}

export function printTypeGroupLabel(type: PrintType) {
  return type === "poster" ? "Posters" : "Art prints";
}

/** Size alone when an older order has no saved type. */
export function formatPrintChoice(type: PrintType | undefined, size: string) {
  if (!type) return size;
  return `${printTypeLabel(type)}, ${size}`;
}
