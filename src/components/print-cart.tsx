"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  changeCartQuantity,
  removePrintFromCart,
  startCartCheckout,
} from "@/app/cart/actions";
import { formatPrice } from "@/lib/artwork";
import { formatPrintChoice } from "@/lib/print-type";
import { CONTIGUOUS_STATES } from "@/lib/contiguous-us";
import type { CartLineQuote, ShippingPlan } from "@/lib/print-shipping";

const fieldClass =
  "mt-2 w-full border border-line bg-background px-3 py-3 text-base";
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center bg-foreground px-4 text-sm text-background disabled:opacity-60";

export function PrintCart({
  lines,
  missing,
  merchandiseCents,
  mixed,
  plans,
  canceled,
  notice,
}: {
  lines: CartLineQuote[];
  missing: { artworkSlug: string; printId: string; quantity: number }[];
  merchandiseCents: number;
  mixed: boolean;
  plans: ShippingPlan[] | null;
  canceled: boolean;
  notice: string | null;
}) {
  const [state, action, pending] = useActionState(startCartCheckout, null);
  const ready = plans !== null && plans.length > 0;
  const [choice, setChoice] = useState(plans?.[0]?.id ?? "");
  const selectedPlan = plans?.find((plan) => plan.id === choice) ?? plans?.[0];

  return (
    <div className="mt-8">
      {canceled ? (
        <p role="status" className="text-sm leading-6">
          Checkout was canceled. You have not been charged, and this order is
          not in the shipping queue.
        </p>
      ) : null}
      {notice ? (
        <p role="alert" className="mt-4 text-sm leading-6">
          {notice}
        </p>
      ) : null}
      {lines.length === 0 && missing.length === 0 ? (
        <p className="text-sm leading-6 text-muted">
          Your cart is empty.{" "}
          <Link href="/gallery" className="underline underline-offset-4">
            Gallery
          </Link>
        </p>
      ) : null}
      {lines.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((line) => (
            <li key={`${line.artworkSlug}-${line.printId}`} className="py-4 text-sm leading-6">
              <p>{line.artworkTitle}</p>
              <p className="mt-1">{formatPrintChoice(line.printType, line.size)}</p>
              <p>{line.kind === "in-stock" ? "Prints available" : "Open for pre-order"}</p>
              {line.estimatedShipWindow ? <p>{line.estimatedShipWindow}</p> : null}
              <p className="mt-1 tabular-nums">{formatPrice(line.lineTotalCents / 100)}</p>
              <form
                key={`${line.artworkSlug}-${line.printId}-${line.quantity}`}
                action={changeCartQuantity}
                className="mt-3 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="slug" value={line.artworkSlug} />
                <input type="hidden" name="printId" value={line.printId} />
                <label className="text-sm" htmlFor={`qty-${line.artworkSlug}-${line.printId}`}>
                  Quantity
                  <input
                    id={`qty-${line.artworkSlug}-${line.printId}`}
                    name="quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10}
                    defaultValue={line.quantity}
                    required
                    className="mt-2 w-24 border border-line bg-background px-3 py-3 text-base"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                >
                  Update
                </button>
                <button
                  type="submit"
                  formAction={removePrintFromCart}
                  className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      {missing.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {missing.map((line) => (
            <li key={`${line.artworkSlug}-${line.printId}`} className="text-sm leading-6">
              <p>A print in your cart is no longer available.</p>
              <form action={removePrintFromCart} className="mt-2">
                <input type="hidden" name="slug" value={line.artworkSlug} />
                <input type="hidden" name="printId" value={line.printId} />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      {lines.length > 0 ? (
        <form action={action} className="mt-8 grid gap-5">
          <dl className="border-t border-line text-sm">
            <div className="flex items-baseline justify-between gap-6 border-b border-line py-3">
              <dt className="text-muted">Prints</dt>
              <dd className="tabular-nums">{formatPrice(merchandiseCents / 100)}</dd>
            </div>
          </dl>
          {ready && plans && selectedPlan ? (
            <ShippingChoices
              plans={plans}
              mixed={mixed}
              merchandiseCents={merchandiseCents}
              selectedId={selectedPlan.id}
              onSelect={setChoice}
            />
          ) : (
            <p className="text-sm leading-6">
              Set PRINT_SHIPPING_CENTS, PRINT_SOLO_SHIPPING_CENTS, PRINTS_PER_PACKAGE,
              and PRINT_PACKAGE_MAX_INCHES before checkout.
            </p>
          )}
          <fieldset className="grid gap-4">
            <legend className="text-sm">Delivery address</legend>
            <p className="text-sm leading-6 text-muted">
              Shipping covers the contiguous United States.
            </p>
            <AddressFields />
          </fieldset>
          {selectedPlan ? (
            <p className="flex items-baseline justify-between gap-6 border-y border-line py-3 text-sm">
              <span>Order total</span>
              <span className="tabular-nums">
                {formatPrice((merchandiseCents + selectedPlan.shippingCents) / 100)}
              </span>
            </p>
          ) : null}
          {state?.error ? (
            <p role="alert" className="text-sm">
              {state.error}
            </p>
          ) : null}
          <button type="submit" disabled={pending || !ready || missing.length > 0} className={buttonClass}>
            {pending ? "Starting checkout…" : "Checkout"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ShippingChoices({
  plans,
  mixed,
  merchandiseCents,
  selectedId,
  onSelect,
}: {
  plans: ShippingPlan[];
  mixed: boolean;
  merchandiseCents: number;
  selectedId: string;
  onSelect: (id: ShippingPlan["id"]) => void;
}) {
  if (!mixed) {
    const plan = plans[0];
    if (!plan) return null;
    return (
      <section aria-labelledby="shipping-heading">
        <h2 id="shipping-heading" className="text-sm">
          Shipping
        </h2>
        <PlanDetails plan={plan} merchandiseCents={merchandiseCents} />
      </section>
    );
  }

  return (
    <fieldset>
      <legend className="text-sm">Shipping</legend>
      <div className="mt-3 grid gap-3">
        {plans.map((plan) => (
          <label key={plan.id} className="block border border-line px-3 py-3 text-sm leading-6">
            <span className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="shippingChoice"
                value={plan.id}
                checked={plan.id === selectedId}
                onChange={() => onSelect(plan.id)}
                required
                className="size-5"
              />
              {plan.label}
            </span>
            <PlanDetails plan={plan} merchandiseCents={merchandiseCents} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PlanDetails({
  plan,
  merchandiseCents,
}: {
  plan: ShippingPlan;
  merchandiseCents: number;
}) {
  return (
    <div className="mt-3 grid gap-4">
      {plan.shipments.map((shipment, index) => (
        <div key={`${shipment.fulfillment}-${shipment.shipWindow}-${index}`} className="min-w-0">
          <p className="break-words text-muted">{whenText(plan.id, shipment)}</p>
          <ul className="mt-2 grid gap-2">
            {shipment.lines.map((line) => (
              <li key={`${line.artworkSlug}-${line.printId}`}>
                {line.artworkTitle}, {formatPrintChoice(line.printType, line.size)}, qty {line.quantity}
              </li>
            ))}
          </ul>
          {plan.shipments.length > 1 ? (
            <p className="mt-2 tabular-nums">
              Shipping {formatPrice(shipment.shippingCents / 100)}
            </p>
          ) : null}
        </div>
      ))}
      <p className="tabular-nums">Shipping charge {formatPrice(plan.shippingCents / 100)}</p>
      <p className="tabular-nums">
        Order total {formatPrice((merchandiseCents + plan.shippingCents) / 100)}
      </p>
      {plan.savingsCents > 0 ? (
        <p>Save {formatPrice(plan.savingsCents / 100)} by waiting</p>
      ) : null}
    </div>
  );
}

function whenText(
  planId: ShippingPlan["id"],
  shipment: ShippingPlan["shipments"][number],
) {
  if (planId === "wait-together") {
    return shipment.shipWindow
      ? `Ships together when every pre-order is ready. ${shipment.shipWindow}`
      : "Ships together when every pre-order is ready.";
  }

  if (shipment.fulfillment === "pack") return "Ready to ship";
  return shipment.shipWindow || "Ships when the print is ready";
}

function AddressFields() {
  return (
    <>
      <label className="block text-sm" htmlFor="cart-name">
        Name
        <input id="cart-name" name="name" autoComplete="name" required maxLength={60} className={fieldClass} />
      </label>
      <label className="block text-sm" htmlFor="cart-line1">
        Street address
        <input
          id="cart-line1"
          name="line1"
          autoComplete="address-line1"
          required
          maxLength={80}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm" htmlFor="cart-line2">
        Apartment, suite
        <span className="text-muted"> (optional)</span>
        <input
          id="cart-line2"
          name="line2"
          autoComplete="address-line2"
          maxLength={40}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm" htmlFor="cart-city">
        City
        <input
          id="cart-city"
          name="city"
          autoComplete="address-level2"
          required
          maxLength={40}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm" htmlFor="cart-state">
        State
        <select
          id="cart-state"
          name="state"
          autoComplete="address-level1"
          required
          defaultValue=""
          className={fieldClass}
        >
          <option value="" disabled>
            Choose a state
          </option>
          {CONTIGUOUS_STATES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm" htmlFor="cart-zip">
        ZIP code
        <input
          id="cart-zip"
          name="postalCode"
          autoComplete="postal-code"
          inputMode="numeric"
          required
          maxLength={10}
          className={fieldClass}
        />
      </label>
    </>
  );
}
