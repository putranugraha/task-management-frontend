"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { ProjectBaseline } from "@/types/project-baseline";

export type UseBaselinesResult = {
  baselines: ProjectBaseline[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * useBaselines(projectId)
 * - Fetches project baselines with endpoint fallbacks to support different backends.
 * - Keeps a stable sort: taken_at desc, then id desc.
 */
export function useBaselines(projectId?: number | string | null): UseBaselinesResult {
  const pid = useMemo(() => (projectId != null ? String(projectId) : null), [projectId]);
  const [baselines, setBaselines] = useState<ProjectBaseline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const fetcher = useCallback(async () => {
    const requestId = ++requestSeq.current;
    if (!pid) {
      setBaselines([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const endpoints = [
        `/api/projects/${encodeURIComponent(pid)}/baselines`,
        `/api/project-baselines?project_id=${encodeURIComponent(pid)}`,
      ];
      let list: ProjectBaseline[] = [];
      let foundNonEmpty = false;
      let lastErr: any = null;
      for (const ep of endpoints) {
        try {
          const res = await apiRequest<ProjectBaseline[] | { data: ProjectBaseline[] }>("GET", ep);
          const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
          if (Array.isArray(arr) && arr.length > 0) {
            list = arr;
            foundNonEmpty = true;
            break;
          }
          // If empty, continue to try next endpoint
          if (!foundNonEmpty) {
            list = arr;
            continue;
          }
        } catch (e: any) {
          lastErr = e;
          if (e?.response?.status === 404) continue;
          throw e;
        }
      }
      list = list.filter((baseline: any) => String(baseline?.project_id ?? "") === pid);
      if (requestId !== requestSeq.current) return;

      // Sort: taken_at desc, then id desc
      list.sort((a: any, b: any) => {
        const ta = a?.taken_at ? Date.parse(a.taken_at) : 0;
        const tb = b?.taken_at ? Date.parse(b.taken_at) : 0;
        if (tb !== ta) return tb - ta;
        return (Number(b?.id) || 0) - (Number(a?.id) || 0);
      });
      setBaselines(list);
    } catch (e: any) {
      if (requestId !== requestSeq.current) return;
      setError(e?.message ?? "Failed to load baselines");
    } finally {
      if (requestId !== requestSeq.current) return;
      setIsLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    requestSeq.current += 1;
    setBaselines([]);
    setError(null);
    fetcher();
  }, [fetcher]);

  return { baselines, isLoading, error, refetch: fetcher };
}
