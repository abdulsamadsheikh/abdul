import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { rpID, origin, getChallenge, clearChallenge } from "@/lib/webauthn";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const challenge = getChallenge();

    if (!challenge) {
      return NextResponse.json(
        { error: "No registration challenge found" },
        { status: 400 }
      );
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    clearChallenge();

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      
      // Format credential for environment variable storage
      const credentialID = typeof credential.id === 'string' 
        ? credential.id 
        : isoBase64URL.fromBuffer(credential.id);
      const publicKey = typeof credential.publicKey === 'string'
        ? credential.publicKey
        : isoBase64URL.fromBuffer(credential.publicKey);
      const credentialString = `${credentialID}:${publicKey}`;

      return NextResponse.json({
        verified: true,
        credential: credentialString,
        message: "Add this to your environment as WEBAUTHN_CREDENTIAL",
      });
    }

    return NextResponse.json(
      { error: "Registration verification failed" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Registration verification error:", error);
    clearChallenge();
    return NextResponse.json(
      { error: "Registration verification failed" },
      { status: 500 }
    );
  }
}
