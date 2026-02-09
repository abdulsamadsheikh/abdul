import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import { createHash } from "crypto";
import { getAllEtags } from "@/lib/cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Compute MD5 hash of the raw file to compare against Cloudinary etags
    const fileHash = createHash("md5").update(buffer).digest("hex");

    // Check for duplicates against existing images
    const existingEtags = await getAllEtags("gallery");
    const duplicate = existingEtags.find((e) => e.etag === fileHash);

    if (duplicate) {
      return NextResponse.json(
        { error: "duplicate", message: "This photo already exists in the gallery", duplicateOf: duplicate.public_id },
        { status: 409 }
      );
    }

    // Upload to Cloudinary (no destructive transforms on the original)
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          folder: "gallery",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    // Invalidate the cache so new images appear immediately
    revalidateTag("cloudinary-images", "max");

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
