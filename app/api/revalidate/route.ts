import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";

export async function POST() {
  revalidateTag("cloudinary-images", "max");
  return NextResponse.json({ revalidated: true });
}
