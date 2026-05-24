import { v2 as cloudinary } from "cloudinary";
import { unstable_cache } from "next/cache";
import { getPhotoId, getFullPublicId } from "./utils";
import { parseGpsFromExif } from "./exif";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface GeoLocation {
  lat: number;
  lng: number;
  altitude?: number;
}

export interface CloudinaryImage {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  created_at: string;
  blur_data_url?: string;
  folder?: string;
  context?: Record<string, string>;
  etag?: string;
  image_metadata?: Record<string, string>;
  bytes?: number;
  original_width?: number;
  original_height?: number;
  caption?: string;
  location?: GeoLocation;
}

export interface Collection {
  name: string;
  count: number;
  cover_image?: string;
}

// Generic 1x1 blur placeholder. Cloudinary returns no per-image blur via the search API,
// so this is a deliberate compromise to avoid an extra round-trip per image.
const BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A";

function toCloudinaryImage(resource: any): CloudinaryImage {
  const context = resource.context || {};
  return {
    public_id: resource.public_id,
    secure_url: cloudinary.url(resource.public_id, { secure: true }),
    width: resource.width,
    height: resource.height,
    format: resource.format,
    created_at: resource.created_at,
    blur_data_url: BLUR_DATA_URL,
    folder: resource.folder,
    context,
    etag: resource.etag || "",
    caption: typeof context.caption === "string" ? context.caption : undefined,
  };
}

// SINGLE source of truth: fetch every image once, derive everything else from it.
async function fetchAllImages(folder: string): Promise<CloudinaryImage[]> {
  const allResources: any[] = [];
  let nextCursor: string | undefined;

  do {
    const search = cloudinary.search
      .expression(`folder:${folder}`)
      .sort_by("created_at", "desc")
      .with_field("context")
      .max_results(500);
    if (nextCursor) search.next_cursor(nextCursor);
    const result = await search.execute();
    allResources.push(...result.resources);
    nextCursor = result.next_cursor;
  } while (nextCursor);

  return allResources.map(toCloudinaryImage);
}

const getCachedAllImages = unstable_cache(
  async (folder: string): Promise<CloudinaryImage[]> => fetchAllImages(folder),
  ["cloudinary-all-images"],
  { revalidate: 3600, tags: ["cloudinary-images"] }
);

async function getAll(folder: string = "gallery"): Promise<CloudinaryImage[]> {
  try {
    return await getCachedAllImages(folder);
  } catch (error) {
    console.error("Error fetching images from Cloudinary:", error);
    return [];
  }
}

export async function getImages(folder: string = "gallery"): Promise<CloudinaryImage[]> {
  return getAll(folder);
}

export async function getImagesByCollection(collection: string): Promise<CloudinaryImage[]> {
  const all = await getAll("gallery");
  return all.filter((img) => img.context?.collection === collection);
}

export async function getCollections(): Promise<Collection[]> {
  const all = await getAll("gallery");
  const map = new Map<string, { count: number; latest: string }>();

  for (const img of all) {
    const name = img.context?.collection;
    if (!name) continue;
    const existing = map.get(name) || { count: 0, latest: "" };
    map.set(name, {
      count: existing.count + 1,
      latest: img.created_at > existing.latest ? img.public_id : existing.latest,
    });
  }

  const collections = Array.from(map.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    cover_image: cloudinary.url(data.latest, {
      width: 600,
      height: 400,
      crop: "fill",
      quality: "auto",
      fetch_format: "auto",
      secure: true,
    }),
  }));

  return collections.sort((a, b) => b.count - a.count);
}

export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
}

export async function addImageToCollection(
  publicId: string,
  collection: string
): Promise<boolean> {
  try {
    await cloudinary.uploader.add_context(`collection=${collection}`, [publicId]);
    return true;
  } catch (error) {
    console.error("Error adding to collection:", error);
    return false;
  }
}

export async function setImageCaption(
  publicId: string,
  caption: string
): Promise<boolean> {
  try {
    if (caption.trim() === "") {
      // Clear caption — remove the field from context while preserving others
      const existing = await cloudinary.api.resource(publicId, { context: true });
      const ctx = existing.context?.custom || {};
      delete ctx.caption;
      // Re-set whatever's left (Cloudinary's API has no "remove single key")
      const pairs = Object.entries(ctx)
        .map(([k, v]) => `${k}=${String(v).replace(/[|=]/g, "")}`)
        .join("|");
      await cloudinary.uploader.remove_all_context([publicId]);
      if (pairs) await cloudinary.uploader.add_context(pairs, [publicId]);
    } else {
      const sanitized = caption.replace(/[|=]/g, "");
      await cloudinary.uploader.add_context(`caption=${sanitized}`, [publicId]);
    }
    return true;
  } catch (error) {
    console.error("Error setting caption:", error);
    return false;
  }
}

export async function removeFromCollection(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.remove_all_context([publicId]);
    return true;
  } catch (error) {
    console.error("Error removing from collection:", error);
    return false;
  }
}

export function getOptimizedUrl(publicId: string, width: number): string {
  return cloudinary.url(publicId, {
    width,
    crop: "scale",
    quality: "auto",
    format: "auto",
    fetch_format: "auto",
    angle: "auto_right",
    secure: true,
  });
}

// Re-export from utils for backward compatibility
export { getPhotoId, getFullPublicId } from "./utils";

const getCachedResource = unstable_cache(
  async (fullPublicId: string) =>
    cloudinary.api.resource(fullPublicId, {
      colors: false,
      faces: false,
      image_metadata: true,
    }),
  ["cloudinary-resource"],
  { revalidate: 86400, tags: ["cloudinary-images"] }
);

export async function getImageByPhotoId(
  photoId: string,
  folder: string = "gallery"
): Promise<CloudinaryImage | null> {
  const fullPublicId = getFullPublicId(photoId, folder);
  try {
    const result = await getCachedResource(fullPublicId);
    const context = result.context || {};
    const imageMetadata = result.image_metadata || {};
    return {
      public_id: result.public_id,
      secure_url: cloudinary.url(result.public_id, { secure: true }),
      width: result.width,
      height: result.height,
      format: result.format,
      created_at: result.created_at,
      blur_data_url: BLUR_DATA_URL,
      folder: result.folder,
      context,
      image_metadata: imageMetadata,
      bytes: result.bytes,
      original_width: result.width,
      original_height: result.height,
      caption: typeof context.caption === "string" ? context.caption : undefined,
      location: parseGpsFromExif(imageMetadata),
    };
  } catch (error) {
    const is404 =
      error &&
      typeof error === "object" &&
      "error" in error &&
      (error as any).error?.http_code === 404;

    if (!is404) {
      console.error("Error fetching image by ID:", {
        photoId,
        fullPublicId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

export async function getAllPhotoIds(folder: string = "gallery"): Promise<string[]> {
  const all = await getAll(folder);
  return all.map((img) => getPhotoId(img.public_id));
}

export async function getPhotoIdsByCollection(collection: string): Promise<string[]> {
  const imgs = await getImagesByCollection(collection);
  return imgs.map((img) => getPhotoId(img.public_id));
}

export async function getAdjacentPhotos(
  currentPhotoId: string,
  collection?: string
): Promise<{ prev: string | null; next: string | null; total: number; currentIndex: number }> {
  try {
    const allIds = collection
      ? await getPhotoIdsByCollection(collection)
      : await getAllPhotoIds("gallery");

    const currentIndex = allIds.indexOf(currentPhotoId);

    if (currentIndex === -1) {
      return { prev: null, next: null, total: 0, currentIndex: -1 };
    }

    // Wrap-around navigation
    const prevIndex = currentIndex === 0 ? allIds.length - 1 : currentIndex - 1;
    const nextIndex = currentIndex === allIds.length - 1 ? 0 : currentIndex + 1;

    return {
      prev: allIds[prevIndex],
      next: allIds[nextIndex],
      total: allIds.length,
      currentIndex,
    };
  } catch (error) {
    console.error("Error fetching adjacent photos:", error);
    return { prev: null, next: null, total: 0, currentIndex: -1 };
  }
}

export async function getAllEtags(
  folder: string = "gallery"
): Promise<{ etag: string; public_id: string }[]> {
  const all = await getAll(folder);
  return all.map((img) => ({ etag: img.etag || "", public_id: img.public_id }));
}

export async function findDuplicates(
  folder: string = "gallery"
): Promise<{ etag: string; public_ids: string[]; keep: string }[]> {
  const all = await getAllEtags(folder);
  const etagMap = new Map<string, string[]>();

  for (const { etag, public_id } of all) {
    if (!etag) continue;
    const existing = etagMap.get(etag) || [];
    existing.push(public_id);
    etagMap.set(etag, existing);
  }

  const duplicates: { etag: string; public_ids: string[]; keep: string }[] = [];
  for (const [etag, public_ids] of etagMap) {
    if (public_ids.length > 1) {
      duplicates.push({ etag, public_ids, keep: public_ids[0] });
    }
  }

  return duplicates;
}

export default cloudinary;
