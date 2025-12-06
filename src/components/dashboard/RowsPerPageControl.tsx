"use client";

import { ChevronsUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RowsPerPageControlProps = {
  value: number;
  onChange: (next: number) => void;
  options?: number[];
  label?: string;
};

export function RowsPerPageControl({
  value,
  onChange,
  options = [10, 25, 50],
  label = "Rows per page",
}: RowsPerPageControlProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
      <span>{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner ring-1 ring-slate-200 transition hover:border-emerald-300 hover:ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <span className="min-w-[1.5rem] text-center">{value}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-emerald-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-[120px] rounded-xl border border-emerald-100 bg-white/95 p-1 text-sm shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
        >
          {options.map((size) => (
            <DropdownMenuItem
              key={size}
              onSelect={() => onChange(size)}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
            >
              <span>{size}</span>
              {size === value && <Check className="h-4 w-4 text-emerald-500" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

