"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { autoLoginIfEnabled } from "@/lib/auth";

type LoginResponse = {
  token?: string;
  access_token?: string;
  token_type?: string;
  user?: unknown;
  message?: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const doAuto = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const ok = await autoLoginIfEnabled();
      if (ok) {
        setInfo("Auto-login berhasil. Mengarahkan ke dashboard...");
        window.location.href = "/dashboard";
      } else {
        setInfo("Auto-login tidak aktif atau gagal. Coba form di bawah.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Auto-login gagal");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      // Explicitly prefetch CSRF cookie in Sanctum mode to avoid 419
      try {
        await apiRequest<unknown>("GET", "/sanctum/csrf-cookie");
      } catch {}
      const res = await apiRequest<LoginResponse>("POST", "/api/login", { email, password });
      const token = res.access_token || res.token;
      const type = res.token_type || "Bearer";
      if (token) {
        localStorage.setItem("access_token", token);
        localStorage.setItem("token_type", type);
        // Set presence cookie for middleware guard
        document.cookie = "app_has_token=1; Max-Age=2592000; path=/"; // 30 days
      }
      if (res.user) {
        localStorage.setItem("user", JSON.stringify(res.user));
      }
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e?.message ?? "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 420, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Login</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Halaman login untuk token-based atau Sanctum. Anda juga bisa mencoba auto-login.
      </p>

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <button onClick={doAuto} disabled={loading}>
          {loading ? "Memeriksa..." : "Coba Auto-Login"}
        </button>
        {info && <p style={{ color: "#444" }}>{info}</p>}
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
      </section>

      <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
            style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            required
            style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Masuk..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
