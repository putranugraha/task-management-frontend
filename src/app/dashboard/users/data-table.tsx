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
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-700">
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} className="text-left font-medium px-3 py-2 border-b">
                {c.header}
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
            data.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2 border-t align-top">
                    {c.render ? c.render(row) : String((row as any)[c.key] ?? "")}
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

