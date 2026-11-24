import type { ReactNode } from "react";

export function PageShell({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full px-5 pb-20 pt-5 sm:px-8 sm:pb-24 sm:pt-8 ${
        narrow ? "max-w-xl" : "max-w-5xl"
      }`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h1
      id={id}
      className="font-serif text-[2.15rem] leading-[1.15] tracking-tight text-balance sm:text-[2.75rem]"
    >
      {children}
    </h1>
  );
}
