"use client";

import Image from "next/image";
import { useState } from "react";

type ArtworkMediaProps = {
  src?: string;
  alt: string;
  placeholder: string;
  sizes: string;
  preload?: boolean;
};

export function ArtworkMedia({
  src,
  alt,
  placeholder,
  sizes,
  preload = false,
}: ArtworkMediaProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt || placeholder}
        className="absolute inset-0 flex items-center justify-center bg-mat px-6"
      >
        <p
          aria-hidden="true"
          className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-mat-ink"
        >
          {placeholder}
        </p>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      draggable={false}
      className="object-contain"
      onError={() => setFailed(true)}
      {...(preload ? { preload: true } : {})}
    />
  );
}
