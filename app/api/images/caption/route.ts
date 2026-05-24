import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { setImageCaption } from "@/lib/cloudinary";
import { verifySessionToken } from "@/lib/webauthn";

export const runtime = "nodejs";

async function requireAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export async function PATCH(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { publicId?: unknown; caption?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const publicId = typeof body.publicId === "string" ? body.publicId : null;
  const caption = typeof body.caption === "string" ? body.caption : null;

  if (!publicId || caption == null) {
    return NextResponse.json(
      { error: "publicId and caption required" },
      { status: 400 }
    );
  }

  // Reasonable length limit so a malformed client can't blow up Cloudinary context
  if (caption.length > 500) {
    return NextResponse.json(
      { error: "Caption too long (max 500 chars)" },
      { status: 400 }
    );
  }

  const ok = await setImageCaption(publicId, caption);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to save caption" },
      { status: 500 }
    );
  }

  revalidateTag("cloudinary-images", "max");
  return NextResponse.json({ ok: true, caption });
}
