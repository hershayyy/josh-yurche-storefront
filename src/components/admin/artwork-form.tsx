"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/admin/actions";
import {
  availabilityLabel,
  toggleAvailability,
  type Artwork,
  type ArtworkAvailability,
} from "@/lib/artwork";

const fieldClass =
  "mt-2 w-full border border-line bg-background px-3 py-3 text-base";
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center bg-foreground px-4 text-sm text-background disabled:opacity-60 sm:w-auto";

const OFFERINGS: ArtworkAvailability[] = [
  "gallery-only",
  "preorder",
  "prints",
  "original-available",
  "original-sold",
];

type ArtworkFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  artwork?: Artwork;
  featured?: boolean;
  submitLabel: string;
};

export function ArtworkForm({
  action,
  artwork,
  featured = false,
  submitLabel,
}: ArtworkFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const [offerings, setOfferings] = useState<ArtworkAvailability[]>(
    artwork?.availability ?? ["gallery-only"],
  );

  return (
    <form action={formAction} className="grid gap-5">
      <label className="block text-sm" htmlFor="title">
        Title
        <input
          id="title"
          name="title"
          required
          maxLength={80}
          defaultValue={artwork?.title ?? ""}
          className={fieldClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm" htmlFor="widthInches">
          Width (inches)
          <input
            id="widthInches"
            name="widthInches"
            inputMode="decimal"
            required
            defaultValue={artwork?.widthInches ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm" htmlFor="heightInches">
          Height (inches)
          <input
            id="heightInches"
            name="heightInches"
            inputMode="decimal"
            required
            defaultValue={artwork?.heightInches ?? ""}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="block text-sm" htmlFor="status">
        Painting status
        <select
          id="status"
          name="status"
          defaultValue={artwork?.status ?? "in-progress"}
          className={fieldClass}
        >
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <fieldset>
        <legend className="text-sm">Offering</legend>
        <div className="mt-2 grid gap-1">
          {OFFERINGS.map((offering) => (
            <label
              key={offering}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                name="availability"
                value={offering}
                checked={offerings.includes(offering)}
                onChange={() =>
                  setOfferings((current) => toggleAvailability(current, offering))
                }
                className="size-5"
              />
              {availabilityLabel[offering]}
            </label>
          ))}
        </div>
        <span className="mt-2 block text-sm leading-6 text-muted">
          Original available or Original sold can be paired with open for
          pre-order or prints. The original status is shown first. Homepage
          featuring is separate from this. Print sizes are edited below.
        </span>
      </fieldset>
      <label className="block text-sm" htmlFor="estimatedCompletion">
        Estimated painting completion
        <input
          id="estimatedCompletion"
          name="estimatedCompletion"
          maxLength={80}
          defaultValue={artwork?.estimatedCompletion ?? ""}
          className={fieldClass}
        />
        <span className="mt-2 block text-sm leading-6 text-muted">
          Shown with the original. Leave blank to hide it.
        </span>
      </label>
      <label className="block text-sm" htmlFor="estimatedPrintShipping">
        Estimated print shipping
        <input
          id="estimatedPrintShipping"
          name="estimatedPrintShipping"
          maxLength={80}
          defaultValue={artwork?.estimatedPrintShipping ?? ""}
          className={fieldClass}
        />
        <span className="mt-2 block text-sm leading-6 text-muted">
          Shown with the print details. Leave blank to hide it.
        </span>
      </label>
      {artwork ? (
        <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor="featured">
          <input
            id="featured"
            name="featured"
            type="checkbox"
            defaultChecked={featured}
            className="size-5"
          />
          Feature on the homepage
        </label>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-sm">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
