"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { autoLoginIfEnabled } from "@/lib/auth";
import { useAuth } from "@/contexts/auth-context";
import type { DashboardType } from "@/types/auth";

function resolveHomePath(
  nextParam: string | null,
  homePath: string | null,
  dashboardType: DashboardType | null
): string {
  if (nextParam && nextParam.startsWith("/")) {
    return nextParam;
  }

  if (homePath && homePath.startsWith("/")) {
    // Backend may send /admin/dashboard, /manager/dashboard, /member/dashboard.
    // FE saat ini memakai /dashboard tunggal, jadi normalkan ke /dashboard.
    if (
      homePath.startsWith("/admin/dashboard") ||
      homePath.startsWith("/manager/dashboard") ||
      homePath.startsWith("/member/dashboard")
    ) {
      return "/dashboard";
    }
    return homePath;
  }

  // Fallback sederhana: satu dashboard utama.
  return "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Jika sudah login dan auth sudah ter-initialize, redirect dari halaman login.
  useEffect(() => {
    if (!state.isInitialized) return;
    if (!state.token) return;

    const nextParam = searchParams?.get("next") ?? null;
    const dest = resolveHomePath(
      nextParam,
      state.home_path,
      state.dashboard_type
    );
    router.replace(dest);
  }, [
    state.isInitialized,
    state.token,
    state.home_path,
    state.dashboard_type,
    router,
    searchParams,
  ]);

  const doAuto = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const ok = await autoLoginIfEnabled();
      if (ok) {
        setInfo("Auto-login berhasil. Mengarahkan ke dashboard...");
        router.replace("/dashboard");
      } else {
        setInfo("Auto-login tidak aktif atau gagal. Coba form di bawah.");
      }
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Auto-login gagal";
      setError(message);
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
      const res = await login(email, password);

      const nextParam = searchParams?.get("next") ?? null;
      const dest = resolveHomePath(
        nextParam,
        (res && res.home_path) || null,
        (res && res.dashboard_type) || null
      );

      router.replace(dest);
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Login gagal";
      setError(message);
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
