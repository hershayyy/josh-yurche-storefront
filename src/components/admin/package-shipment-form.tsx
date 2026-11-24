"use client";

import { useActionState } from "react";
import {
  markPackageShipped,
  type ShipmentFormState,
} from "@/app/admin/order-actions";

const fieldClass =
  "mt-2 w-full border border-line bg-background px-3 py-3 text-base";
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center bg-foreground px-4 text-sm text-background disabled:opacity-60";

export function PackageShipmentForm({
  orderId,
  packageId,
}: {
  orderId: string;
  packageId: string;
}) {
  const [state, action, pending] = useActionState<ShipmentFormState, FormData>(
    markPackageShipped,
    null,
  );

  return (
    <form action={action} className="mt-4 grid gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="packageId" value={packageId} />
      <label className="block text-sm" htmlFor={`carrier-${packageId}`}>
        Carrier
        <input
          id={`carrier-${packageId}`}
          name="carrier"
          required
          maxLength={40}
          autoComplete="off"
          className={fieldClass}
        />
      </label>
      <label className="block text-sm" htmlFor={`tracking-${packageId}`}>
        Tracking number
        <input
          id={`tracking-${packageId}`}
          name="trackingNumber"
          required
          maxLength={40}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={fieldClass}
        />
      </label>
      {state?.error ? (
        <p role="alert" className="text-sm">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Mark shipped"}
      </button>
    </form>
  );
}
