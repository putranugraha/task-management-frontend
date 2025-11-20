"use client";

import { useAuth } from "@/contexts/auth-context";

export function usePermissionGuard(required: string[]) {
  const { state, can } = useAuth();

  const loading = !state.isInitialized || state.isLoading;

  const allowed =
    !loading &&
    (required.length === 0 || required.some((permission) => can(permission)));

  return { loading, allowed };
}

