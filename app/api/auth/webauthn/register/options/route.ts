import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { rpName, rpID, setChallenge, getStoredCredential } from "@/lib/webauthn";

export async function GET() {
  // Check if credential already exists
  const existingCredential = getStoredCredential();
  if (existingCredential) {
    return NextResponse.json(
      { error: "Passkey already registered. Use authentication instead." },
      { status: 400 }
    );
  }

  try {
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: "admin",
      userDisplayName: "Gallery Admin",
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    // Store challenge for verification
    setChallenge(options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error("Registration options error:", error);
    return NextResponse.json(
      { error: "Failed to generate registration options" },
      { status: 500 }
    );
  }
}
