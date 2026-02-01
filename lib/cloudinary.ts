import { v2 as cloudinary } from "cloudinary";
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
}

export interface Collection {
  name: string;
  count: number;
  cover_image?: string;
}

export async function getImages(folder: string = "gallery"): Promise<CloudinaryImage[]> {
  try {
    const result = await cloudinary.search
      .expression(`folder:${folder}`)
      .sort_by("created_at", "desc")
      .max_results(50) // Reduced from 100
      .with_field("context") // Get context in single call
      .execute();

    // Generate optimized URLs with Cloudinary transformations
    const images: CloudinaryImage[] = result.resources.map((resource: any) => {
      // Generate a simple base64 blur placeholder
      const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A";

      // Build optimized URL with transformations: f_auto, q_auto, w_800, a_auto (EXIF fix)
      const optimizedUrl = cloudinary.url(resource.public_id, {
        transformation: [
          { width: 800, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
          { angle: "auto" }
        ]
      });

      // Calculate height based on aspect ratio for 800px width
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
      };
    });

    return images;
  } catch (error) {
    console.error("Error fetching images from Cloudinary:", error);
    return [];
  }
}

export async function getImagesByCollection(collection: string): Promise<CloudinaryImage[]> {
  try {
    // Use a simpler approach - get all images and filter
    const result = await cloudinary.search
      .expression(`folder:gallery`)
      .with_field("context")
      .sort_by("created_at", "desc")
      .max_results(100)
      .execute();

    const filteredImages = result.resources
      .filter((resource: any) => resource.context?.collection === collection)
      .map((resource: any) => {
        const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A";

        // Build optimized URL with transformations
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
        };
      });

    return filteredImages;
  } catch (error) {
    console.error("Error fetching collection images:", error);
    return [];
  }
}

export async function getCollections(): Promise<Collection[]> {
  try {
    // Get all images first, then filter for collections
    const result = await cloudinary.search
      .expression(`folder:gallery`)
      .with_field("context")
      .max_results(500)
      .execute();

    // Group by collection
    const collectionsMap = new Map<string, { count: number; latest: string }>();
    
    result.resources.forEach((resource: any) => {
      const collection = resource.context?.collection;
      if (collection) {
        const existing = collectionsMap.get(collection) || { count: 0, latest: "" };
        collectionsMap.set(collection, {
          count: existing.count + 1,
          latest: resource.created_at > existing.latest ? resource.public_id : existing.latest,
        });
      }
    });

    // Convert to array and get cover images
    const collections = await Promise.all(
      Array.from(collectionsMap.entries()).map(async ([name, data]) => {
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
      })
    );

    return collections.sort((a, b) => b.count - a.count);
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
    };
  } catch (error) {
    console.error("Error fetching image by ID:", error);
    return null;
  }
}

export async function getAllPhotoIds(folder: string = "gallery"): Promise<string[]> {
  try {
    const result = await cloudinary.search
      .expression(`folder:${folder}`)
      .sort_by("created_at", "desc")
      .max_results(500)
      .execute();

    return result.resources.map((resource: any) => getPhotoId(resource.public_id));
  } catch (error) {
    console.error("Error fetching all photo IDs:", error);
    return [];
  }
}

export async function getPhotoIdsByCollection(collection: string): Promise<string[]> {
  try {
    const result = await cloudinary.search
      .expression(`folder:gallery`)
      .with_field("context")
      .sort_by("created_at", "desc")
      .max_results(500)
      .execute();

    return result.resources
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

export default cloudinary;
