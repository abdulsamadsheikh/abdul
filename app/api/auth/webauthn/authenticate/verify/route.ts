import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import {
  rpID,
  origin,
  getChallenge,
  clearChallenge,
  getStoredCredential,
  createSessionToken,
} from "@/lib/webauthn";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const challenge = getChallenge();
    const storedCredential = getStoredCredential();

    if (!challenge) {
      return NextResponse.json(
        { error: "No authentication challenge found" },
        { status: 400 }
      );
    }

    if (!storedCredential) {
      return NextResponse.json(
        { error: "No registered passkey found" },
        { status: 400 }
      );
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCredential.id,
        publicKey: isoBase64URL.toBuffer(storedCredential.publicKey),
        counter: 0,
      },
      requireUserVerification: false,
    });

    clearChallenge();

    if (verification.verified) {
      // Create session token
      const token = await createSessionToken();

      // Set HTTP-only cookie
      const response = NextResponse.json({ verified: true });
      response.cookies.set("admin_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return response;
    }

    return NextResponse.json(
      { error: "Authentication verification failed" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Authentication verification error:", error);
    clearChallenge();
    return NextResponse.json(
      { error: "Authentication verification failed" },
      { status: 500 }
    );
  }
}
