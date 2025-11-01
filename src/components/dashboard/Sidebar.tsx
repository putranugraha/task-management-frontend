"use client";

import Link from "next/link";
import Image from "next/image";
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
  Building2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useSidebar } from "@/components/ui/sidebar/SidebarContext";
import { PanelLeft, X, ChevronsUpDown, Sparkles, User, CreditCard, Bell, LogOut } from "lucide-react";

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
  const { collapsed, toggleCollapsed, openMobile, close } = useSidebar();
  const [drawerIn, setDrawerIn] = useState(false);

  // Animate mobile drawer slide-in and Escape to close
  useEffect(() => {
    if (openMobile) {
      const id = requestAnimationFrame(() => setDrawerIn(true));
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
      window.addEventListener('keydown', onKey);
      return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', onKey); setDrawerIn(false); };
    } else {
      setDrawerIn(false);
    }
  }, [openMobile, close]);

  const isActive = useCallback(
    (href: string) => (pathname === href) || (href !== "/dashboard" && pathname?.startsWith(href)),
    [pathname]
  );

  const items = useMemo(() => navItems, []);

  return (
    <>
      {/* Desktop / Tablet sidebar */}
      <aside
        className={[
          "hidden md:flex md:flex-col shrink-0 border-r bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-neutral-950/50 dark:supports-[backdrop-filter]:bg-neutral-950/30 sticky top-0 h-screen transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-64",
        ].join(" ")}
      >
        <div className={["px-3 grid grid-cols-[1fr_auto_1fr] items-center border-b", collapsed ? "h-14" : "h-20"].join(" ")}
        >
          <div />
          <div className="flex justify-center py-1">
            {!collapsed && (
              <Image
                src="/logo/Logo_Central_Saga-removebg-preview.png"
                alt="Company Logo"
                width={80}
                height={80}
                className="rounded-md object-contain"
                priority
              />
            )}
          </div>
          <div className="flex justify-end" />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
          <ul className="grid gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={[
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600",
                      active
                        ? "bg-neutral-100 text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
                      collapsed ? "justify-center" : "",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 flex-none" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <UserProfileCard collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {openMobile && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            role="button"
            aria-label="Close sidebar"
            onClick={close}
          />
          <aside className={["absolute left-0 top-0 h-full w-72 border-r bg-white dark:bg-neutral-950 shadow-xl transform transition-transform duration-200 ease-out",
            drawerIn ? "translate-x-0" : "-translate-x-full"].join(" ")}
          >
            <div className="h-20 px-3 grid grid-cols-[1fr_auto_1fr] items-center border-b">
              <div />
              <div className="flex justify-center py-1">
                <Image
                  src="/logo/Logo_Central_Saga-removebg-preview.png"
                  alt="Company Logo"
                  width={80}
                  height={80}
                  className="rounded-md object-contain"
                  priority
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={close}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
              <ul className="grid gap-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={close}
                        className={[
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600",
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
            <div className="border-t p-3">
              <UserProfileCard />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function UserProfileCard({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        setUser({
          name: u?.name || u?.username || u?.full_name || "User",
          email: u?.email || "",
          avatarUrl: u?.avatar || u?.avatar_url || u?.image || u?.photo,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
    <div className="border-t p-2 relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={[
          "w-full inline-flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600",
          collapsed ? "justify-center" : "justify-between",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? "Open user menu" : "Open user profile menu"}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={user?.avatarUrl} name={user?.name || "U"} size={32} />
          {!collapsed && (
            <div className="grid min-w-0">
              <span className="text-sm font-medium truncate">{user?.name || "shadcn"}</span>
              <span className="text-[11px] text-neutral-500 truncate">{user?.email || "m@example.com"}</span>
            </div>
          )}
        </div>
        {!collapsed && <ChevronsUpDown className={["h-4 w-4 text-neutral-500 transition-transform duration-150", open ? "rotate-180" : "rotate-0"].join(" ")} />}
      </button>

      {open && (
        <>
          {/* click-away overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute bottom-16 left-2 right-2 z-50 rounded-xl border bg-white shadow-lg ring-1 ring-black/5 dark:bg-neutral-950 origin-bottom-left animate-pop-in"
          >
            <div className="px-3 pt-3 pb-2 flex items-center gap-3">
              <Avatar src={user?.avatarUrl} name={user?.name || "U"} size={36} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user?.name || "shadcn"}</div>
                <div className="text-[11px] text-neutral-500 truncate">{user?.email || "m@example.com"}</div>
              </div>
            </div>
            <div className="border-t" />
            <MenuItem icon={User} label="Account" onClick={() => setOpen(false)} />
            <MenuItem icon={Bell} label="Notifications" onClick={() => setOpen(false)} />
            <div className="border-t" />
            <MenuItem icon={LogOut} label="Log out" onClick={onLogout} />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
    >
      <Icon className="h-4 w-4 text-neutral-500" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Avatar({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  const initials = (name || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const style: React.CSSProperties = { width: size, height: size };
  return (
    <div
      className="flex items-center justify-center rounded-md bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 overflow-hidden"
      style={style}
      aria-hidden={false}
    >
      {src ? (
        <Image src={src} alt={name} width={size} height={size} className="rounded-md object-cover" />
      ) : (
        <span className="text-xs font-semibold">{initials}</span>
      )}
    </div>
  );
}
