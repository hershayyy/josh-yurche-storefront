"use client";

import { useState } from "react";
import { addPrint, removePrint, updatePrint } from "@/app/admin/actions";
import { printShipsRolled, type PrintOption } from "@/lib/artwork";
import type { PrintType } from "@/lib/print-type";

const fieldClass =
  "mt-2 w-full border border-line bg-background px-3 py-3 text-base";
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center border border-foreground px-4 text-sm sm:w-auto";

function priceValue(price: number) {
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

export function PrintManager({
  slug,
  prints,
  error,
}: {
  slug: string;
  prints: PrintOption[];
  error?: string;
}) {
  return (
    <section id="prints" className="scroll-mt-16">
      <h2 className="font-serif text-2xl tracking-tight">Prints</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Choose Art print or Poster, then add the size and price. Paper or finish
        can wait until the stock is confirmed. Posters ship rolled unless you
        turn that off. Art prints ship flat unless you mark them rolled.
        Unavailable sizes stay off the public page.
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm">
          {error}
        </p>
      ) : null}
      <ul className="mt-6 grid gap-8">
        {prints.map((print) => (
          <li key={print.id} className="border-t border-line pt-5">
            <form action={updatePrint} className="grid gap-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="printId" value={print.id} />
              <PrintTypeField id={`type-${print.id}`} defaultValue={print.type} />
              <label className="block text-sm" htmlFor={`size-${print.id}`}>
                Size
                <input
                  id={`size-${print.id}`}
                  name="size"
                  required
                  maxLength={40}
                  defaultValue={print.size}
                  className={fieldClass}
                />
              </label>
              <PaperField id={`paper-${print.id}`} defaultValue={print.paper ?? ""} />
              <label className="block text-sm" htmlFor={`price-${print.id}`}>
                Price (USD)
                <input
                  id={`price-${print.id}`}
                  name="price"
                  inputMode="decimal"
                  required
                  defaultValue={priceValue(print.price)}
                  className={fieldClass}
                />
              </label>
              <RolledField id={`rolled-${print.id}`} defaultChecked={printShipsRolled(print)} />
              <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor={`available-${print.id}`}>
                <input
                  id={`available-${print.id}`}
                  name="available"
                  type="checkbox"
                  defaultChecked={print.available}
                  className="size-5"
                />
                Available
              </label>
              <button type="submit" className={buttonClass}>
                Save size
              </button>
            </form>
            <form action={removePrint} className="mt-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="printId" value={print.id} />
              <button type="submit" className="inline-flex min-h-11 items-center text-sm underline">
                Remove size
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addPrint} className="mt-8 grid gap-4 border-t border-line pt-5">
        <h3 className="text-sm">Add a size</h3>
        <input type="hidden" name="slug" value={slug} />
        <NewPrintShipping />
        <label className="block text-sm" htmlFor="new-size">
          Size
          <input id="new-size" name="size" required maxLength={40} className={fieldClass} />
        </label>
        <PaperField id="new-paper" defaultValue="" />
        <label className="block text-sm" htmlFor="new-price">
          Price (USD)
          <input
            id="new-price"
            name="price"
            inputMode="decimal"
            required
            className={fieldClass}
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor="new-available">
          <input
            id="new-available"
            name="available"
            type="checkbox"
            defaultChecked
            className="size-5"
          />
          Available
        </label>
        <button type="submit" className={buttonClass}>
          Add size
        </button>
      </form>
    </section>
  );
}

function PrintTypeField({ id, defaultValue }: { id: string; defaultValue: PrintType }) {
  return (
    <label className="block text-sm" htmlFor={id}>
      Print type
      <select id={id} name="printType" required defaultValue={defaultValue} className={fieldClass}>
        <option value="art-print">Art print</option>
        <option value="poster">Poster</option>
      </select>
    </label>
  );
}

function NewPrintShipping() {
  const [type, setType] = useState<PrintType>("art-print");
  const [rolled, setRolled] = useState(false);
  const [touched, setTouched] = useState(false);

  return (
    <>
      <label className="block text-sm" htmlFor="new-type">
        Print type
        <select
          id="new-type"
          name="printType"
          required
          value={type}
          className={fieldClass}
          onChange={(event) => {
            const next = event.target.value as PrintType;
            setType(next);
            if (!touched) setRolled(next === "poster");
          }}
        >
          <option value="art-print">Art print</option>
          <option value="poster">Poster</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor="new-rolled">
        <input
          id="new-rolled"
          name="shipsRolled"
          type="checkbox"
          checked={rolled}
          className="size-5"
          onChange={(event) => {
            setTouched(true);
            setRolled(event.target.checked);
          }}
        />
        Ships rolled
      </label>
    </>
  );
}

function RolledField({ id, defaultChecked }: { id: string; defaultChecked: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor={id}>
      <input id={id} name="shipsRolled" type="checkbox" defaultChecked={defaultChecked} className="size-5" />
      Ships rolled
    </label>
  );
}

function PaperField({ id, defaultValue }: { id: string; defaultValue: string }) {
  return (
    <label className="block text-sm" htmlFor={id}>
      Paper or finish
      <input
        id={id}
        name="paper"
        maxLength={200}
        defaultValue={defaultValue}
        className={fieldClass}
      />
    </label>
  );
}
