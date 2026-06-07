"use client";

import Image from "next/image";
import { useState } from "react";
import { Lightbox } from "@/components/lightbox";
import { cn } from "@/lib/cn";
import type { PostAttachment } from "@/lib/database.types";

const GRID_SIZES = "(max-width: 768px) 50vw, 320px";
const SINGLE_SIZES = "(max-width: 768px) 100vw, 640px";

/**
 * Responsive image gallery for a post. One image shows at its (clamped) aspect
 * ratio; 2–4 use a grid; 5+ shows the first four with a "+N" overlay. Tapping
 * any tile opens a swipeable full-screen lightbox.
 */
export function PostGallery({ images }: { images: PostAttachment[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const lightboxImages = images.map((img) => ({
    url: img.url,
    alt: img.file_name ?? "",
  }));

  const open = (i: number) => setLightboxIndex(i);

  return (
    <>
      {images.length === 1 ? (
        <Single image={images[0]} onOpen={() => open(0)} />
      ) : (
        <Grid images={images} onOpen={open} />
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

function Single({
  image,
  onOpen,
}: {
  image: PostAttachment;
  onOpen: () => void;
}) {
  // Clamp the aspect ratio so very tall/wide images stay reasonable in-feed.
  const ratio =
    image.width && image.height
      ? Math.min(Math.max(image.width / image.height, 0.75), 1.91)
      : 4 / 3;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ aspectRatio: ratio }}
      className="relative mt-3 block w-full overflow-hidden rounded-xl border border-border bg-surface-2"
    >
      <Image
        src={image.url}
        alt={image.file_name ?? ""}
        fill
        sizes={SINGLE_SIZES}
        className="object-cover"
      />
    </button>
  );
}

function Grid({
  images,
  onOpen,
}: {
  images: PostAttachment[];
  onOpen: (i: number) => void;
}) {
  const count = images.length;
  const visible = images.slice(0, 4);
  const extra = count - 4;

  // 3 images: tall first tile on the left, two stacked on the right.
  const isThree = count === 3;

  return (
    <div
      className={cn(
        "mt-3 grid gap-1 overflow-hidden rounded-xl border border-border",
        isThree ? "grid-cols-2 grid-rows-2" : "grid-cols-2",
      )}
    >
      {visible.map((img, i) => (
        <button
          key={img.id}
          type="button"
          onClick={() => onOpen(i)}
          className={cn(
            "relative bg-surface-2",
            isThree && i === 0 ? "row-span-2 aspect-auto" : "aspect-square",
          )}
        >
          <Image
            src={img.url}
            alt={img.file_name ?? ""}
            fill
            sizes={GRID_SIZES}
            className="object-cover"
          />
          {extra > 0 && i === 3 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white">
              +{extra}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
