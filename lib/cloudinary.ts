import { v2 as cloudinary } from "cloudinary";

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
      .max_results(100)
      .execute();

    const images: CloudinaryImage[] = await Promise.all(
      result.resources.map(async (resource: any) => {
        const blurUrl = cloudinary.url(resource.public_id, {
          width: 10,
          quality: 30,
          effect: "blur:1000",
          format: "webp",
          angle: "auto_right",
        });

        return {
          public_id: resource.public_id,
          secure_url: resource.secure_url,
          width: resource.width,
          height: resource.height,
          format: resource.format,
          created_at: resource.created_at,
          blur_data_url: blurUrl,
          folder: resource.folder,
          context: resource.context || {},
        };
      })
    );

    return images;
  } catch (error) {
    console.error("Error fetching images from Cloudinary:", error);
    return [];
  }
}

export async function getImagesByCollection(collection: string): Promise<CloudinaryImage[]> {
  try {
    const result = await cloudinary.search
      .expression(`folder:gallery AND context.collection=${collection}`)
      .sort_by("created_at", "desc")
      .max_results(100)
      .execute();

    return result.resources.map((resource: any) => ({
      public_id: resource.public_id,
      secure_url: resource.secure_url,
      width: resource.width,
      height: resource.height,
      format: resource.format,
      created_at: resource.created_at,
      folder: resource.folder,
      context: resource.context || {},
    }));
  } catch (error) {
    console.error("Error fetching collection images:", error);
    return [];
  }
}

export async function getCollections(): Promise<Collection[]> {
  try {
    // Get all images with collection context
    const result = await cloudinary.search
      .expression(`folder:gallery AND context.collection=*`)
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

export default cloudinary;
