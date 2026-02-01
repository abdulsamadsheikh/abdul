import { SignJWT, jwtVerify } from "jose";

// Environment variables for WebAuthn configuration
export const rpName = "Gallery Admin";
export const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
export const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`;

// JWT secret for session tokens
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-min-32-chars-long!"
);

// Store challenge temporarily (in production, use Redis or similar)
// For single-user setup, in-memory is acceptable
let currentChallenge: string | null = null;

export function setChallenge(challenge: string) {
  currentChallenge = challenge;
}

export function getChallenge(): string | null {
  return currentChallenge;
}

export function clearChallenge() {
  currentChallenge = null;
}

// Get stored credential from environment variable
// Format: credentialID:publicKey (both base64url encoded)
export function getStoredCredential(): { id: string; publicKey: string } | null {
  const stored = process.env.WEBAUTHN_CREDENTIAL;
  if (!stored) return null;
  
  const [id, publicKey] = stored.split(":");
  if (!id || !publicKey) return null;
  
  return { id, publicKey };
}

// Create a session JWT
export async function createSessionToken(): Promise<string> {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
  
  return token;
}

// Verify a session JWT
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}
