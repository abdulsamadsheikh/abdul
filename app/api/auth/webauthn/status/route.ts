import { NextResponse } from "next/server";
import { getStoredCredential } from "@/lib/webauthn";

export async function GET() {
  const hasCredential = !!getStoredCredential();
  return NextResponse.json({ hasCredential });
}
