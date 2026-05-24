"use client";

import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import type { CloudinaryImage } from "@/lib/cloudinary";
import { getPhotoId } from "@/lib/utils";
import LogoSpinner from "@/components/LogoSpinner";

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
  index: number;
}

// useLayoutEffect on client only — avoids SSR warning
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const GAP = 8;

function getColumnCount(width: number): number {
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

export default function Gallery({ images, collection }: GalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<PositionedImage[]>([]);
  const [containerHeight, setContainerHeight] = useState(0);

  const compute = useCallback(() => {
    const el = containerRef.current;
    if (!el || images.length === 0) return;

    const containerWidth = el.offsetWidth;
    const cols = getColumnCount(window.innerWidth);
    const colW = (containerWidth - GAP * (cols - 1)) / cols;
    const colH: number[] = new Array(cols).fill(0);
    const next: PositionedImage[] = [];

    // Reading order: each image goes to the shortest column.
    // This keeps newest photo top-left, then second top-row second column, etc.
    images.forEach((image, index) => {
      let colIdx = 0;
      let minH = colH[0];
      for (let i = 1; i < cols; i++) {
        if (colH[i] < minH) {
          minH = colH[i];
          colIdx = i;
        }
      }
      const aspect = image.height / image.width;
      const h = colW * aspect;
      next.push({
        image,
        x: colIdx * (colW + GAP),
        y: colH[colIdx],
        width: colW,
        height: h,
        index,
      });
      colH[colIdx] += h + GAP;
    });

    setPositions(next);
    setContainerHeight(Math.max(...colH));
  }, [images]);

  // Synchronous layout before paint to avoid scroll-restoration flicker
  useIsoLayoutEffect(() => {
    compute();
  }, [compute]);

  // Throttled resize handler
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [compute]);

  // Debounced scroll-position save, keyed by pathname. Used as a fallback
  // when no last-viewed photo is recorded.
  useEffect(() => {
    const key = `scroll:${window.location.pathname}`;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        sessionStorage.setItem(key, String(window.scrollY));
      }, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, []);

  // Restore scroll once positions exist. Priority:
  //   1. lastPhoto:<path>  → scroll to whichever photo the user last viewed
  //   2. scroll:<path>     → fall back to raw scrollY
  // Runs only once per mount so a window resize doesn't yank the viewport.
  const restoredRef = useRef(false);
  useIsoLayoutEffect(() => {
    if (containerHeight === 0 || restoredRef.current) return;
    const path = window.location.pathname;

    const lastPhotoId = sessionStorage.getItem(`lastPhoto:${path}`);
    if (lastPhotoId) {
      const pos = positions.find(
        (p) => getPhotoId(p.image.public_id) === lastPhotoId
      );
      if (pos) {
        // Header (logo) ~64px + nav (~52px) ≈ 130px of fixed chrome.
        // Land the photo just under the chrome.
        const HEADER_OFFSET = 130;
        const y = Math.max(0, pos.y - HEADER_OFFSET + 8);
        window.scrollTo(0, y);
        sessionStorage.removeItem(`lastPhoto:${path}`);
        restoredRef.current = true;
        return;
      }
    }

    const saved = sessionStorage.getItem(`scroll:${path}`);
    if (saved) {
      const y = parseInt(saved, 10);
      if (!Number.isNaN(y) && y > 0) {
        window.scrollTo(0, y);
      }
    }
    restoredRef.current = true;
  }, [containerHeight, positions]);

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
      {positions.map(({ image, x, y, width, height, index }) => {
        const photoId = getPhotoId(image.public_id);
        const href = collection
          ? `/photo/${photoId}?collection=${encodeURIComponent(collection)}`
          : `/photo/${photoId}`;
        return (
          <Link
            key={image.public_id}
            href={href}
            prefetch
            className="absolute cursor-pointer active:opacity-70 transition-opacity duration-150 rounded-sm overflow-hidden bg-black flex items-center justify-center"
            style={{
              transform: `translate3d(${x}px, ${y}px, 0)`,
              width: `${width}px`,
              height: `${height}px`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <Image src="/logo.png" alt="" width={48} height={48} className="object-contain" priority={index < 6} />
            </div>
            <Image
              src={image.secure_url}
              alt=""
              width={image.width}
              height={image.height}
              placeholder="empty"
              className="w-full h-full object-cover relative z-10"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading={index < 8 ? "eager" : "lazy"}
              fetchPriority={index < 4 ? "high" : "auto"}
              style={{ imageOrientation: "from-image" }}
            />
            <PendingOverlay />
          </Link>
        );
      })}
    </div>
  );
}

// Renders inside a <Link> — useLinkStatus reports `pending` while Next.js is
// fetching the destination route. Shows the rotating logo immediately on click
// so the user gets feedback instead of "nothing happened".
function PendingOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-none">
      <LogoSpinner size={36} />
    </div>
  );
}
