"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Flag,
  BarChart2,
  Users,
  ShieldCheck,
  Settings,
  LogOut,
  Building2,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/api";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { label: "Tasks", href: "/dashboard/tasks", icon: ListTodo },
  { label: "Milestones", href: "/dashboard/milestones", icon: Flag },
  { label: "Divisions", href: "/dashboard/divisions", icon: Building2 },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart2 },
  { label: "Users", href: "/dashboard/users", icon: Users },
  { label: "Roles", href: "/dashboard/roles", icon: ShieldCheck },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = useCallback(
    (href: string) => (pathname === href) || (href !== "/dashboard" && pathname?.startsWith(href)),
    [pathname]
  );

  const items = useMemo(() => navItems, []);

  return (
    <aside
      className="hidden md:flex md:flex-col w-64 shrink-0 border-r bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-neutral-950/50 dark:supports-[backdrop-filter]:bg-neutral-950/30 sticky top-0 h-screen"
    >
      <div className="h-14 px-4 flex items-center border-b">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <div className="h-7 w-7 rounded-md bg-black text-white dark:bg-white dark:text-black grid place-items-center text-[11px] font-bold">CSM</div>
          <span>Central Saga Mandala</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="grid gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-neutral-100 text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <UserQuickPanel />
    </aside>
  );
}

function UserQuickPanel() {
  const onLogout = async () => {
    try {
      // Try API logout if available; ignore errors. Use centralized api client for consistency.
      await apiRequest("POST", "/api/logout").catch(() => {});
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token_type");
        localStorage.removeItem("user");
        // Clear presence cookie used by middleware guard
        document.cookie = "app_has_token=; Max-Age=0; path=/";
        window.location.href = "/auth/login";
      }
    }
  };

  return (
    <div className="border-t p-3">
      <button
        onClick={onLogout}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 active:bg-neutral-100 dark:hover:bg-neutral-900"
      >
        <LogOut className="h-4 w-4" />
        <span>Logout</span>
      </button>
      <p className="mt-2 text-[11px] text-neutral-500">
        Logged in via API. Manage session and token from here.
      </p>
    </div>
  );
}
