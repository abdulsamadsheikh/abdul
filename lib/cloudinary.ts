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
        });

        return {
          public_id: resource.public_id,
          secure_url: resource.secure_url,
          width: resource.width,
          height: resource.height,
          format: resource.format,
          created_at: resource.created_at,
          blur_data_url: blurUrl,
        };
      })
    );

    return images;
  } catch (error) {
    console.error("Error fetching images from Cloudinary:", error);
    return [];
  }
}

export function getOptimizedUrl(publicId: string, width: number): string {
  return cloudinary.url(publicId, {
    width,
    crop: "scale",
    quality: "auto",
    format: "auto",
    fetch_format: "auto",
  });
}

export default cloudinary;
