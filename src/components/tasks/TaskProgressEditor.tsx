"use client";

import * as React from "react";
import { apiRequest } from "@/lib/api";

type Props = {
  taskId: number | string;
  initialPercent?: number | null;
  onSaved?: () => void;
  className?: string;
};

export default function TaskProgressEditor({ taskId, initialPercent = 0, onSaved, className }: Props) {
  const [percent, setPercent] = React.useState<number>(Number(initialPercent ?? 0));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      // Send both keys for backend compatibility (percent vs percent_complete)
      await apiRequest("PATCH", `/api/tasks/${taskId}/progress`, {
        percent,
        percent_complete: percent,
      } as any);
      onSaved?.();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to update progress");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          className="border rounded px-2 py-1 text-sm w-20"
          value={percent}
          onChange={(e) => {
            const v = parseInt(e.target.value || "0", 10);
            setPercent(Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0)));
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700 transition disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Progress"}
        </button>
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

