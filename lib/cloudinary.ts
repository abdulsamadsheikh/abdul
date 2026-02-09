import { v2 as cloudinary } from "cloudinary";
import { unstable_cache } from "next/cache";
import { getPhotoId, getFullPublicId } from "./utils";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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
}

export interface Collection {
  name: string;
  count: number;
  cover_image?: string;
}

// Internal function to fetch images from Cloudinary (paginated)
async function fetchImages(folder: string): Promise<CloudinaryImage[]> {
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

  const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A";

  return allResources.map((resource: any) => {
    const optimizedUrl = cloudinary.url(resource.public_id, {
      transformation: [
        { width: 800, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
        { angle: "auto" }
      ]
    });

    const aspectRatio = resource.height / resource.width;
    const optimizedHeight = Math.round(800 * aspectRatio);

    return {
      public_id: resource.public_id,
      secure_url: optimizedUrl,
      width: 800,
      height: optimizedHeight,
      format: resource.format,
      created_at: resource.created_at,
      blur_data_url: blurDataURL,
      folder: resource.folder,
      context: resource.context || {},
      etag: resource.etag || "",
    };
  });
}

// Cached version - revalidates every hour or on-demand via tag
// Note: errors thrown here won't be cached, only successful responses
const getCachedImages = unstable_cache(
  async (folder: string): Promise<CloudinaryImage[]> => {
    return await fetchImages(folder);
  },
  ["cloudinary-images"],
  { revalidate: 3600, tags: ["cloudinary-images"] }
);

export async function getImages(folder: string = "gallery"): Promise<CloudinaryImage[]> {
  try {
    return await getCachedImages(folder);
  } catch (error) {
    console.error("Error fetching images from Cloudinary:", error);
    return [];
  }
}

// Internal function to fetch images by collection (paginated)
async function fetchImagesByCollection(collection: string): Promise<CloudinaryImage[]> {
  const allResources: any[] = [];
  let nextCursor: string | undefined;

  do {
    const search = cloudinary.search
      .expression(`folder:gallery`)
      .with_field("context")
      .sort_by("created_at", "desc")
      .max_results(500);
    if (nextCursor) search.next_cursor(nextCursor);
    const result = await search.execute();
    allResources.push(...result.resources);
    nextCursor = result.next_cursor;
  } while (nextCursor);

  const result = { resources: allResources };

  const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A";

  return result.resources
    .filter((resource: any) => resource.context?.collection === collection)
    .map((resource: any) => {
      const optimizedUrl = cloudinary.url(resource.public_id, {
        transformation: [
          { width: 800, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
          { angle: "auto" }
        ]
      });

      const aspectRatio = resource.height / resource.width;
      const optimizedHeight = Math.round(800 * aspectRatio);

      return {
        public_id: resource.public_id,
        secure_url: optimizedUrl,
        width: 800,
        height: optimizedHeight,
        format: resource.format,
        created_at: resource.created_at,
        blur_data_url: blurDataURL,
        folder: resource.folder,
        context: resource.context || {},
        etag: resource.etag || "",
      };
    });
}

// Cached version
const getCachedImagesByCollection = unstable_cache(
  async (collection: string): Promise<CloudinaryImage[]> => {
    return await fetchImagesByCollection(collection);
  },
  ["cloudinary-collection-images"],
  { revalidate: 3600, tags: ["cloudinary-images"] }
);

export async function getImagesByCollection(collection: string): Promise<CloudinaryImage[]> {
  try {
    return await getCachedImagesByCollection(collection);
  } catch (error) {
    console.error("Error fetching collection images:", error);
    return [];
  }
}

// Internal function to fetch collections (paginated)
async function fetchCollections(): Promise<Collection[]> {
  const allResources: any[] = [];
  let nextCursor: string | undefined;

  do {
    const search = cloudinary.search
      .expression(`folder:gallery`)
      .with_field("context")
      .max_results(500);
    if (nextCursor) search.next_cursor(nextCursor);
    const result = await search.execute();
    allResources.push(...result.resources);
    nextCursor = result.next_cursor;
  } while (nextCursor);

  const collectionsMap = new Map<string, { count: number; latest: string }>();
  
  allResources.forEach((resource: any) => {
    const collection = resource.context?.collection;
    if (collection) {
      const existing = collectionsMap.get(collection) || { count: 0, latest: "" };
      collectionsMap.set(collection, {
        count: existing.count + 1,
        latest: resource.created_at > existing.latest ? resource.public_id : existing.latest,
      });
    }
  });

  const collections = Array.from(collectionsMap.entries()).map(([name, data]) => {
    const coverUrl = cloudinary.url(data.latest, {
      width: 300,
      height: 200,
      crop: "fill",
      quality: "auto",
      format: "auto",
    });

    return {
      name,
      count: data.count,
      cover_image: coverUrl,
    };
  });

  return collections.sort((a, b) => b.count - a.count);
}

// Cached version
const getCachedCollections = unstable_cache(
  async (): Promise<Collection[]> => {
    return await fetchCollections();
  },
  ["cloudinary-collections"],
  { revalidate: 3600, tags: ["cloudinary-images"] }
);

export async function getCollections(): Promise<Collection[]> {
  try {
    return await getCachedCollections();
  } catch (error) {
    console.error("Error fetching collections:", error);
    return [];
  }
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

export async function addImageToCollection(publicId: string, collection: string): Promise<boolean> {
  try {
    await cloudinary.uploader.add_context(`collection=${collection}`, [publicId]);
    return true;
  } catch (error) {
    console.error("Error adding to collection:", error);
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
  });
}

// Re-export from utils for backward compatibility
export { getPhotoId, getFullPublicId } from "./utils";

export async function getImageByPhotoId(photoId: string, folder: string = "gallery"): Promise<CloudinaryImage | null> {
  try {
    const fullPublicId = getFullPublicId(photoId, folder);
    const result = await cloudinary.api.resource(fullPublicId, {
      colors: false,
      faces: false,
      image_metadata: true,
    });

    const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A";

    // Build full-screen optimized URL
    const fullScreenUrl = cloudinary.url(result.public_id, {
      transformation: [
        { width: 1920, crop: "limit" },
        { quality: "auto:best", fetch_format: "auto" },
        { angle: "auto" }
      ]
    });

    return {
      public_id: result.public_id,
      secure_url: fullScreenUrl,
      width: result.width,
      height: result.height,
      format: result.format,
      created_at: result.created_at,
      blur_data_url: blurDataURL,
      folder: result.folder,
      context: result.context || {},
      image_metadata: result.image_metadata || {},
    };
  } catch (error) {
    console.error("Error fetching image by ID:", error);
    return null;
  }
}

export async function getAllPhotoIds(folder: string = "gallery"): Promise<string[]> {
  try {
    const allResources: any[] = [];
    let nextCursor: string | undefined;

    do {
      const search = cloudinary.search
        .expression(`folder:${folder}`)
        .sort_by("created_at", "desc")
        .max_results(500);
      if (nextCursor) search.next_cursor(nextCursor);
      const result = await search.execute();
      allResources.push(...result.resources);
      nextCursor = result.next_cursor;
    } while (nextCursor);

    return allResources.map((resource: any) => getPhotoId(resource.public_id));
  } catch (error) {
    console.error("Error fetching all photo IDs:", error);
    return [];
  }
}

export async function getPhotoIdsByCollection(collection: string): Promise<string[]> {
  try {
    const allResources: any[] = [];
    let nextCursor: string | undefined;

    do {
      const search = cloudinary.search
        .expression(`folder:gallery`)
        .with_field("context")
        .sort_by("created_at", "desc")
        .max_results(500);
      if (nextCursor) search.next_cursor(nextCursor);
      const result = await search.execute();
      allResources.push(...result.resources);
      nextCursor = result.next_cursor;
    } while (nextCursor);

    return allResources
      .filter((resource: any) => resource.context?.collection === collection)
      .map((resource: any) => getPhotoId(resource.public_id));
  } catch (error) {
    console.error("Error fetching collection photo IDs:", error);
    return [];
  }
}

export async function getAdjacentPhotos(
  currentPhotoId: string,
  collection?: string
): Promise<{ prev: string | null; next: string | null; total: number; currentIndex: number }> {
  try {
    // Get photo IDs based on whether we're in a collection or not
    const allIds = collection 
      ? await getPhotoIdsByCollection(collection)
      : await getAllPhotoIds("gallery");
    
    const currentIndex = allIds.indexOf(currentPhotoId);
    
    if (currentIndex === -1) {
      return { prev: null, next: null, total: 0, currentIndex: -1 };
    }

    // Loop navigation: last->first, first->last
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

// Fetch all etags for duplicate detection
export async function getAllEtags(folder: string = "gallery"): Promise<{ etag: string; public_id: string }[]> {
  const allResources: any[] = [];
  let nextCursor: string | undefined;

  do {
    const search = cloudinary.search
      .expression(`folder:${folder}`)
      .sort_by("created_at", "desc")
      .max_results(500);
    if (nextCursor) search.next_cursor(nextCursor);
    const result = await search.execute();
    allResources.push(...result.resources);
    nextCursor = result.next_cursor;
  } while (nextCursor);

  return allResources.map((r: any) => ({ etag: r.etag, public_id: r.public_id }));
}

// Find duplicate images by etag
export async function findDuplicates(folder: string = "gallery"): Promise<{ etag: string; public_ids: string[]; keep: string }[]> {
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
