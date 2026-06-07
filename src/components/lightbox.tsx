"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LightboxImage = { url: string; alt?: string };

/**
 * Full-screen, swipeable image viewer. Uses native CSS scroll-snap for touch
 * swiping (no JS gesture library), with arrow-key / button navigation and Esc
 * to close on desktop. Locks body scroll while open.
 */
export function Lightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initialIndex);

  const scrollTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }, []);

  // Jump to the tapped image on open and lock background scroll.
  useEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = initialIndex * track.clientWidth;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [initialIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") scrollTo(Math.min(index + 1, images.length - 1));
      if (e.key === "ArrowLeft") scrollTo(Math.max(index - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, scrollTo]);

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }

  const many = images.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm tabular-nums text-white/80">
          {many ? `${index + 1} / ${images.length}` : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/10"
        >
          ×
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="flex w-full shrink-0 snap-center items-center justify-center p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt ?? ""}
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {many && (
        <>
          <NavArrow
            side="left"
            disabled={index === 0}
            onClick={() => scrollTo(index - 1)}
          />
          <NavArrow
            side="right"
            disabled={index === images.length - 1}
            onClick={() => scrollTo(index + 1)}
          />
        </>
      )}
    </div>
  );
}

function NavArrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 disabled:opacity-0 sm:flex ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
