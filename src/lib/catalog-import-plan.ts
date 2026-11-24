export type CatalogImportPlan =
  | { action: "insert" }
  | { action: "replace-seed" }
  | { action: "update-import" }
  | { action: "skip"; reason: string };

/**
 * Copy the local gallery only when Preview has not been edited.
 * The automatic built-in seed is not an admin edit. A later save on Preview is.
 */
export function planCatalogImport(input: {
  hasCatalog: boolean;
  catalogVersion: number | null;
  matchesSeed: boolean;
  importVersion: number | null;
}): CatalogImportPlan {
  if (!input.hasCatalog) return { action: "insert" };

  if (
    input.importVersion !== null &&
    input.catalogVersion !== null &&
    input.importVersion === input.catalogVersion
  ) {
    return { action: "update-import" };
  }

  if (input.importVersion === null && input.matchesSeed) {
    return { action: "replace-seed" };
  }

  return {
    action: "skip",
    reason: "Preview catalog has admin edits. Leaving it in place.",
  };
}
