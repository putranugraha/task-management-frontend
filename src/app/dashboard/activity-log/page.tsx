"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import Forbidden from "@/components/auth/Forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLogPage() {
  const { state, hasRole } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated || !state || !state.isInitialized) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!hasRole("Admin")) {
    return <Forbidden />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Activity Log</h1>
        <p className="text-sm text-slate-500">
          Pantau jejak aktivitas penting yang dilakukan oleh pengguna di sistem.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
        <p className="text-sm text-neutral-500">
          Halaman Activity Log siap dipakai. Silakan hubungkan ke endpoint backend log
          aktivitas (misalnya <code className="font-mono text-xs">/api/activity-logs</code>)
          untuk menampilkan data riil.
        </p>
      </div>
    </div>
  );
}

