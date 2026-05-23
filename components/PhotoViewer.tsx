"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useCallback, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Info, X as XIcon } from "lucide-react";
import type { CloudinaryImage } from "@/lib/cloudinary";
import { getPhotoId } from "@/lib/utils";
import LogoSpinner from "@/components/LogoSpinner";

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

const SWIPE_THRESHOLD = 60; // px to trigger photo change
const TAP_THRESHOLD = 8; // px tolerance for tap detection

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
  const [showMeta, setShowMeta] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const navigatingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastMoveRef = useRef<{ x: number; y: number } | null>(null);
  const directionRef = useRef<"h" | "v" | null>(null);
  const widthRef = useRef(0);

  const buildPhotoUrl = useCallback(
    (id: string) =>
      collection
        ? `/photo/${id}?collection=${encodeURIComponent(collection)}`
        : `/photo/${id}`,
    [collection]
  );

  const navigateTo = useCallback(
    (id: string | null) => {
      if (!id || navigatingRef.current) return;
      navigatingRef.current = true;
      router.replace(buildPhotoUrl(id), { scroll: false });
    },
    [router, buildPhotoUrl]
  );

  // Lock body scroll + disable pull-to-refresh while the viewer is mounted
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevOverscroll = html.style.overscrollBehavior;
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prevOverflow;
      html.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  // When image changes, release the navigating lock and reset drag
  useEffect(() => {
    navigatingRef.current = false;
    setShowMeta(false);
    setDragX(0);
    setIsAnimating(false);
    setIsImageLoaded(false);
    setShowSpinner(false);

    // Remember which photo is on-screen so the gallery can land on it when we close
    const galleryPath = collection
      ? `/collection/${encodeURIComponent(collection)}`
      : "/";
    sessionStorage.setItem(`lastPhoto:${galleryPath}`, getPhotoId(image.public_id));
  }, [image.public_id, collection]);

  // Only show the spinner if loading takes more than 250ms — otherwise a quick
  // (cached/prefetched) load just flashes and looks worse than no spinner.
  useEffect(() => {
    if (isImageLoaded) return;
    const t = setTimeout(() => setShowSpinner(true), 250);
    return () => clearTimeout(t);
  }, [image.public_id, isImageLoaded]);

  // Always exit to the gallery this photo belongs to, regardless of how the
  // user arrived. router.back() walks history blindly and would land on
  // /admin (or anywhere else) if that's where the user came from.
  const exitViewer = useCallback(() => {
    const galleryPath = collection
      ? `/collection/${encodeURIComponent(collection)}`
      : "/";
    router.replace(galleryPath, { scroll: false });
  }, [router, collection]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateTo(nextId);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateTo(prevId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        exitViewer();
      } else if (e.key === "i" || e.key === "I") {
        setShowMeta((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateTo, exitViewer, nextId, prevId]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      startRef.current = null;
      return;
    }
    widthRef.current = window.innerWidth;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    lastMoveRef.current = { x: t.clientX, y: t.clientY };
    directionRef.current = null;
    setIsAnimating(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!startRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    lastMoveRef.current = { x: t.clientX, y: t.clientY };

    // Lock direction after first meaningful move
    if (!directionRef.current) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        directionRef.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      } else {
        return;
      }
    }

    if (directionRef.current === "h") {
      // Resist when there's no neighbor
      let next = dx;
      if (dx > 0 && !prevId) next = dx * 0.25;
      if (dx < 0 && !nextId) next = dx * 0.25;
      setDragX(next);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = startRef.current;
    const last = lastMoveRef.current;
    startRef.current = null;
    if (!start) return;

    const dx = (last?.x ?? start.x) - start.x;
    const dy = (last?.y ?? start.y) - start.y;
    const elapsed = Date.now() - start.t;
    const totalMove = Math.hypot(dx, dy);

    // Tap → exit (only on background, not on interactive elements)
    if (totalMove < TAP_THRESHOLD && elapsed < 400) {
      const target = e.target as HTMLElement;
      if (!isInteractive(target)) exitViewer();
      return;
    }

    // Swipe gesture
    if (directionRef.current === "h") {
      const velocity = Math.abs(dx) / Math.max(elapsed, 1); // px/ms
      const triggered =
        Math.abs(dx) > SWIPE_THRESHOLD || velocity > 0.5;

      if (triggered && dx < 0 && nextId) {
        // animate off-screen left then navigate
        setIsAnimating(true);
        setDragX(-widthRef.current);
        setTimeout(() => navigateTo(nextId), 180);
      } else if (triggered && dx > 0 && prevId) {
        setIsAnimating(true);
        setDragX(widthRef.current);
        setTimeout(() => navigateTo(prevId), 180);
      } else {
        // snap back
        setIsAnimating(true);
        setDragX(0);
      }
    }
  };

  // EXIF helpers
  const meta = image.image_metadata || {};

  // Resolve the most accurate timestamp:
  //   1. EXIF DateTimeOriginal (+ SubSecTimeOriginal for ms) — when taken
  //   2. EXIF DateTime / CreateDate — fallback EXIF fields
  //   3. image.created_at — upload time
  // Display-only — does not affect gallery sort (which uses upload time).
  const taken = resolveDate(meta, image.created_at);

  const formattedTaken = formatTakenDate(taken.date, taken.hasTime, taken.hasSubsec);

  // Hijri formatting differs slightly between Node ICU and browser ICU
  // (e.g. "٧ شعبان، ١٤٤٧" vs "٧ شعبان ١٤٤٧"), which causes a hydration mismatch.
  // Compute it only on the client.
  const [hijriDate, setHijriDate] = useState<string>("");
  useEffect(() => {
    setHijriDate(formatHijri(taken.date));
  }, [taken.date]);
  const camera =
    meta.Make && meta.Model
      ? `${meta.Make} ${meta.Model}`.replace(/\s+/g, " ").trim()
      : meta.Model || null;
  const lens = meta.LensModel || meta.Lens || null;
  const focalLength = meta.FocalLength || meta.FocalLengthIn35mmFormat || null;
  const aperture = meta.FNumber || meta.ApertureValue || null;
  const shutter = meta.ExposureTime || meta.ShutterSpeedValue || null;
  const iso = meta.ISO || meta.ISOSpeedRatings || null;
  const colorProfile = meta.ProfileDescription || null;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const dimensions =
    image.original_width && image.original_height
      ? `${image.original_width} × ${image.original_height}`
      : null;
  const fileSize = formatBytes(image.bytes);
  const formatLabel = image.format?.toUpperCase() || null;
  const hasExif = !!(camera || lens || focalLength || aperture || shutter || iso);

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!isInteractive(target)) exitViewer();
      }}
      style={{
        touchAction: "none",
        overscrollBehavior: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Preload neighbors */}
      {prevImageUrl && <link rel="preload" as="image" href={prevImageUrl} />}
      {nextImageUrl && <link rel="preload" as="image" href={nextImageUrl} />}

      {/* Loading spinner — only after 250ms grace period to avoid flashing on quick loads */}
      {!isImageLoaded && showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <LogoSpinner size={56} />
        </div>
      )}

      {/* Close button */}
      <button
        data-interactive
        onClick={(e) => {
          e.stopPropagation();
          exitViewer();
        }}
        className="absolute top-4 right-4 z-50 text-white/50 hover:text-white p-2 transition-colors"
        aria-label="Close"
      >
        <XIcon className="w-6 h-6" strokeWidth={1.5} />
      </button>

      {/* Desktop nav arrows */}
      {prevId && (
        <button
          data-interactive
          onClick={(e) => {
            e.stopPropagation();
            navigateTo(prevId);
          }}
          className="hidden sm:flex absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40 text-white/30 hover:text-white/80 p-3 transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-10 h-10" strokeWidth={1} />
        </button>
      )}
      {nextId && (
        <button
          data-interactive
          onClick={(e) => {
            e.stopPropagation();
            navigateTo(nextId);
          }}
          className="hidden sm:flex absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 text-white/30 hover:text-white/80 p-3 transition-colors"
          aria-label="Next photo"
        >
          <ChevronRight className="w-10 h-10" strokeWidth={1} />
        </button>
      )}

      {/* Swipe-animated image. Container has the image's aspect ratio and
          grows to fill 90vw × 85vh — `object-contain` then scales the image
          (up *or* down) to fit, so small originals no longer appear tiny. */}
      <div
        data-interactive
        className="relative z-20 flex items-center justify-center w-full h-full p-4 sm:p-8 md:p-12 will-change-transform pointer-events-none"
        style={{
          transform: `translate3d(${dragX}px, 0, 0)`,
          transition: isAnimating ? "transform 180ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
      >
        <div
          className="relative max-w-[90vw] max-h-[85vh] w-full h-full"
          style={{ aspectRatio: `${image.width} / ${image.height}` }}
        >
          <Image
            src={image.secure_url}
            alt=""
            fill
            sizes="90vw"
            className={`object-contain transition-opacity duration-200 ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
            priority
            placeholder="empty"
            style={{ imageOrientation: "from-image" }}
            draggable={false}
            onLoad={() => setIsImageLoaded(true)}
          />
        </div>
      </div>

      {/* Metadata panel */}
      {showMeta && (
        <div
          data-interactive
          className="absolute bottom-14 left-0 right-0 z-30 flex justify-center pointer-events-none sm:hidden"
        >
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-5 py-3 max-w-md pointer-events-auto mx-4">
            <div className="flex flex-col items-center gap-2">
              {hasExif && (
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-white/60 text-[11px] tracking-wide">
                  {camera && <span>{camera}</span>}
                  {lens && <span>{lens}</span>}
                  {focalLength && (
                    <span>
                      {focalLength}
                      {typeof focalLength === "string" && !focalLength.includes("mm") ? "mm" : ""}
                    </span>
                  )}
                  {aperture && <span>f/{aperture}</span>}
                  {shutter && <span>{shutter}s</span>}
                  {iso && <span>ISO {iso}</span>}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-3 text-white/40 text-[10px] tracking-wider">
                {dimensions && <span>{dimensions}</span>}
                {formatLabel && <span>{formatLabel}</span>}
                {fileSize && <span>{fileSize}</span>}
                {colorProfile && <span>{colorProfile}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        data-interactive
        className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1.5 text-white/40 text-xs tracking-wide z-30 px-4 pb-2"
      >
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <span className="tabular-nums">{formattedTaken}</span>
          {hijriDate && (
            <>
              <span className="text-white/20">·</span>
              <span dir="rtl" lang="ar" className="font-medium">
                {hijriDate}
              </span>
            </>
          )}
          <span className="hidden sm:inline text-white/20">·</span>
          <span className="hidden sm:inline tabular-nums text-[11px]">
            {currentIndex + 1} / {total}
          </span>
        </div>
        
        {/* Desktop inline metadata */}
        <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-white/50 text-[11px]">
          {camera && <span>{camera}</span>}
          {lens && <span>{lens}</span>}
          {focalLength && (
            <span>
              {focalLength}
              {typeof focalLength === "string" && !focalLength.includes("mm") ? "mm" : ""}
            </span>
          )}
          {aperture && <span>f/{aperture}</span>}
          {shutter && <span>{shutter}s</span>}
          {iso && <span>ISO {iso}</span>}
          {hasExif && (dimensions || fileSize || formatLabel || colorProfile) && (
            <span className="text-white/20">|</span>
          )}
          {dimensions && <span>{dimensions}</span>}
          {formatLabel && <span>{formatLabel}</span>}
          {fileSize && <span>{fileSize}</span>}
          {colorProfile && <span>{colorProfile}</span>}
        </div>

        {/* Mobile secondary row: Index and Info button */}
        <div className="flex sm:hidden items-center gap-3 text-[11px] mt-0.5">
          <span className="tabular-nums">
            {currentIndex + 1} / {total}
          </span>
          <span className="text-white/20">·</span>
          <button
            data-interactive
            onClick={(e) => {
              e.stopPropagation();
              setShowMeta((v) => !v);
            }}
            className="text-white/40 hover:text-white/80 transition-colors p-1 -m-1"
            aria-label="Toggle metadata"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function isInteractive(el: HTMLElement | null): boolean {
  let node: HTMLElement | null = el;
  while (node) {
    if (node.tagName === "BUTTON" || node.tagName === "A") return true;
    if (node.dataset?.interactive !== undefined) return true;
    node = node.parentElement;
  }
  return false;
}

// --- Date helpers -----------------------------------------------------------

type ResolvedDate = {
  date: Date;
  source: "exif" | "upload";
  hasTime: boolean;
  hasSubsec: boolean;
};

// EXIF dates look like "YYYY:MM:DD HH:MM:SS" (no timezone).
// SubSecTimeOriginal is decimal fraction of a second as a string ("123" = 0.123s).
function parseExifDate(value: string, subsec?: string): Date | null {
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  const ms = subsec ? parseInt(subsec.padEnd(3, "0").slice(0, 3), 10) : 0;
  const date = new Date(
    parseInt(y, 10),
    parseInt(mo, 10) - 1,
    parseInt(d, 10),
    hh ? parseInt(hh, 10) : 0,
    mm ? parseInt(mm, 10) : 0,
    ss ? parseInt(ss, 10) : 0,
    ms
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveDate(meta: Record<string, string>, uploadedAt: string): ResolvedDate {
  const exifCandidate =
    meta.DateTimeOriginal || meta.CreateDate || meta.DateTime || meta.DateTimeDigitized;
  const subsec =
    meta.SubSecTimeOriginal || meta.SubSecTime || meta.SubSecTimeDigitized;

  if (exifCandidate) {
    const parsed = parseExifDate(exifCandidate, subsec);
    if (parsed) {
      const hasTime = /\d{2}:\d{2}:\d{2}/.test(exifCandidate);
      return {
        date: parsed,
        source: "exif",
        hasTime,
        hasSubsec: !!subsec && hasTime,
      };
    }
  }

  return {
    date: new Date(uploadedAt),
    source: "upload",
    hasTime: true,
    hasSubsec: false,
  };
}

function formatTakenDate(date: Date, hasTime: boolean, hasSubsec: boolean): string {
  const dateStr = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);

  if (!hasTime) return dateStr;

  const timeStr = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  const ms = hasSubsec ? `.${String(date.getMilliseconds()).padStart(3, "0")}` : "";
  return `${dateStr}, ${timeStr}${ms}`;
}

function formatHijri(date: Date): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    // Fallback for environments without Umalqura calendar support
    return new Intl.DateTimeFormat("ar-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }
}
