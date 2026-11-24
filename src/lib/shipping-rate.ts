import "server-only";
import { AdminError } from "@/lib/admin-error";

/** Flat test rate in US cents. Null when the env var is missing or not a whole number of cents. */
export function printShippingCents(): number | null {
  const raw = process.env.PRINT_SHIPPING_CENTS?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return null;

  const cents = Number(raw);
  if (!Number.isSafeInteger(cents) || cents > 50_000) return null;
  return cents;
}

export function requirePrintShippingCents(): number {
  const cents = printShippingCents();

  if (cents === null) {
    throw new AdminError(
      "Set PRINT_SHIPPING_CENTS to the test shipping rate before taking pre-orders.",
    );
  }

  return cents;
}

export type PackageRates = {
  /** PRINT_SHIPPING_CENTS. One flat mailer, or one tube, holding one print or several. */
  sharedPackageCents: number;
  /** PRINT_SOLO_SHIPPING_CENTS. A flat print that cannot share a mailer. */
  soloPackageCents: number;
  printsPerPackage: number;
  /** Flat mailers share when the longer side is at or under this length. */
  maxSharedInches: number;
  /** Tube inside length. One inch of it is reserved for protective wrapping. */
  tubeInsideInches: number;
};

function wholeEnv(name: string, min: number, max: number): number | null {
  const raw = process.env[name]?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return null;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}

/** Null when any multi-print test rate is missing or out of range. */
export function packageRates(): PackageRates | null {
  const sharedPackageCents = printShippingCents();
  const soloPackageCents = wholeEnv("PRINT_SOLO_SHIPPING_CENTS", 0, 50_000);
  const printsPerPackage = wholeEnv("PRINTS_PER_PACKAGE", 1, 20);
  const maxSharedInches = wholeEnv("PRINT_PACKAGE_MAX_INCHES", 1, 120);
  const tubeInsideInches = wholeEnv("PRINT_TUBE_INSIDE_INCHES", 2, 120);

  if (
    sharedPackageCents === null ||
    soloPackageCents === null ||
    printsPerPackage === null ||
    maxSharedInches === null ||
    tubeInsideInches === null
  ) {
    return null;
  }

  return {
    sharedPackageCents,
    soloPackageCents,
    printsPerPackage,
    maxSharedInches,
    tubeInsideInches,
  };
}
