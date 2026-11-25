"use client";

import { useActionState } from "react";
import { retryOrderEmail, type ShipmentFormState } from "@/app/admin/order-actions";

export function EmailRetryForm({
  orderId,
  packageId,
  message,
}: {
  orderId: string;
  packageId?: string;
  message: string;
}) {
  const [state, action, pending] = useActionState<ShipmentFormState, FormData>(
    retryOrderEmail,
    null,
  );

  return (
    <form action={action} className="mt-4">
      <p role="alert" className="break-words text-sm leading-6">
        {message}
      </p>
      {state?.error ? <p className="mt-2 break-words text-sm leading-6">{state.error}</p> : null}
      <input type="hidden" name="orderId" value={orderId} />
      {packageId ? <input type="hidden" name="packageId" value={packageId} /> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 inline-flex min-h-11 items-center border border-line px-4 text-sm disabled:opacity-60"
      >
        {pending ? "Sending…" : "Retry email"}
      </button>
    </form>
  );
}
