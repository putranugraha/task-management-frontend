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
    permissions: ["melihat project", "mengelola project"],
  },
  {
    label: "Tasks",
    path: "/dashboard/tasks",
    permissions: ["melihat tugas", "mengelola tugas", "mengelola tugas sendiri"],
  },
  {
    label: "Notifications",
    path: "/dashboard/notifications",
    roles: ["Admin", "Manager", "Member"],
  },
  {
    label: "Milestones",
    path: "/dashboard/milestones",
    permissions: ["melihat project", "mengelola project"],
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
    permissions: ["mengelola users"],
  },
  {
    label: "Roles",
    path: "/dashboard/roles",
    permissions: ["mengelola roles"],
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
