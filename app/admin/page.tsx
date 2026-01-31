"use client";

import { useState, useEffect } from "react";

declare global {
  interface Window {
    cloudinary: any;
  }
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setIsAuthenticated(true);
      localStorage.setItem("admin_auth", "true");
    } else {
      setError("Invalid password");
    }
  };

  const openUploadWidget = () => {
    if (typeof window !== "undefined" && window.cloudinary) {
      const widget = window.cloudinary.createUploadWidget(
        {
          cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
          folder: "gallery",
          sources: ["local", "camera"],
          multiple: true,
          maxFiles: 50,
          resourceType: "image",
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
          maxFileSize: 20000000,
          styles: {
            palette: {
              window: "#050505",
              windowBorder: "#333",
              tabIcon: "#fff",
              menuIcons: "#fff",
              textDark: "#000",
              textLight: "#fff",
              link: "#fff",
              action: "#339933",
              inactiveTabIcon: "#666",
              error: "#ff4444",
              inProgress: "#339933",
              complete: "#339933",
              sourceBg: "#111",
            },
          },
        },
        (error: any, result: any) => {
          if (!error && result && result.event === "success") {
            setUploadedCount((prev) => prev + 1);
          }
        }
      );
      widget.open();
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    document.body.appendChild(script);

    if (localStorage.getItem("admin_auth") === "true") {
      setIsAuthenticated(true);
    }

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
          <h1 className="text-sm font-light tracking-[0.2em] text-white/80 text-center mb-8">
            ADMIN
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            className="w-full bg-white text-black py-3 text-sm font-medium rounded hover:bg-white/90 transition-colors"
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-sm font-light tracking-[0.2em] text-white/80 mb-8">
        UPLOAD
      </h1>

      <button
        onClick={openUploadWidget}
        className="bg-white text-black px-8 py-4 text-sm font-medium rounded hover:bg-white/90 transition-colors mb-6"
      >
        Select Photos
      </button>

      {uploadedCount > 0 && (
        <p className="text-white/60 text-sm">
          {uploadedCount} photo{uploadedCount > 1 ? "s" : ""} uploaded
        </p>
      )}

      <div className="mt-12 space-y-4 text-center">
        <a
          href="/"
          className="block text-white/40 text-xs hover:text-white/60 transition-colors"
        >
          View Gallery →
        </a>
        <button
          onClick={() => {
            localStorage.removeItem("admin_auth");
            setIsAuthenticated(false);
          }}
          className="text-white/40 text-xs hover:text-white/60 transition-colors"
        >
          Logout
        </button>
      </div>
    </main>
  );
}
