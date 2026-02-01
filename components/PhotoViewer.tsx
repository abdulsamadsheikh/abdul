"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useCallback, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CloudinaryImage } from "@/lib/cloudinary";

interface PhotoViewerProps {
  image: CloudinaryImage;
  prevId: string | null;
  nextId: string | null;
  prevImageUrl?: string;
  nextImageUrl?: string;
  currentIndex: number;
  total: number;
  collection?: string;
}

export default function PhotoViewer({
  image,
  prevId,
  nextId,
  prevImageUrl,
  nextImageUrl,
  currentIndex,
  total,
  collection,
}: PhotoViewerProps) {
  const router = useRouter();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Build URL with optional collection query param
  const buildPhotoUrl = (id: string) => {
    return collection 
      ? `/photo/${id}?collection=${encodeURIComponent(collection)}`
      : `/photo/${id}`;
  };

  // Back URL - collection page or main gallery
  const backUrl = collection 
    ? `/collection/${encodeURIComponent(collection)}`
    : "/";

  const navigateTo = useCallback(
    (id: string | null) => {
      if (id && !isNavigating) {
        setIsNavigating(true);
        router.push(buildPhotoUrl(id));
        // Reset after navigation
        setTimeout(() => setIsNavigating(false), 300);
      }
    },
    [router, isNavigating, collection]
  );

  const goBack = useCallback(() => {
    router.push(backUrl);
  }, [router, backUrl]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          navigateTo(nextId);
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigateTo(prevId);
          break;
        case "Escape":
          e.preventDefault();
          goBack();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateTo, goBack, nextId, prevId]);

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      navigateTo(nextId);
    } else if (isRightSwipe) {
      navigateTo(prevId);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Prefetch next/prev images */}
      {prevImageUrl && (
        <link rel="prefetch" href={prevImageUrl} as="image" />
      )}
      {nextImageUrl && (
        <link rel="prefetch" href={nextImageUrl} as="image" />
      )}

      {/* Close button */}
      <Link
        href={backUrl}
        className="absolute top-4 right-4 z-50 text-white/40 hover:text-white/80 transition-colors p-2"
        aria-label="Close"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </Link>

      {/* Navigation arrows */}
      {prevId && (
        <button
          onClick={() => navigateTo(prevId)}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 text-white/20 hover:text-white/60 transition-colors p-2 sm:p-3"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={1} />
        </button>
      )}

      {nextId && (
        <button
          onClick={() => navigateTo(nextId)}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 text-white/20 hover:text-white/60 transition-colors p-2 sm:p-3"
          aria-label="Next photo"
        >
          <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={1} />
        </button>
      )}

      {/* Main image container */}
      <div 
        className="relative w-full h-full flex items-center justify-center p-4 sm:p-8 md:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={image.secure_url}
          alt=""
          width={image.width}
          height={image.height}
          className="max-h-[85vh] max-w-full w-auto h-auto object-contain"
          priority
          style={{ imageOrientation: "from-image" }}
          placeholder={image.blur_data_url ? "blur" : "empty"}
          blurDataURL={image.blur_data_url}
        />
      </div>

      {/* Date and counter at bottom */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 text-white/30 text-xs tracking-wide">
        <span>{formatDate(image.created_at)}</span>
        <span>·</span>
        <span>
          {currentIndex + 1} / {total}
        </span>
      </div>
    </div>
  );
}
