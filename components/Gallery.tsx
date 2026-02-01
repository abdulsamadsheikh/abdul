"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import type { CloudinaryImage } from "@/lib/cloudinary";
import { getPhotoId } from "@/lib/utils";

interface GalleryProps {
  images: CloudinaryImage[];
  collection?: string;
}

interface PositionedImage {
  image: CloudinaryImage;
  x: number;
  y: number;
  width: number;
  height: number;
  originalIndex: number;
}

export default function Gallery({ images, collection }: GalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<PositionedImage[]>([]);
  const [containerHeight, setContainerHeight] = useState(0);
  const gap = 8; // 2 * 4px = 8px gap

  const calculatePositions = useCallback(() => {
    if (!containerRef.current || images.length === 0) return;

    const containerWidth = containerRef.current.offsetWidth;
    let columnCount = 2;
    if (window.innerWidth >= 1024) columnCount = 4;
    else if (window.innerWidth >= 768) columnCount = 3;

    const columnWidth = (containerWidth - gap * (columnCount - 1)) / columnCount;
    const columnHeights = new Array(columnCount).fill(0);
    const newPositions: PositionedImage[] = [];

    // Place each image in the shortest column (maintains reading order priority)
    images.forEach((image, index) => {
      // Find the shortest column
      const minHeight = Math.min(...columnHeights);
      const columnIndex = columnHeights.indexOf(minHeight);

      // Calculate image height based on aspect ratio
      const aspectRatio = image.height / image.width;
      const imageHeight = columnWidth * aspectRatio;

      newPositions.push({
        image,
        x: columnIndex * (columnWidth + gap),
        y: columnHeights[columnIndex],
        width: columnWidth,
        height: imageHeight,
        originalIndex: index,
      });

      columnHeights[columnIndex] += imageHeight + gap;
    });

    setPositions(newPositions);
    setContainerHeight(Math.max(...columnHeights));
  }, [images, gap]);

  useEffect(() => {
    calculatePositions();
    window.addEventListener("resize", calculatePositions);
    return () => window.removeEventListener("resize", calculatePositions);
  }, [calculatePositions]);

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-white/40 text-sm tracking-wide">No photos yet</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="relative w-full"
      style={{ height: containerHeight || "auto" }}
    >
      {positions.map(({ image, x, y, width, height, originalIndex }) => {
        const photoId = getPhotoId(image.public_id);
        const href = collection
          ? `/photo/${photoId}?collection=${encodeURIComponent(collection)}`
          : `/photo/${photoId}`;
        return (
          <Link
            key={image.public_id}
            href={href}
            className="absolute cursor-pointer group active:opacity-70 transition-opacity duration-150"
            style={{
              transform: `translate(${x}px, ${y}px)`,
              width: `${width}px`,
              height: `${height}px`,
            }}
            prefetch={originalIndex < 8}
          >
            <Image
              src={image.secure_url}
              alt=""
              width={image.width}
              height={image.height}
              placeholder={image.blur_data_url ? "blur" : "empty"}
              blurDataURL={image.blur_data_url}
              className="w-full h-full object-cover rounded-sm"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading={originalIndex < 8 ? "eager" : "lazy"}
              style={{ imageOrientation: "from-image" }}
            />
          </Link>
        );
      })}
    </div>
  );
}
