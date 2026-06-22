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
  },
  {
    label: "Projects",
    path: "/dashboard/projects",
    permissions: ["melihat project"],
  },
  {
    label: "Tasks",
    path: "/dashboard/tasks",
    permissions: ["melihat tugas"],
  },
  {
    label: "Notifications",
    path: "/dashboard/notifications",
  },
  {
    label: "Milestones",
    path: "/dashboard/milestones",
    permissions: ["melihat milestones"],
  },
  {
    label: "Divisions",
    path: "/dashboard/divisions",
    permissions: ["melihat divisions"],
  },
  {
    label: "Reports",
    path: "/dashboard/reports",
    permissions: ["melihat laporan pribadi", "melihat laporan project", "mencetak laporan"],
  },
  {
    label: "Users",
    path: "/dashboard/users",
    permissions: ["melihat users"],
  },
  {
    label: "Roles",
    path: "/dashboard/roles",
    permissions: ["melihat roles"],
  },
  {
    label: "Activity Log",
    path: "/dashboard/activity-log",
    permissions: ["melihat activity log"],
  },
];
