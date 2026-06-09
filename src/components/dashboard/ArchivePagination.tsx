"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";

export type ArchivePaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
};

export function ArchivePagination({
  meta,
  rowsPerPage,
  onRowsPerPageChange,
  onPageChange,
}: {
  meta: ArchivePaginationMeta;
  rowsPerPage: number;
  onRowsPerPageChange: (value: number) => void;
  onPageChange: (page: number) => void;
}) {
  const currentPage = Math.max(1, meta.current_page || 1);
  const lastPage = Math.max(1, meta.last_page || 1);
  const from = meta.total === 0 ? 0 : (meta.from ?? ((currentPage - 1) * meta.per_page + 1));
  const to = meta.total === 0 ? 0 : (meta.to ?? Math.min(currentPage * meta.per_page, meta.total));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-4">
        <span>Showing {from} to {to} of {meta.total}</span>
        <RowsPerPageControl value={rowsPerPage} onChange={onRowsPerPageChange} label="Per page" />
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className="archive-page-button" onClick={() => onPageChange(1)} disabled={currentPage === 1} aria-label="First page">
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button type="button" className="archive-page-button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-3 text-xs font-semibold text-slate-500">Page {currentPage} of {lastPage}</span>
        <button type="button" className="archive-page-button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === lastPage} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className="archive-page-button" onClick={() => onPageChange(lastPage)} disabled={currentPage === lastPage} aria-label="Last page">
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
      <style jsx>{`
        .archive-page-button {
          display: flex;
          height: 2.25rem;
          width: 2.25rem;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          border: 1px solid rgb(226 232 240);
          background: white;
          color: rgb(100 116 139);
          transition: 150ms ease;
        }
        .archive-page-button:hover:not(:disabled) {
          border-color: rgb(167 243 208);
          color: rgb(5 150 105);
        }
        .archive-page-button:disabled {
          opacity: 0.4;
        }
      `}</style>
    </div>
  );
}
