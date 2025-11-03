"use client";

import React from "react";
import type { Column } from "./columns";

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  loading,
  emptyText = "No data",
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-full rounded-[28px] bg-white/95 shadow-[0_25px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 overflow-hidden">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
          <thead className="bg-neutral-100/80 text-neutral-700">
            <tr>
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  className={[
                    "px-6 py-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500",
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  c.className ?? "",
                ].join(" ")}
              >
                {c.header}
              </th>
            ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="px-6 py-12 text-center text-slate-400" colSpan={columns.length}>Loading data…</td></tr>
            ) : data.length === 0 ? (
              <tr><td className="px-6 py-12 text-center text-slate-400" colSpan={columns.length}>{emptyText}</td></tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={row.id} className="transition-colors hover:bg-neutral-50">
                  {columns.map((c) => (
                    <td
                      key={String(c.key)}
                      className={[
                        "px-6 py-5 align-middle text-sm text-slate-600",
                        c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                      ].join(" ")}
                    >
                      {c.render ? c.render(row, rowIndex) : String((row as any)[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
