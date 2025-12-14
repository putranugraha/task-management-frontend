"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

export function DetailMainCard({ children, className }: Props) {
  return (
    <div
      className={cn(
        "w-full min-w-full rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DetailSectionCard({ children, className }: Props) {
  return (
    <section
      className={cn(
        "w-full rounded-[24px] border border-transparent bg-white/95 shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 p-4",
        className
      )}
    >
      {children}
    </section>
  );
}

export function DetailTwoColumnGrid({ children, className }: Props) {
  return (
    <div className={cn("grid min-w-0 w-full gap-4 md:grid-cols-2", className)}>
      {children}
    </div>
  );
}
