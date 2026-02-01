"use client";

import Image from "next/image";
import Link from "next/link";
import type { CloudinaryImage } from "@/lib/cloudinary";
import { getPhotoId } from "@/lib/utils";

interface GalleryProps {
  images: CloudinaryImage[];
  collection?: string;
}

export default function Gallery({ images, collection }: GalleryProps) {
  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-white/40 text-sm tracking-wide">No photos yet</p>
      </div>
    );
  }

  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-2">
      {images.map((image, index) => {
        const photoId = getPhotoId(image.public_id);
        const href = collection 
          ? `/photo/${photoId}?collection=${encodeURIComponent(collection)}`
          : `/photo/${photoId}`;
        return (
          <Link
            key={image.public_id}
            href={href}
            className="block mb-2 break-inside-avoid cursor-pointer group active:opacity-70 transition-opacity duration-150"
            prefetch={index < 8}
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
          </Link>
        );
      })}
    </div>
  );
}
