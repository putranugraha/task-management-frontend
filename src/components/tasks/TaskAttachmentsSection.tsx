"use client";

import { useEffect, useState } from "react";
import {
  listByTask,
  uploadForTask,
  approveAttachment,
  rejectAttachment,
  type TaskAttachment,
} from "@/lib/api/task-attachments";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useAuth } from "@/contexts/auth-context";

type Props = {
  taskId: number;
};

export default function TaskAttachmentsSection({ taskId }: Props) {
  const { hasRole } = useAuth();
  const [items, setItems] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { loading: permLoading, allowed } = usePermissionGuard([
    "mengelola lampiran",
  ]);
  const canModerate =
    !permLoading && allowed && (hasRole("Admin") || hasRole("Manager"));

  async function fetchAttachments() {
    setLoading(true);
    setError(null);
    try {
      const list = await listByTask(taskId);
      setItems(list);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat lampiran");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!taskId) return;
    fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      await uploadForTask(taskId, file);
      setFile(null);
      await fetchAttachments();
    } catch (e: any) {
      alert(e?.message ?? "Gagal upload lampiran");
    } finally {
      setUploading(false);
    }
  }

  async function handleStatus(id: number, action: "approve" | "reject") {
    try {
      if (action === "approve") {
        await approveAttachment(id);
      } else {
        await rejectAttachment(id);
      }
      await fetchAttachments();
    } catch (e: any) {
      alert(e?.message ?? "Gagal mengubah status lampiran");
    }
  }

  const badgeClasses = (status: TaskAttachment["status"]) => {
    const s = String(status || "").toLowerCase();
    if (s === "approved") return "bg-green-100 text-green-700";
    if (s === "rejected") return "bg-red-100 text-red-700";
    return "bg-yellow-100 text-yellow-700";
  };

  return (
    <section className="mt-4">
      <h3 className="text-sm font-medium mb-2">Attachments</h3>
      <div className="border rounded-lg">
        {loading ? (
          <div className="p-3 text-sm text-neutral-500">Loading attachments...</div>
        ) : error ? (
          <div className="p-3 text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-neutral-500">
            Belum ada lampiran untuk task ini.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className="text-left font-medium px-3 py-2 border-b">File</th>
                <th className="text-left font-medium px-3 py-2 border-b">Status</th>
                <th className="text-left font-medium px-3 py-2 border-b">Uploaded</th>
                <th className="text-left font-medium px-3 py-2 border-b">Size</th>
                {canModerate && (
                  <th className="text-left font-medium px-3 py-2 border-b">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 border-t">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {a.filename}
                    </a>
                  </td>
                  <td className="px-3 py-2 border-t">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badgeClasses(
                        a.status
                      )}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-t">
                    {a.uploaded_at ?? a.verified_at ?? "-"}
                  </td>
                  <td className="px-3 py-2 border-t">
                    {a.size ? `${(a.size / 1024).toFixed(1)} KB` : "-"}
                  </td>
                  {canModerate && (
                    <td className="px-3 py-2 border-t space-x-2">
                      <button
                        type="button"
                        onClick={() => handleStatus(a.id, "approve")}
                        className="px-2 py-1 rounded-md border text-xs hover:bg-neutral-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatus(a.id, "reject")}
                        className="px-2 py-1 rounded-md border text-xs hover:bg-neutral-50"
                      >
                        Reject
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {allowed && !permLoading && (
        <form
          onSubmit={handleUpload}
          className="mt-3 flex flex-wrap items-center gap-2 text-sm"
        >
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <button
            type="submit"
            disabled={!file || uploading}
            className="px-3 py-1.5 rounded-md border text-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Upload Attachment"}
          </button>
        </form>
      )}
    </section>
  );
}
