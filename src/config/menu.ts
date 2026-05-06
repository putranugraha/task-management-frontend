import type { DashboardType, PrimaryRole } from "@/types/auth";

export type MenuItem = {
  label: string;
  path: string;
  roles?: Exclude<PrimaryRole, null>[];
  permissions?: string[];
  dashboardTypes?: Exclude<DashboardType, null>[];
};

export const MENU_ITEMS: MenuItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    roles: ["Admin", "Manager", "Member"],
  },
  {
    label: "Projects",
    path: "/dashboard/projects",
    permissions: ["melihat project", "membuat project", "mengubah project", "menghapus project"],
  },
  {
    label: "Tasks",
    path: "/dashboard/tasks",
    permissions: ["melihat tugas", "membuat tugas", "mengubah tugas", "menghapus tugas", "mengelola tugas sendiri"],
  },
  {
    label: "Notifications",
    path: "/dashboard/notifications",
    roles: ["Admin", "Manager", "Member"],
  },
  {
    label: "Milestones",
    path: "/dashboard/milestones",
    roles: ["Admin", "Manager", "Member"],
  },
  {
    label: "Divisions",
    path: "/dashboard/divisions",
    roles: ["Admin", "Manager"],
  },
  {
    label: "Reports",
    path: "/dashboard/reports",
    permissions: ["melihat laporan pribadi", "mencetak laporan"],
  },
  {
    label: "Users",
    path: "/dashboard/users",
    permissions: ["melihat users", "membuat users", "mengubah users", "menghapus users"],
  },
  {
    label: "Roles",
    path: "/dashboard/roles",
    permissions: ["melihat roles", "membuat roles", "mengubah roles", "menghapus roles"],
  },
  {
    label: "Activity Log",
    path: "/dashboard/activity-log",
    roles: ["Admin"],
  },
  {
    label: "Settings",
    path: "/dashboard/settings",
    roles: ["Admin"],
  },
];
