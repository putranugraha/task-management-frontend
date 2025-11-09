"use client";

import { FolderKanban, CheckCircle2, PlayCircle } from "lucide-react";

type Stats = {
  total: number;
  active: number;
  completed: number;
  totalPercent?: number;
  activePercent?: number;
  completedPercent?: number;
};

export default function ProjectStatsRow({ stats, loading }: { stats: Stats; loading: boolean }) {
  const totalPercent = stats.totalPercent ?? (stats.total ? Math.round((stats.active / Math.max(1, stats.total)) * 100) : 0);
  const activePercent = stats.activePercent ?? (stats.total ? Math.round((stats.active / Math.max(1, stats.total)) * 100) : 0);
  const completedPercent = stats.completedPercent ?? (stats.total ? Math.round((stats.completed / Math.max(1, stats.total)) * 100) : 0);

  const cards = [
    {
      key: "total" as const,
      title: "TOTAL PROJECTS",
      gradient: "from-[#3B82F6] to-[#2563EB]",
      Icon: FolderKanban,
      value: stats.total,
      delta: `+${totalPercent}%`,
      deltaColor: "text-sky-100",
    },
    {
      key: "active" as const,
      title: "ACTIVE",
      gradient: "from-[#10B981] to-[#059669]",
      Icon: PlayCircle,
      value: stats.active,
      delta: `+${activePercent}%`,
      deltaColor: "text-emerald-100",
    },
    {
      key: "completed" as const,
      title: "COMPLETED",
      gradient: "from-[#16A34A] to-[#15803D]",
      Icon: CheckCircle2,
      value: stats.completed,
      delta: `+${completedPercent}%`,
      deltaColor: "text-emerald-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {cards.map(({ key, title, gradient, Icon, value, delta, deltaColor }) => (
        <div
          key={key}
          className={[
            "group flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br",
            gradient,
            "p-6 text-white shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg",
          ].join(" ")}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.32em] text-white/70">{title}</p>
              <div className="mt-4 text-4xl font-semibold">
                {loading ? (
                  <span className="inline-flex h-9 w-20 animate-pulse rounded-lg bg-white/30" />
                ) : (
                  <span className="tabular-nums">{value}</span>
                )}
              </div>
            </div>
            <span className="rounded-xl bg-white/15 p-2 text-white">
              <Icon className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between text-xs font-semibold">
            <span className="text-white/70">Updated live</span>
            {loading ? (
              <span className="inline-flex h-4 w-14 animate-pulse rounded-full bg-white/30" />
            ) : (
              <span className={deltaColor}>{delta}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

