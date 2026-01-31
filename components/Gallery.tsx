"use client";

import Image from "next/image";
import { useState, useCallback } from "react";
import type { CloudinaryImage } from "@/lib/cloudinary";

interface GalleryProps {
  images: CloudinaryImage[];
}

export default function Gallery({ images }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<CloudinaryImage | null>(null);

  const handleImageClick = useCallback((image: CloudinaryImage) => {
    setSelectedImage(image);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedImage(null);
  }, []);

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-white/40 text-sm tracking-wide">No photos yet</p>
      </div>
    );
  }

  return (
    <>
      {/* CSS Columns Masonry Layout - eliminates black gaps */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-2">
        {images.map((image, index) => (
          <div
            key={image.public_id}
            className="mb-2 break-inside-avoid cursor-pointer group active:opacity-70 transition-opacity duration-150"
            onClick={() => handleImageClick(image)}
          >
            <Image
              src={image.secure_url}
              alt=""
              width={image.width}
              height={image.height}
              placeholder={image.blur_data_url ? "blur" : "empty"}
              blurDataURL={image.blur_data_url}
              className="w-full h-auto rounded-sm"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading={index < 8 ? "eager" : "lazy"}
              style={{ imageOrientation: "from-image" }}
            />
          </div>
        ))}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl"
            onClick={closeModal}
            aria-label="Close"
          >
            ✕
          </button>
          <Image
            src={selectedImage.secure_url}
            alt=""
            width={selectedImage.width}
            height={selectedImage.height}
            className="max-h-[90vh] max-w-full w-auto h-auto object-contain rounded-sm"
            priority
            style={{ imageOrientation: "from-image" }}
          />
        </div>
      )}
    </>
  );
}
