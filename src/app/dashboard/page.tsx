"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { autoLoginIfEnabled } from "@/lib/auth";

type ProfileShape = {
  user?: unknown;
  roles?: string[];
  permissions?: string[];
  message?: string;
};

function maskToken(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileShape | null>(null);
  const [status, setStatus] = useState<string>("Idle");

  const masked = useMemo(() => maskToken(token), [token]);

  // Ensure token (auto-login if enabled), then fetch profile
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      setStatus("Initializing");
      try {
        // Load current token
        const existing = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        setToken(existing);

        // Attempt auto-login (only if enabled via env and no token)
        setStatus("Auto-login check");
        await autoLoginIfEnabled();

        const t = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        if (!cancelled) setToken(t);

        setStatus("Fetching profile");
        const data = await apiRequest<ProfileShape>("GET", "/api/profile");
        if (!cancelled) setProfile(data);
        setStatus("Done");
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Unknown error");
          setStatus("Error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    setStatus("Refreshing");
    try {
      const res = await apiRequest<ProfileShape>("GET", "/api/profile");
      setProfile(res);
      const t = localStorage.getItem("access_token");
      setToken(t);
      setStatus("Done");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setStatus("Error");
    } finally {
      setLoading(false);
    }
  };

  const handleClearToken = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    // Clear presence cookie used by middleware guard
    if (typeof document !== 'undefined') {
      document.cookie = 'app_has_token=; Max-Age=0; path=/';
    }
    setToken(null);
  };

  return (
    <div className="w-full">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Dashboard</h1>
          <p className="text-sm text-neutral-500 mb-4">Cek auto-login dan Authorization header.</p>

        <section className="mt-4 p-3 md:p-4 border rounded-lg">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleRefresh} disabled={loading} className="px-3 py-2 text-sm rounded-md border hover:bg-neutral-50">
              {loading ? "Loading..." : "Refresh /api/profile"}
            </button>
            <button onClick={handleClearToken} disabled={loading} className="px-3 py-2 text-sm rounded-md border hover:bg-neutral-50">
              Clear token
            </button>
            <span className="text-neutral-600 text-sm">Status: {status}</span>
          </div>

          <div className="mt-3">
            <div className="text-sm"><strong>Token in LocalStorage:</strong> {masked ?? "(none)"}</div>
            <div className="text-xs text-neutral-500">
              Note: Authorization header is automatically set from localStorage by api interceptor.
              Inspect the Network tab for GET /api/profile to see the Authorization header.
            </div>
          </div>
        </section>

        <section className="mt-4 p-3 md:p-4 border rounded-lg">
          <h3 className="text-sm font-medium mb-2">Profile Response</h3>
          {error && (
            <pre className="text-red-600 whitespace-pre-wrap text-sm">{error}</pre>
          )}
          {!error && (
            <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(profile, null, 2)}</pre>
          )}
        </section>
    </div>
  );
}
