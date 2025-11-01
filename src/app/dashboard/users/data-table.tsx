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
    <div className="w-full overflow-x-auto border rounded-lg">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-neutral-50 text-neutral-700">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className={[
                  "font-medium px-3 py-2 border-b",
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  c.className ?? "",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  {c.header}
                  <span className="text-neutral-400">⇅</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td className="px-3 py-6 text-center text-neutral-500" colSpan={columns.length}>Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td className="px-3 py-6 text-center text-neutral-500" colSpan={columns.length}>{emptyText}</td></tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                {columns.map((c) => (
                  <td
                    key={String(c.key)}
                    className={[
                      "px-3 py-2 border-t align-middle text-sm",
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
  );
}
