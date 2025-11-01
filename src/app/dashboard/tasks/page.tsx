"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Task } from "@/types/task";
import DataTable from "../users/data-table";
import { useTaskColumns, type TaskRow } from "./columns";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

export default function TasksPage() {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<Task>>("GET", "/api/tasks");
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const mapped: TaskRow[] = list.map((t: any) => ({
        id: t.id,
        title: t.title,
        project: t.project ? { id: t.project.id, name: t.project.name } : null,
        priority: t.priority ?? 'Medium',
        status: t.status ?? 'To Do',
        start_planned: t.start_planned ?? null,
        end_planned: t.end_planned ?? null,
        percent_complete: Number(t.percent_complete ?? 0),
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleDelete = async (row: TaskRow) => {
    const ok = confirm(`Hapus task ${row.title}?`);
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/tasks/${row.id}`);
      await fetchTasks();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus task");
    }
  };

  const columns = useTaskColumns(handleDelete);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <Link href="/dashboard/tasks/create" className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create Task</Link>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      <DataTable columns={columns as any} data={rows} loading={loading} />
    </div>
  );
}
