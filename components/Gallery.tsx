"use client";

import Image from "next/image";
import { useState } from "react";
import type { CloudinaryImage } from "@/lib/cloudinary";

interface GalleryProps {
  images: CloudinaryImage[];
}

export default function Gallery({ images }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<CloudinaryImage | null>(null);

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-white/40 text-sm tracking-wide">No photos yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-1 sm:gap-2">
        {images.map((image) => (
          <div
            key={image.public_id}
            className="mb-1 sm:mb-2 break-inside-avoid cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            <Image
              src={image.secure_url}
              alt=""
              width={image.width}
              height={image.height}
              placeholder="blur"
              blurDataURL={image.blur_data_url}
              className="w-full h-auto"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl"
            onClick={() => setSelectedImage(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <Image
            src={selectedImage.secure_url}
            alt=""
            width={selectedImage.width}
            height={selectedImage.height}
            className="max-h-[90vh] max-w-full w-auto h-auto object-contain"
            priority
          />
        </div>
      )}
    </>
  );
}
