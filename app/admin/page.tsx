"use client";

import { useState, useEffect } from "react";
import AdminDashboard from "@/components/AdminDashboard";

declare global {
  interface Window {
    cloudinary: any;
  }
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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

  const handleLogout = () => {
    localStorage.removeItem("admin_auth");
    setIsAuthenticated(false);
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

  return <AdminDashboard onLogout={handleLogout} />;
}
