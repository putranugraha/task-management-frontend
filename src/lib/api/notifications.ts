import { apiRequest } from "@/lib/api";

export type NotificationEvent =
  | "task_assigned"
  | "attachment_uploaded"
  | "attachment_approved"
  | "attachment_rejected"
  | "comment_added"
  | "task_status_changed"
  | "task_progress_updated"
  | "task_due_soon"
  | "task_overdue"
  | string;

export type TaskNotification = {
  id: string;
  event: NotificationEvent;
  message: string;
  task_id: number | null;
  task_title: string | null;
  project_id: number | null;
  project_name: string | null;
  entity_type: string | null;
  entity_id: number | null;
  attachment_id: number | null;
  comment_id: number | null;
  actor_id: number | null;
  actor_name: string | null;
  due_date: string | null;
  read_at: string | null;
  created_at: string | null;
};

export type NotificationsMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
};

export type NotificationsResponse = {
  data: TaskNotification[];
  meta: NotificationsMeta;
};

export async function listMyNotifications(params?: {
  only_unread?: boolean;
  page?: number;
  per_page?: number;
}): Promise<NotificationsResponse> {
  const search = new URLSearchParams();
  if (params?.only_unread) search.set("only_unread", "true");
  if (params?.page) search.set("page", String(params.page));
  if (params?.per_page) search.set("per_page", String(params.per_page));

  const qs = search.toString();
  const url = `/api/me/notifications${qs ? `?${qs}` : ""}`;

  const raw = await apiRequest<TaskNotification[] | NotificationsResponse>("GET", url);

  const page = params?.page ?? 1;
  const perPage = params?.per_page ?? 20;

  if (Array.isArray(raw)) {
    const meta: NotificationsMeta = {
      current_page: page,
      last_page: 1,
      per_page: perPage,
      total: raw.length,
      from: raw.length === 0 ? 0 : 1,
      to: raw.length,
    };
    return { data: raw, meta };
  }

  const data = (raw as NotificationsResponse).data ?? [];
  const incomingMeta = (raw as NotificationsResponse).meta;

  const meta: NotificationsMeta = {
    current_page: incomingMeta?.current_page ?? page,
    last_page: incomingMeta?.last_page ?? incomingMeta?.current_page ?? page,
    per_page: incomingMeta?.per_page ?? perPage,
    total: incomingMeta?.total ?? data.length,
    from:
      typeof incomingMeta?.from === "number"
        ? incomingMeta.from
        : data.length === 0
        ? 0
        : (incomingMeta?.current_page ?? page - 1) * (incomingMeta?.per_page ?? perPage) +
          1,
    to:
      typeof incomingMeta?.to === "number"
        ? incomingMeta.to
        : data.length === 0
        ? 0
        : ((incomingMeta?.current_page ?? page - 1) * (incomingMeta?.per_page ?? perPage)) +
          data.length,
  };

  return { data, meta };
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest<unknown>("POST", `/api/me/notifications/${id}/read`);
}

