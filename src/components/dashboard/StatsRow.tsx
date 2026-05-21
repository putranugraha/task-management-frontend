"use client";

import { UsersIcon, UserIcon, UserMinusIcon } from "@heroicons/react/24/outline";

type StatsRowProps = {
  stats: {
    total: number;
    active: number;
    inactive: number;
    totalPercent?: number;
    activePercent?: number;
    inactivePercent?: number;
  };
  loading: boolean;
};

const cardPalette = {
  total: {
    gradient: "from-[#3B82F6] to-[#2563EB]",
    icon: UsersIcon,
    deltaColor: "text-sky-100",
  },
  active: {
    gradient: "from-[#10B981] to-[#059669]",
    icon: UserIcon,
    deltaColor: "text-emerald-100",
  },
  inactive: {
    gradient: "from-[#F43F5E] to-[#E11D48]",
    icon: UserMinusIcon,
    deltaColor: "text-rose-100",
  },
} as const;

export default function StatsRow({ stats, loading }: StatsRowProps) {
  const totalPercent = stats.totalPercent ?? (stats.total ? Math.round((stats.active / Math.max(1, stats.total)) * 100) : 0);
  const activePercent = stats.activePercent ?? (stats.total ? Math.round((stats.active / Math.max(1, stats.total)) * 100) : 0);
  const inactivePercent = stats.inactivePercent ?? (stats.total ? Math.round((stats.inactive / Math.max(1, stats.total)) * 100) : 0);

  const cards = [
    {
      key: "total" as const,
      title: "TOTAL USERS",
      value: stats.total,
      delta: `+${totalPercent}%`,
    },
    {
      key: "active" as const,
      title: "ACTIVE",
      value: stats.active,
      delta: `+${activePercent}%`,
    },
    {
      key: "inactive" as const,
      title: "INACTIVE",
      value: stats.inactive,
      delta: `${inactivePercent > 0 ? "+" : ""}${inactivePercent}%`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {cards.map((card) => {
        const palette = cardPalette[card.key];
        const Icon = palette.icon;

        return (
          <div
            key={card.key}
            className={`group flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br ${palette.gradient} p-6 text-white shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.32em] text-white/70">{card.title}</p>
                <div className="mt-4 text-4xl font-semibold">
                  {loading ? (
                    <span className="inline-flex h-9 w-20 animate-pulse rounded-lg bg-white/30" />
                  ) : (
                    <span className="tabular-nums">{card.value}</span>
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
                <span className={palette.deltaColor}>{card.delta}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
