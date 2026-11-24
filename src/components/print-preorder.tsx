"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { addPrintToCart } from "@/app/cart/actions";
import { formatPrice, type PrintOption } from "@/lib/artwork";
import { PRINT_TYPES, printTypeGroupLabel, type PrintType } from "@/lib/print-type";

const fieldClass =
  "mt-2 w-full border border-line bg-background px-3 py-3 text-base";
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center bg-foreground px-4 text-sm text-background disabled:opacity-60";

export function PrintPreorder({
  slug,
  prints,
  shipWindow,
  canceled,
  offerKind = "preorder",
}: {
  slug: string;
  prints: PrintOption[];
  shipWindow: string;
  canceled: boolean;
  offerKind?: "in-stock" | "preorder";
}) {
  const [added, addToCart, adding] = useActionState(addPrintToCart, null);
  const [printId, setPrintId] = useState(prints[0]?.id ?? "");
  const selected = prints.find((print) => print.id === printId) ?? prints[0];

  if (!selected) return null;

  return (
    <section id="prints" className="mt-10 scroll-mt-16" aria-labelledby="prints-heading">
      <h2
        id="prints-heading"
        className="text-xs uppercase tracking-[0.16em] text-muted"
      >
        Prints
      </h2>
      {canceled ? (
        <p role="status" className="mt-4 text-sm leading-6">
          Checkout was canceled. You have not been charged, and this order is
          not in the shipping queue.
        </p>
      ) : null}
      <form action={addToCart} className="mt-4 grid gap-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="printId" value={selected.id} />
        <div className="grid gap-5">
          {PRINT_TYPES.map((type) => {
            const group = prints.filter((print) => print.type === type);
            if (group.length === 0) return null;
            return (
              <PrintGroup
                key={type}
                type={type}
                prints={group}
                selectedId={selected.id}
                onSelect={setPrintId}
              />
            );
          })}
        </div>
        <dl className="border-t border-line text-sm">
          <div className="flex items-baseline justify-between gap-6 border-b border-line py-3">
            <dt className="text-muted">Price</dt>
            <dd className="tabular-nums">{formatPrice(selected.price)}</dd>
          </div>
          {offerKind === "in-stock" ? (
            <div className="flex items-baseline justify-between gap-6 border-b border-line py-3">
              <dt className="text-muted">Shipping</dt>
              <dd>Ready to ship</dd>
            </div>
          ) : null}
          {selected.paper ? (
            <div className="grid gap-1 border-b border-line py-3">
              <dt className="text-muted">Paper or finish</dt>
              <dd className="break-words">{selected.paper}</dd>
            </div>
          ) : null}
          {shipWindow ? (
            <div className="grid gap-1 border-b border-line py-3">
              <dt className="text-muted">Estimated shipping</dt>
              <dd>{shipWindow}</dd>
            </div>
          ) : null}
        </dl>
        <label className="block text-sm" htmlFor="cart-quantity">
          Quantity
          <input
            id="cart-quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            defaultValue={1}
            required
            className={`${fieldClass} max-w-28`}
          />
        </label>
        {added?.error ? (
          <p role="alert" className="text-sm">
            {added.error}
          </p>
        ) : null}
        {added?.added ? (
          <p role="status" className="text-sm">
            Added to cart.{" "}
            <Link href="/cart" className="underline underline-offset-4">
              View cart
            </Link>
          </p>
        ) : null}
        <button type="submit" disabled={adding} className={buttonClass}>
          {adding ? "Adding…" : "Add to cart"}
        </button>
      </form>
    </section>
  );
}

function PrintGroup({
  type,
  prints,
  selectedId,
  onSelect,
}: {
  type: PrintType;
  prints: PrintOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm">{printTypeGroupLabel(type)}</legend>
      <div className="mt-2 grid gap-2">
        {prints.map((print) => (
          <label
            key={print.id}
            className="flex min-h-11 items-center justify-between gap-3 border border-line px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="size"
                value={print.id}
                checked={selectedId === print.id}
                onChange={() => onSelect(print.id)}
                className="size-5"
              />
              <span>
                {print.size}
                {print.paper ? (
                  <span className="mt-1 block break-words text-muted">{print.paper}</span>
                ) : null}
              </span>
            </span>
            <span className="tabular-nums">{formatPrice(print.price)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
