"use client";

import { useState, useEffect } from "react";
import AdminDashboard from "@/components/AdminDashboard";
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Loader2, KeyRound, UserPlus } from "lucide-react";
import LogoSpinner from "@/components/LogoSpinner";

declare global {
  interface Window {
    cloudinary: any;
  }
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState("");
  const [hasPasskey, setHasPasskey] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<string | null>(null);
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Session check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPasskeyStatus = async () => {
    try {
      const res = await fetch("/api/auth/webauthn/status");
      const data = await res.json();
      setHasPasskey(data.hasCredential);
    } catch (error) {
      console.error("Passkey status check failed:", error);
    }
  };

  const checkWebAuthnSupport = () => {
    const supported = browserSupportsWebAuthn();
    setWebAuthnSupported(supported);
    if (!supported) {
      const isSecure = window.location.protocol === "https:" || window.location.hostname === "localhost";
      if (!isSecure) {
        setError("WebAuthn requires HTTPS. Please access this page via HTTPS.");
      } else {
        setError("WebAuthn is not supported on this device/browser.");
      }
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setIsAuthenticating(true);

    try {
      // Get authentication options from server
      const optionsRes = await fetch("/api/auth/webauthn/authenticate/options");
      if (!optionsRes.ok) {
        throw new Error("Failed to get authentication options");
      }
      const options = await optionsRes.json();

      // Start WebAuthn authentication (triggers iCloud Passkey prompt)
      const authResponse = await startAuthentication({ optionsJSON: options });

      // Verify with server
      const verifyRes = await fetch("/api/auth/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      });

      if (verifyRes.ok) {
        setIsAuthenticated(true);
      } else {
        const data = await verifyRes.json();
        setError(data.error || "Authentication failed");
      }
    } catch (error: any) {
      console.error("Passkey authentication error:", error);
      if (error.name === "NotAllowedError") {
        setError("Authentication cancelled");
      } else {
        setError(error.message || "Authentication failed");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setError("");
    setIsAuthenticating(true);

    try {
      // Get registration options from server
      const optionsRes = await fetch("/api/auth/webauthn/register/options");
      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || "Failed to get registration options");
      }
      const options = await optionsRes.json();

      // Start WebAuthn registration
      const regResponse = await startRegistration({ optionsJSON: options });

      // Verify with server
      const verifyRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regResponse),
      });

      const data = await verifyRes.json();

      if (verifyRes.ok && data.verified) {
        setRegistrationResult(data.credential);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (error: any) {
      console.error("Passkey registration error:", error);
      setError(error.message || "Registration failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    document.body.appendChild(script);

    checkSession();
    checkPasskeyStatus();
    checkWebAuthnSupport();

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <LogoSpinner size={48} />
      </main>
    );
  }

  if (!isAuthenticated) {
    // Show registration result if just registered
    if (registrationResult) {
      return (
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4">
            <h1 className="text-sm font-light tracking-[0.2em] text-white/80 text-center mb-8">
              PASSKEY REGISTERED
            </h1>
            <div className="bg-green-600/20 border border-green-600/40 rounded-lg p-4">
              <p className="text-green-400 text-sm mb-2">✓ Passkey created successfully!</p>
              <p className="text-white/60 text-xs mb-4">
                Add this to your environment variables as <code className="text-white/80">WEBAUTHN_CREDENTIAL</code>:
              </p>
              <div className="bg-black/40 rounded p-3 overflow-x-auto">
                <code className="text-xs text-white/80 break-all">{registrationResult}</code>
              </div>
            </div>
            <button
              onClick={() => {
                setRegistrationResult(null);
                setShowRegistration(false);
                checkPasskeyStatus();
              }}
              className="w-full bg-white/10 text-white py-3 text-sm font-medium rounded hover:bg-white/20 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </main>
      );
    }

    // Show registration form
    if (showRegistration) {
      return (
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-xs space-y-4">
            <h1 className="text-sm font-light tracking-[0.2em] text-white/80 text-center mb-8">
              REGISTER PASSKEY
            </h1>
            <p className="text-white/60 text-xs text-center mb-4">
              Create a new passkey for this device. You'll need to add the credential to your environment variables.
            </p>
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <button
              onClick={handleRegisterPasskey}
              disabled={isAuthenticating || !webAuthnSupported}
              className="w-full bg-white text-black py-3 text-sm font-medium rounded hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Passkey...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Passkey</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowRegistration(false)}
              className="w-full bg-white/10 text-white py-3 text-sm font-medium rounded hover:bg-white/20 transition-colors"
            >
              Back
            </button>
          </div>
        </main>
      );
    }

    // Main login form
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-4">
          <h1 className="text-sm font-light tracking-[0.2em] text-white/80 text-center mb-8">
            ADMIN
          </h1>
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          
          {!webAuthnSupported && (
            <div className="bg-yellow-600/20 border border-yellow-600/40 rounded-lg p-4 mb-4">
              <p className="text-yellow-400 text-xs text-center">
                ⚠️ WebAuthn requires HTTPS or localhost.
              </p>
              <p className="text-white/50 text-xs text-center mt-1">
                Access via <code className="text-white/70">https://</code> or <code className="text-white/70">localhost:3000</code>
              </p>
            </div>
          )}
          
          {hasPasskey ? (
            <button
              onClick={handlePasskeyLogin}
              disabled={isAuthenticating || !webAuthnSupported}
              className="w-full bg-white text-black py-4 text-sm font-medium rounded hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Sign in with Passkey</span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-white/60 text-xs text-center">
                No passkey configured. Register one to get started.
              </p>
              <button
                onClick={() => setShowRegistration(true)}
                disabled={!webAuthnSupported}
                className="w-full bg-white text-black py-3 text-sm font-medium rounded hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register Passkey</span>
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
