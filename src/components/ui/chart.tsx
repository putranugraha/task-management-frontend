"use client";

import * as React from "react";
import type { TooltipProps } from "recharts";
import { Tooltip as RechartsTooltip } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label: string;
    /**
     * CSS color value, for example:
     * - "hsl(var(--chart-1))"
     * - "#10b981"
     */
    color?: string;
  }
>;

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

export function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) {
    throw new Error("useChart must be used within a ChartContainer.");
  }
  return ctx;
}

type ChartContainerProps = React.HTMLAttributes<HTMLElement> & {
  config: ChartConfig;
};

export function ChartContainer({
  config,
  className,
  style,
  children,
  ...props
}: ChartContainerProps) {
  const cssVars: React.CSSProperties = { ...(style || {}) };

  for (const [key, value] of Object.entries(config)) {
    if (value?.color) {
      (cssVars as any)[`--color-${key}`] = value.color;
    }
  }

  return (
    <ChartContext.Provider value={{ config }}>
      <figure
        className={cn("flex flex-col gap-2", className)}
        style={cssVars}
        {...props}
      >
        {children}
      </figure>
    </ChartContext.Provider>
  );
}

export function ChartTooltip(props: TooltipProps<number, string>) {
  return <RechartsTooltip {...props} />;
}

export function ChartTooltipContent({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const { config } = useChart();
  const item = payload[0];
  const data = (item && (item.payload as any)) || {};

  const key = data.key as string | undefined;
  const cfg = key ? config[key] : undefined;

  const label = cfg?.label ?? data.label ?? item.name;
  const value = item.value ?? data.value ?? 0;

  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="font-medium text-slate-900">{label}</span>
      </div>
      <p className="mt-1 text-slate-500">{value} item</p>
    </div>
  );
}

