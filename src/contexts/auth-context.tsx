"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest } from "@/lib/api";
import { shouldUseSanctum } from "@/lib/config";
import {
  AuthContextValue,
  AuthState,
  AuthUser,
  DashboardType,
  LoginResponse,
  PrimaryRole,
  initialAuthState,
} from "@/types/auth";

type ProfileResponse = {
  user?: AuthUser;
  roles?: string[];
  permissions?: string[];
  primary_role?: PrimaryRole;
  dashboard_type?: DashboardType;
  home_path?: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialAuthState);

  const syncFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;

    const token = window.localStorage.getItem("access_token");
    const rawUser = window.localStorage.getItem("user");
    const rawMeta = window.localStorage.getItem("auth_meta");

    let user: AuthUser | null = null;
    if (rawUser) {
      try {
        user = JSON.parse(rawUser) as AuthUser;
      } catch {
        user = null;
      }
    }

    let meta:
      | {
          roles?: string[];
          permissions?: string[];
          primary_role?: PrimaryRole | null;
          dashboard_type?: DashboardType | null;
          home_path?: string | null;
        }
      | null = null;
    if (rawMeta) {
      try {
        meta = JSON.parse(rawMeta);
      } catch {
        meta = null;
      }
    }

    setState((prev) => ({
      ...prev,
      token: token || null,
      user,
      roles: meta?.roles ?? prev.roles,
      permissions: meta?.permissions ?? prev.permissions,
      primary_role:
        typeof meta?.primary_role === "undefined"
          ? prev.primary_role
          : meta.primary_role ?? null,
      dashboard_type:
        typeof meta?.dashboard_type === "undefined"
          ? prev.dashboard_type
          : meta.dashboard_type ?? null,
      home_path:
        typeof meta?.home_path === "undefined"
          ? prev.home_path
          : meta.home_path ?? null,
    }));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (typeof window === "undefined") return;

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const data = await apiRequest<ProfileResponse>("GET", "/api/profile");

      if (typeof window !== "undefined") {
        if (data.user) {
          window.localStorage.setItem("user", JSON.stringify(data.user));
        }

        const metaToStore = {
          roles: data.roles ?? [],
          permissions: data.permissions ?? [],
          primary_role:
            typeof data.primary_role === "undefined"
              ? initialAuthState.primary_role
              : data.primary_role,
          dashboard_type:
            typeof data.dashboard_type === "undefined"
              ? initialAuthState.dashboard_type
              : data.dashboard_type,
          home_path:
            typeof data.home_path === "undefined" ? null : data.home_path,
        };
        window.localStorage.setItem("auth_meta", JSON.stringify(metaToStore));
      }

      setState((prev) => ({
        ...prev,
        user: data.user ?? prev.user,
        roles: data.roles ?? prev.roles,
        permissions: data.permissions ?? prev.permissions,
        primary_role:
          typeof data.primary_role === "undefined"
            ? prev.primary_role
            : data.primary_role,
        dashboard_type:
          typeof data.dashboard_type === "undefined"
            ? prev.dashboard_type
            : data.dashboard_type,
        home_path:
          typeof data.home_path === "undefined"
            ? prev.home_path
            : data.home_path,
        isLoading: false,
        isInitialized: true,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isInitialized: true,
      }));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const initialize = async () => {
      setState((prev) => ({ ...prev, isLoading: true }));

      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("access_token")
          : null;

      syncFromStorage();

      // Jika tidak ada token sama sekali, langsung anggap belum login.
      if (!token) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isInitialized: true,
            isLoading: false,
          }));
        }
        return;
      }

      // Jika ada token, validasi dulu ke backend lewat /api/profile.
      // refreshProfile akan mengatur isInitialized dan isLoading sendiri,
      // termasuk saat token sudah tidak valid.
      if (!cancelled) {
        await refreshProfile();
      }
    };

    initialize().catch(() => {
      if (!cancelled) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isInitialized: true,
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshProfile, syncFromStorage]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResponse | void> => {
      if (typeof window === "undefined") return;

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        if (shouldUseSanctum()) {
          try {
            await apiRequest<unknown>("GET", "/sanctum/csrf-cookie");
          } catch {
            // ignore, some setups may not require this
          }
        }

        const res = await apiRequest<LoginResponse>("POST", "/api/login", {
          email,
          password,
        });

        const token = res.token || res.access_token || null;
        const tokenType = res.token_type || "Bearer";

        if (token) {
          window.localStorage.setItem("access_token", token);
          window.localStorage.setItem("token_type", tokenType);
          window.document.cookie =
            "app_has_token=1; Max-Age=2592000; path=/"; // 30 days
        }

        if (res.user) {
          window.localStorage.setItem("user", JSON.stringify(res.user));
        }

        const metaToStore = {
          roles: res.roles ?? [],
          permissions: res.permissions ?? [],
          primary_role:
            typeof res.primary_role === "undefined"
              ? initialAuthState.primary_role
              : res.primary_role,
          dashboard_type:
            typeof res.dashboard_type === "undefined"
              ? initialAuthState.dashboard_type
              : res.dashboard_type,
          home_path:
            typeof res.home_path === "undefined" ? null : res.home_path,
        };
        window.localStorage.setItem("auth_meta", JSON.stringify(metaToStore));

        setState((prev) => ({
          ...prev,
          user: res.user ?? prev.user,
          roles: res.roles ?? prev.roles,
          permissions: res.permissions ?? prev.permissions,
          primary_role:
            typeof res.primary_role === "undefined"
              ? prev.primary_role
              : res.primary_role,
          dashboard_type:
            typeof res.dashboard_type === "undefined"
              ? prev.dashboard_type
              : res.dashboard_type,
          home_path:
            typeof res.home_path === "undefined"
              ? prev.home_path
              : res.home_path,
          token,
          isLoading: false,
          isInitialized: true,
        }));

        return res;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
        throw error;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    if (typeof window === "undefined") return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await apiRequest<unknown>("POST", "/api/logout");
    } catch {
      // ignore logout errors
    } finally {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("access_token");
        window.localStorage.removeItem("token_type");
        window.localStorage.removeItem("user");
        window.document.cookie =
          "app_has_token=; Max-Age=0; path=/"; // clear presence cookie
      }

      setState((prev) => ({
        ...initialAuthState,
        isInitialized: true,
        isLoading: false,
      }));
    }
  }, []);

  const hasRole = useCallback(
    (role: Exclude<PrimaryRole, null>) => {
      if (!role) return false;
      if (!state) return false;
      if (state.primary_role === role) return true;
      return state.roles.includes(role);
    },
    [state]
  );

  const can = useCallback(
    (permission: string) => {
      if (!permission) return false;
      if (!state) return false;

      if (state.roles.includes("Admin") || state.primary_role === "Admin") {
        return true;
      }

      return state.permissions.includes(permission);
    },
    [state]
  );

  const value: AuthContextValue = useMemo(
    () => ({
      state,
      login,
      logout,
      refreshProfile,
      hasRole,
      can,
    }),
    [state, login, logout, refreshProfile, hasRole, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
