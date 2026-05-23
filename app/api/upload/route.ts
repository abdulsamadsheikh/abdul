import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import { createHash } from "crypto";
import { getAllEtags } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const maxDuration = 60;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "empty_file", message: "File is empty" },
        { status: 400 }
      );
    }

    // 25 MB hard limit (Cloudinary free plan allows 10MB images, paid 100MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: "too_large",
          message: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_SIZE / 1024 / 1024} MB.`,
        },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // MD5 hash of raw file bytes — matches Cloudinary's etag for the source file
    const fileHash = createHash("md5").update(buffer).digest("hex");

    // Duplicate check — soft-fail if etag lookup errors so uploads aren't blocked
    let duplicate: { etag: string; public_id: string } | undefined;
    try {
      const existingEtags = await getAllEtags("gallery");
      duplicate = existingEtags.find((e) => e.etag === fileHash);
    } catch (err) {
      console.warn("Etag lookup failed, skipping dedup:", err);
    }

    if (duplicate) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: "This photo already exists in the gallery",
          duplicateOf: duplicate.public_id,
        },
        { status: 409 }
      );
    }

    // Upload original bytes — no format conversion here. Cloudinary's f_auto
    // (added by our delivery loader) transcodes HEIC/HEIF to the right format
    // per browser, so the source keeps full EXIF.
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          folder: "gallery",
          image_metadata: true,
        },
        (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(buffer);
    });

    revalidateTag("cloudinary-images", "max");

    return NextResponse.json({ success: true, public_id: result?.public_id });
  } catch (error: any) {
    console.error("Upload error:", error);
    const message =
      error?.message ||
      error?.error?.message ||
      "Upload failed";
    const status = typeof error?.http_code === "number" ? error.http_code : 500;
    return NextResponse.json(
      { error: "upload_failed", message },
      { status }
    );
  }
}
