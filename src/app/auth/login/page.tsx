"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #00674F 0%, #21A07A 40%, #E6FFF6 100%)",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          minHeight: 480,
          borderRadius: 24,
          backgroundColor: "white",
          boxShadow:
            "0 18px 45px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.02)",
          display: "grid",
          gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
          overflow: "hidden",
        }}
      >
        {/* Left panel – dekorasi hijau, tanpa sosial media */}
        <div
          style={{
            position: "relative",
            background:
              "linear-gradient(180deg, #00674F 0%, #21A07A 40%, #004234 100%)",
            color: "white",
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Bentuk cut-out ala contoh */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: -40,
              transform: "translateY(-50%)",
              width: 80,
              height: 180,
              backgroundColor: "white",
              borderRadius: 40,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.02)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 600,
                marginBottom: 4,
                letterSpacing: 0.4,
              }}
            >
              Selamat Datang
            </h2>
            <p style={{ opacity: 0.9, maxWidth: 220, fontSize: 13 }}>
              Masuk untuk mengelola dan memonitor task project Anda.
            </p>
          </div>

          <p
            style={{
              position: "relative",
              zIndex: 1,
              fontSize: 11,
              opacity: 0.85,
            }}
          >
            © {new Date().getFullYear()} Central Saga
          </p>
        </div>

        {/* Right panel – form dan logo */}
        <div
          style={{
            padding: "40px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <img
              src="/logo/Logo_Central_Saga-removebg-preview.png"
              alt="Central Saga"
              style={{
                width: 96,
                height: 96,
                objectFit: "contain",
                marginBottom: 8,
              }}
            />
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Sign in
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#6B7280",
              }}
            >
              Gunakan akun Anda untuk masuk ke dashboard.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 13,
                  color: "#374151",
                  fontWeight: 500,
                }}
              >
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid #E5E7EB",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 13,
                  color: "#374151",
                  fontWeight: 500,
                }}
              >
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid #E5E7EB",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                padding: "10px 16px",
                borderRadius: 999,
                border: "none",
                background:
                  "linear-gradient(90deg, #00674F 0%, #21A07A 100%)",
                color: "white",
                fontWeight: 600,
                fontSize: 14,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "Masuk..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }} />}>
      <LoginPageContent />
    </Suspense>
  );
}
