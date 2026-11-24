"use client";

import type { ReactNode } from "react";

const controlClass =
  "w-full border border-line bg-transparent px-3 py-3 text-base leading-6 text-foreground";

export function CommissionForm() {
  return (
    <form
      className="mt-8 flex flex-col gap-5"
      aria-describedby="commission-notice"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <p
        id="commission-notice"
        className="border border-line bg-mat px-4 py-3 text-sm leading-6"
      >
        Submissions aren’t enabled yet. This is a preview of the form, and
        nothing entered here is sent.
      </p>

      <Field id="commission-name" label="Name">
        <input
          id="commission-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className={controlClass}
        />
      </Field>

      <Field id="commission-email" label="Email">
        <input
          id="commission-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className={controlClass}
        />
      </Field>

      <Field id="commission-description" label="Project description">
        <textarea
          id="commission-description"
          name="description"
          rows={6}
          required
          className={controlClass}
        />
      </Field>

      <h2 className="pt-3 text-xs uppercase tracking-[0.16em] text-muted">
        Optional details
      </h2>

      <Field id="commission-size" label="Size" optional>
        <input
          id="commission-size"
          name="size"
          type="text"
          className={controlClass}
        />
      </Field>

      <Field id="commission-budget" label="Budget" optional>
        <input
          id="commission-budget"
          name="budget"
          type="text"
          className={controlClass}
        />
      </Field>

      <Field id="commission-deadline" label="Deadline" optional>
        <input
          id="commission-deadline"
          name="deadline"
          type="text"
          className={controlClass}
        />
      </Field>

      <Field id="commission-reference" label="Reference link" optional>
        <input
          id="commission-reference"
          name="reference"
          type="url"
          inputMode="url"
          autoComplete="url"
          className={controlClass}
        />
      </Field>

      <button
        type="submit"
        disabled
        aria-describedby="commission-notice"
        className="mt-2 inline-flex min-h-11 items-center justify-center bg-foreground px-5 text-sm text-background disabled:cursor-not-allowed disabled:opacity-40"
      >
        Submit request
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  optional = false,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">
        {label}{" "}
        <span className="text-muted">{optional ? "(optional)" : "(required)"}</span>
      </label>
      {children}
    </div>
  );
}
