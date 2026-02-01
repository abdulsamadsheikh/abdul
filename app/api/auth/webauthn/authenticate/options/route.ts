import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { rpID, setChallenge, getStoredCredential } from "@/lib/webauthn";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export async function GET() {
  const storedCredential = getStoredCredential();

  try {
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: storedCredential
        ? [
            {
              id: storedCredential.id,
            },
          ]
        : undefined,
    });

    // Store challenge for verification
    setChallenge(options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error("Authentication options error:", error);
    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 }
    );
  }
}
