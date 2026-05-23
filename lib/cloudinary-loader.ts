import type { ImageLoaderProps } from "next/image";

// Custom loader: takes a Cloudinary URL and injects width + quality transforms.
// Used by next/image to generate responsive srcset.
export default function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  // Only transform Cloudinary URLs
  if (!src.includes("res.cloudinary.com")) return src;

  const params = [
    "f_auto",
    `w_${width}`,
    "c_limit",
    `q_${quality || "auto"}`,
    "a_auto",
  ];

  // Insert transforms after "/upload/" segment. If src already has transforms,
  // strip any existing w_/q_/f_/c_ that we control, then prepend ours.
  const uploadIdx = src.indexOf("/upload/");
  if (uploadIdx === -1) return src;

  const head = src.slice(0, uploadIdx + 8); // includes "/upload/"
  let tail = src.slice(uploadIdx + 8);

  // If the first segment looks like transforms (contains commas or known prefixes),
  // strip it so we don't double-stack.
  const firstSlash = tail.indexOf("/");
  if (firstSlash !== -1) {
    const seg = tail.slice(0, firstSlash);
    if (/(^|,)(f_|w_|q_|c_|a_|h_|dpr_|fl_)/.test(seg) || seg.includes(",")) {
      tail = tail.slice(firstSlash + 1);
    }
  }

  return `${head}${params.join(",")}/${tail}`;
}
