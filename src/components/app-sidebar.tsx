"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Flag,
  BarChart2,
  Users as UsersIconLucide,
  ShieldCheck,
  Settings as SettingsIconLucide,
  Building2,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const navItems = [
    { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
    { title: "Projects", url: "/dashboard/projects", icon: FolderKanban },
    { title: "Tasks", url: "/dashboard/tasks", icon: ListTodo },
    { title: "Milestones", url: "/dashboard/milestones", icon: Flag },
    { title: "Divisions", url: "/dashboard/divisions", icon: Building2 },
    { title: "Reports", url: "/dashboard/reports", icon: BarChart2 },
    { title: "Users", url: "/dashboard/users", icon: UsersIconLucide },
    { title: "Roles", url: "/dashboard/roles", icon: ShieldCheck },
    { title: "Settings", url: "/dashboard/settings", icon: SettingsIconLucide },
  ].map((i) => ({
    ...i,
    isActive:
      pathname === i.url ||
      (i.url !== "/dashboard" && pathname?.startsWith(i.url)),
  }));

  const [user, setUser] = React.useState({
    name: "Admin",
    email: "admin@example.com",
    avatar: "",
  });

  React.useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (raw) {
        const u = JSON.parse(raw);
        setUser({
          name: u?.name || u?.username || u?.full_name || "Admin",
          email: u?.email || "admin@example.com",
          avatar: u?.avatar || u?.avatar_url || u?.image || u?.photo || "",
        });
      }
    } catch {}
  }, []);

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="flex-shrink-0 w-64 md:w-64 lg:w-64 border-r bg-white dark:bg-neutral-950/70 backdrop-blur supports-[backdrop-filter]:bg-white/60"
      {...props}
    >
      {/* HEADER */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#" aria-label="Home">
                <Image
                  src="/logo/Logo_Central_Saga-removebg-preview.png"
                  alt="Logo"
                  width={80}
                  height={80}
                  className="rounded-md object-contain mx-auto"
                />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* MAIN MENU */}
      <SidebarContent>
        <NavMain items={navItems as any} />
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t border-neutral-200 dark:border-neutral-800">
        <NavUser user={user} />
      </SidebarFooter>

      {/* RAIL (garis collapse sidebar) */}
      <SidebarRail />
    </Sidebar>
  );
}
