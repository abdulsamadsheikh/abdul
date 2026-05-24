"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useCallback, useState, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Info,
  MapPin,
  Pencil,
  X as XIcon,
} from "lucide-react";
import type { CloudinaryImage } from "@/lib/cloudinary";
import { getPhotoId } from "@/lib/utils";
import LogoSpinner from "@/components/LogoSpinner";
import { useAdminSession } from "@/lib/use-admin-session";
import { useReverseGeocode } from "@/lib/use-reverse-geocode";

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

const SWIPE_THRESHOLD = 60;
const TAP_THRESHOLD = 8;
const LOAD_SAFETY_TIMEOUT = 8000; // ms — never spin forever

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
  const [showMeta, setShowMeta] = useState(false); // mobile-only metadata panel
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const isAdmin = useAdminSession();

  // Caption editing
  const [captionDraft, setCaptionDraft] = useState<string>(image.caption ?? "");
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [displayCaption, setDisplayCaption] = useState<string | undefined>(image.caption);

  // Reverse-geocode GPS → city/country (cached in localStorage)
  const geo = useReverseGeocode(image.location?.lat, image.location?.lng);

  // Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const navigatingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastMoveRef = useRef<{ x: number; y: number } | null>(null);
  const directionRef = useRef<"h" | "v" | null>(null);
  const widthRef = useRef(0);

  // ---------- Navigation ----------

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

  const exitViewer = useCallback(() => {
    const galleryPath = collection
      ? `/collection/${encodeURIComponent(collection)}`
      : "/";
    router.replace(galleryPath, { scroll: false });
  }, [router, collection]);

  // ---------- Body lock ----------

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

  // ---------- Per-photo reset ----------

  useEffect(() => {
    navigatingRef.current = false;
    setShowMeta(false);
    setDragX(0);
    setIsAnimating(false);
    setIsImageLoaded(false);
    setShowSpinner(false);
    setCaptionDraft(image.caption ?? "");
    setDisplayCaption(image.caption);
    setIsEditingCaption(false);
    setCaptionError(null);

    const galleryPath = collection
      ? `/collection/${encodeURIComponent(collection)}`
      : "/";
    sessionStorage.setItem(`lastPhoto:${galleryPath}`, getPhotoId(image.public_id));

    // CRITICAL: if the new image is already in the browser cache, onLoad may
    // not fire. Check img.complete on the next frame to catch that case.
    const raf = requestAnimationFrame(() => {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setIsImageLoaded(true);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [image.public_id, collection, image.caption]);

  // 250ms grace before showing the spinner so quick loads don't flash
  useEffect(() => {
    if (isImageLoaded) {
      setShowSpinner(false);
      return;
    }
    const t = setTimeout(() => setShowSpinner(true), 250);
    return () => clearTimeout(t);
  }, [image.public_id, isImageLoaded]);

  // Safety net: never spin forever. After LOAD_SAFETY_TIMEOUT, force-mark loaded.
  // Handles broken images, network drops, and the onLoad-never-fires Safari bug.
  useEffect(() => {
    if (isImageLoaded) return;
    const safety = setTimeout(() => {
      const img = imgRef.current;
      // If the browser actually completed loading by now, accept it; otherwise
      // give up showing the spinner anyway — broken state is better than infinite spin.
      setIsImageLoaded(true);
      if (!img?.complete || !img?.naturalWidth) {
        console.warn("Image load timeout; clearing spinner anyway", image.public_id);
      }
    }, LOAD_SAFETY_TIMEOUT);
    return () => clearTimeout(safety);
  }, [image.public_id, isImageLoaded]);

  // ---------- Caption save ----------

  const saveCaption = useCallback(async () => {
    if (!isAdmin) return;
    const next = captionDraft.trim();
    setIsSavingCaption(true);
    setCaptionError(null);
    try {
      const res = await fetch("/api/images/caption", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ publicId: image.public_id, caption: next }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      setDisplayCaption(next || undefined);
      setIsEditingCaption(false);
    } catch (err: any) {
      setCaptionError(err?.message || "Failed to save");
    } finally {
      setIsSavingCaption(false);
    }
  }, [isAdmin, captionDraft, image.public_id]);

  // ---------- Keyboard ----------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in the caption editor
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) {
        if (e.key === "Escape") setIsEditingCaption(false);
        return;
      }
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

  // ---------- Touch ----------

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

    if (!directionRef.current) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        directionRef.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      } else {
        return;
      }
    }

    if (directionRef.current === "h") {
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

    if (totalMove < TAP_THRESHOLD && elapsed < 400) {
      const target = e.target as HTMLElement;
      if (!isInteractive(target)) exitViewer();
      return;
    }

    if (directionRef.current === "h") {
      const velocity = Math.abs(dx) / Math.max(elapsed, 1);
      const triggered = Math.abs(dx) > SWIPE_THRESHOLD || velocity > 0.5;

      if (triggered && dx < 0 && nextId) {
        setIsAnimating(true);
        setDragX(-widthRef.current);
        setTimeout(() => navigateTo(nextId), 180);
      } else if (triggered && dx > 0 && prevId) {
        setIsAnimating(true);
        setDragX(widthRef.current);
        setTimeout(() => navigateTo(prevId), 180);
      } else {
        setIsAnimating(true);
        setDragX(0);
      }
    }
  };

  // ---------- Derived metadata ----------

  const meta = image.image_metadata || {};
  const taken = resolveDate(meta, image.created_at);
  const formattedTaken = formatTakenDate(taken.date, taken.hasTime, taken.hasSubsec);

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
  const hasExif = !!(camera || lens || focalLength || aperture || shutter || iso);

  const dimensions =
    image.original_width && image.original_height
      ? `${image.original_width} × ${image.original_height}`
      : null;
  const fileSize = formatBytes(image.bytes);
  const formatLabel = image.format?.toUpperCase() || null;

  const loc = image.location;
  const locationLabel = loc
    ? geo?.city && geo?.country
      ? `${geo.city}, ${geo.country}`
      : geo?.country || geo?.city || null
    : null;
  const coordsLabel = loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : null;
  const mapsHref = loc ? `https://www.google.com/maps/?q=${loc.lat},${loc.lng}` : null;

  // ---------- Render ----------

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col sm:flex-row select-none overflow-hidden"
      style={{
        touchAction: "none",
        overscrollBehavior: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Neighbor preloads */}
      {prevImageUrl && <link rel="preload" as="image" href={prevImageUrl} />}
      {nextImageUrl && <link rel="preload" as="image" href={nextImageUrl} />}

      {/* ─── IMAGE AREA ─── (full screen on mobile, flex-1 on desktop) */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!isInteractive(target)) exitViewer();
        }}
      >
        {/* Loading spinner */}
        {!isImageLoaded && showSpinner && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <LogoSpinner size={56} />
          </div>
        )}

        {/* Mobile-only close button (desktop sidebar has its own) */}
        <button
          data-interactive
          onClick={(e) => {
            e.stopPropagation();
            exitViewer();
          }}
          className="sm:hidden absolute top-4 right-4 z-50 text-white/60 hover:text-white p-2 transition-colors"
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
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-40 text-white/25 hover:text-white/80 p-3 transition-colors"
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
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-40 text-white/25 hover:text-white/80 p-3 transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight className="w-10 h-10" strokeWidth={1} />
          </button>
        )}

        {/* Swipe-animated image */}
        <div
          data-interactive
          className="relative z-20 flex items-center justify-center w-full h-full p-4 sm:p-8 md:p-12 will-change-transform pointer-events-none"
          style={{
            transform: `translate3d(${dragX}px, 0, 0)`,
            transition: isAnimating ? "transform 180ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          }}
        >
          <div
            className="relative max-w-full max-h-full w-full h-full"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            <Image
              ref={imgRef}
              src={image.secure_url}
              alt={displayCaption || ""}
              fill
              sizes="(min-width: 1024px) calc(100vw - 24rem), (min-width: 640px) calc(100vw - 20rem), 100vw"
              className={`object-contain transition-opacity duration-200 ${
                isImageLoaded ? "opacity-100" : "opacity-0"
              }`}
              priority
              placeholder="empty"
              style={{ imageOrientation: "from-image" }}
              draggable={false}
              onLoad={() => setIsImageLoaded(true)}
              onError={() => setIsImageLoaded(true)}
            />
          </div>
        </div>

        {/* ─── MOBILE BOTTOM CHROME ─── (caption + date row) */}
        <div className="sm:hidden absolute left-0 right-0 bottom-0 z-30 pointer-events-none">
          {/* Mobile caption strip */}
          {(displayCaption || isAdmin) && !isEditingCaption && (
            <div
              data-interactive
              className="px-4 pb-2 flex items-center justify-center gap-2 pointer-events-auto"
            >
              {displayCaption && (
                <p className="text-white/90 text-sm text-center italic font-light leading-snug">
                  {displayCaption}
                </p>
              )}
              {isAdmin && (
                <button
                  data-interactive
                  onClick={(e) => {
                    e.stopPropagation();
                    setCaptionDraft(displayCaption ?? "");
                    setIsEditingCaption(true);
                    setCaptionError(null);
                  }}
                  className="text-white/40 hover:text-white/80 transition-colors p-1.5 -m-1.5 flex items-center gap-1"
                  aria-label={displayCaption ? "Edit caption" : "Add caption"}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {!displayCaption && (
                    <span className="text-[11px] tracking-wide">Add caption</span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Date + Hijri + counter + (i) */}
          <div
            data-interactive
            className="bg-gradient-to-t from-black/80 to-transparent pt-2 pb-3 px-4 flex flex-col items-center gap-1 text-white/50 text-xs tracking-wide pointer-events-auto"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center">
              <span className="tabular-nums">{formattedTaken}</span>
              {hijriDate && (
                <>
                  <span className="text-white/20">·</span>
                  <span dir="rtl" lang="ar" className="font-medium">
                    {hijriDate}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px]">
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

        {/* Mobile metadata popup (info button) */}
        {showMeta && (
          <div
            data-interactive
            className="sm:hidden absolute bottom-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none"
          >
            <div className="bg-black/85 backdrop-blur-md rounded-xl px-5 py-4 max-w-md w-full border border-white/10 pointer-events-auto">
              <div className="flex flex-col items-center gap-3">
                {hasExif && (
                  <ExifGrid
                    camera={camera}
                    lens={lens}
                    focalLength={focalLength}
                    aperture={aperture}
                    shutter={shutter}
                    iso={iso}
                  />
                )}
                {(dimensions || fileSize || formatLabel || colorProfile) && (
                  <div className="flex flex-wrap items-center justify-center gap-x-3 text-white/40 text-[10px] tracking-wider">
                    {dimensions && <span>{dimensions}</span>}
                    {formatLabel && <span>{formatLabel}</span>}
                    {fileSize && <span>{fileSize}</span>}
                    {colorProfile && <span>{colorProfile}</span>}
                  </div>
                )}
                {locationLabel && mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-white/70 text-[11px] hover:text-white transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{locationLabel}</span>
                    {coordsLabel && (
                      <span className="text-white/30 tabular-nums">· {coordsLabel}</span>
                    )}
                  </a>
                )}
                {!locationLabel && coordsLabel && mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-white/60 text-[11px] hover:text-white transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{coordsLabel}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Caption editor overlay (mobile + desktop fallback) */}
        {isAdmin && isEditingCaption && (
          <div
            data-interactive
            className="sm:hidden absolute left-0 right-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            <CaptionEditor
              value={captionDraft}
              onChange={setCaptionDraft}
              onCancel={() => setIsEditingCaption(false)}
              onSave={saveCaption}
              isSaving={isSavingCaption}
              error={captionError}
              className="pointer-events-auto"
            />
          </div>
        )}
      </div>

      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside
        data-interactive
        className="hidden sm:flex sm:flex-col w-80 lg:w-96 flex-shrink-0 border-l border-white/10 bg-[#0a0a0a] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: counter + close */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex flex-col">
            <span className="text-white/40 text-[10px] uppercase tracking-[0.2em]">
              Photo
            </span>
            <span className="text-white/80 text-sm font-medium tabular-nums">
              {currentIndex + 1} / {total}
            </span>
          </div>
          <button
            data-interactive
            onClick={exitViewer}
            className="text-white/50 hover:text-white p-1.5 -m-1.5 transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 flex flex-col">
          {/* Caption */}
          <SidebarSection label="Caption">
            {isEditingCaption ? (
              <CaptionEditor
                value={captionDraft}
                onChange={setCaptionDraft}
                onCancel={() => setIsEditingCaption(false)}
                onSave={saveCaption}
                isSaving={isSavingCaption}
                error={captionError}
              />
            ) : displayCaption ? (
              <div className="flex items-start gap-2">
                <p className="flex-1 text-white/90 text-sm font-light leading-relaxed italic">
                  {displayCaption}
                </p>
                {isAdmin && (
                  <button
                    data-interactive
                    onClick={() => {
                      setCaptionDraft(displayCaption);
                      setIsEditingCaption(true);
                      setCaptionError(null);
                    }}
                    className="flex-shrink-0 text-white/40 hover:text-white/80 transition-colors p-1 -m-1"
                    aria-label="Edit caption"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : isAdmin ? (
              <button
                data-interactive
                onClick={() => {
                  setCaptionDraft("");
                  setIsEditingCaption(true);
                  setCaptionError(null);
                }}
                className="text-white/40 hover:text-white/80 text-xs flex items-center gap-1.5 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                <span>Add a caption</span>
              </button>
            ) : (
              <p className="text-white/30 text-xs italic">No caption</p>
            )}
          </SidebarSection>

          {/* When */}
          <SidebarSection label="When">
            <div className="space-y-1.5">
              <p className="text-white/85 text-sm tabular-nums">{formattedTaken}</p>
              {hijriDate && (
                <p
                  dir="rtl"
                  lang="ar"
                  className="text-white/60 text-sm font-medium"
                >
                  {hijriDate}
                </p>
              )}
              {taken.source === "exif" && (
                <p className="text-white/30 text-[10px] uppercase tracking-widest">
                  from EXIF
                </p>
              )}
            </div>
          </SidebarSection>

          {/* Where */}
          {(locationLabel || coordsLabel) && mapsHref && (
            <SidebarSection label="Where">
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-white/40 group-hover:text-white/80 transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {locationLabel && (
                      <p className="text-white/85 text-sm group-hover:text-white transition-colors">
                        {locationLabel}
                      </p>
                    )}
                    {coordsLabel && (
                      <p className="text-white/35 text-[11px] tabular-nums mt-0.5">
                        {coordsLabel}
                        {loc?.altitude != null && (
                          <span className="ml-2">· {Math.round(loc.altitude)}m</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            </SidebarSection>
          )}

          {/* Camera */}
          {hasExif && (
            <SidebarSection label="Camera">
              <div className="space-y-2">
                {camera && (
                  <p className="text-white/85 text-sm font-medium">{camera}</p>
                )}
                {lens && (
                  <p className="text-white/55 text-xs">{lens}</p>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-1">
                  {focalLength && (
                    <SpecRow
                      label="Focal"
                      value={`${focalLength}${
                        typeof focalLength === "string" && !focalLength.includes("mm") ? "mm" : ""
                      }`}
                    />
                  )}
                  {aperture && <SpecRow label="Aperture" value={`f/${aperture}`} />}
                  {shutter && <SpecRow label="Shutter" value={`${shutter}s`} />}
                  {iso && <SpecRow label="ISO" value={String(iso)} />}
                </div>
              </div>
            </SidebarSection>
          )}

          {/* File */}
          <SidebarSection label="File" isLast>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {dimensions && <SpecRow label="Size" value={dimensions} />}
              {formatLabel && <SpecRow label="Format" value={formatLabel} />}
              {fileSize && <SpecRow label="Bytes" value={fileSize} />}
              {colorProfile && (
                <SpecRow label="Color" value={colorProfile} />
              )}
            </div>
          </SidebarSection>
        </div>
      </aside>
    </div>
  );
}

// ---------- Sub-components ----------

function SidebarSection({
  label,
  children,
  isLast = false,
}: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <section className={`px-5 py-4 ${!isLast ? "border-b border-white/5" : ""}`}>
      <h3 className="text-white/30 text-[10px] uppercase tracking-[0.2em] mb-2">
        {label}
      </h3>
      {children}
    </section>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-white/35 text-[10px] uppercase tracking-wider">
        {label}
      </span>
      <span className="text-white/80 tabular-nums">{value}</span>
    </div>
  );
}

function ExifGrid({
  camera,
  lens,
  focalLength,
  aperture,
  shutter,
  iso,
}: {
  camera: string | null;
  lens: string | null;
  focalLength: string | null;
  aperture: string | null;
  shutter: string | null;
  iso: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-white/70 text-[11px] tracking-wide">
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
  );
}

function CaptionEditor({
  value,
  onChange,
  onCancel,
  onSave,
  isSaving,
  error,
  className = "",
}: {
  value: string;
  onChange: (s: string) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
  className?: string;
}) {
  return (
    <div
      data-interactive
      className={`w-full max-w-xl bg-black/85 backdrop-blur-md rounded-xl border border-white/15 p-3 shadow-2xl ${className}`}
    >
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSave();
          }
        }}
        maxLength={500}
        placeholder="Write a caption — ⌘+Enter to save, Esc to cancel"
        rows={3}
        className="w-full bg-transparent text-white text-sm placeholder-white/30 resize-none focus:outline-none px-1 py-1 font-light"
      />
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="text-white/30 text-[10px] tabular-nums">
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : (
            `${value.length} / 500`
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            data-interactive
            onClick={onCancel}
            disabled={isSaving}
            className="text-white/50 hover:text-white/80 text-xs px-2 py-1 transition-colors"
          >
            Cancel
          </button>
          <button
            data-interactive
            onClick={onSave}
            disabled={isSaving}
            className="bg-white text-black text-xs font-medium px-3 py-1.5 rounded-full hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving ? (
              <LogoSpinner size={12} />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>Save</span>
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

// ---------- Helpers ----------

function formatBytes(bytes?: number): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ResolvedDate = {
  date: Date;
  source: "exif" | "upload";
  hasTime: boolean;
  hasSubsec: boolean;
};

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
    return new Intl.DateTimeFormat("ar-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }
}
