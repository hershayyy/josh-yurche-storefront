"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { ArtworkMedia } from "@/components/artwork-media";

type Slide = {
  src: string;
  alt: string;
};

type ArtworkCarouselProps = {
  images: Slide[];
  label: string;
  widthInches: number;
  heightInches: number;
  preloadLead?: boolean;
};

export function ArtworkCarousel({
  images,
  label,
  widthInches,
  heightInches,
  preloadLead = false,
}: ArtworkCarouselProps) {
  const slides: Slide[] =
    images.length > 0
      ? images
      : [
          {
            src: "",
            alt: `${label}, progress photo not yet added`,
          },
        ];
  const count = slides.length;
  const multiple = count > 1;
  const slideId = useId();
  const start = useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [hasAnnounced, setHasAnnounced] = useState(false);
  const active = Math.min(index, count - 1);
  const slide = slides[active];

  function move(delta: number) {
    setHasAnnounced(true);
    setIndex((current) => {
      const base = Math.min(current, count - 1);
      return (base + delta + count) % count;
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (count < 2) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!start.current || count < 2) {
      start.current = null;
      return;
    }

    const deltaX = event.clientX - start.current.x;
    const deltaY = event.clientY - start.current.y;
    start.current = null;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    move(deltaX < 0 ? 1 : -1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (count < 2) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
  }

  return (
    <section
      aria-roledescription={multiple ? "carousel" : undefined}
      aria-label={multiple ? `${label} progress photos` : undefined}
      className="artwork-stage mx-auto outline-none md:mx-0"
      tabIndex={multiple ? 0 : undefined}
      onKeyDown={onKeyDown}
    >
      <div
        id={slideId}
        className="relative w-full touch-pan-y overflow-hidden border border-line bg-mat"
        style={{ aspectRatio: `${widthInches} / ${heightInches}` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        <ArtworkMedia
          key={`${active}-${slide.src}`}
          src={slide.src}
          alt={slide.alt}
          placeholder="Progress photo"
          sizes="(max-width: 768px) 70vw, 480px"
          preload={Boolean(preloadLead && active === 0 && slide.src)}
        />
      </div>

      {multiple ? (
        <div className="mt-3 grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center">
          <CarouselButton
            label="Previous progress photo"
            controls={slideId}
            onClick={() => move(-1)}
          >
            <Chevron direction="left" />
          </CarouselButton>

          <p
            aria-live={hasAnnounced ? "polite" : "off"}
            className="min-w-0 text-center text-sm tabular-nums whitespace-nowrap text-muted"
          >
            <span aria-hidden="true">
              {active + 1} / {count}
            </span>
            <span className="sr-only">
              Progress photo {active + 1} of {count}. {slide.alt}
            </span>
          </p>

          <CarouselButton
            label="Next progress photo"
            controls={slideId}
            onClick={() => move(1)}
          >
            <Chevron direction="right" />
          </CarouselButton>
        </div>
      ) : null}
    </section>
  );
}

function CarouselButton({
  label,
  controls,
  onClick,
  children,
}: {
  label: string;
  controls: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-controls={controls}
      onClick={onClick}
      className="grid h-[44px] w-[44px] place-items-center border border-line bg-background hover:bg-mat"
    >
      {children}
    </button>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
    >
      <path
        d={direction === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}
