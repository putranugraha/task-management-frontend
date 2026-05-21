"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationProvider } from "@/contexts/notification-context";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!state.isInitialized) return;
    if (state.token) return;

    const nextPath =
      typeof window !== "undefined" ? window.location.pathname : "/dashboard";
    const search = new URLSearchParams();
    search.set("next", nextPath);

    router.replace(`/auth/login?${search.toString()}`);
  }, [state.isInitialized, state.token, router]);

  return (
    <NotificationProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full items-stretch bg-background text-foreground">
          <AppSidebar />
          <SidebarInset className="flex flex-1 min-w-0 flex-col md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
            <DesktopTopBar />
            <MobileTopBar />
            <main className="flex w-full min-w-0 flex-1 flex-col px-3 py-6 md:px-5 md:py-8 xl:px-6">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </NotificationProvider>
  );
}

function DesktopTopBar() {
  return (
    <div className="hidden md:block sticky top-0 z-30 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-neutral-950/50 dark:supports-[backdrop-filter]:bg-neutral-950/30 border-b">
      <div className="h-14 px-6 md:px-8 flex items-center gap-3">
        <SidebarTrigger className="h-9 w-9">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
      </div>
    </div>
  );
}

function MobileTopBar() {
  return (
    <div className="md:hidden sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-neutral-950/50 dark:supports-[backdrop-filter]:bg-neutral-950/30">
      <div className="h-14 px-4 flex items-center gap-3">
        <SidebarTrigger className="h-9 w-9">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <span className="text-sm font-semibold">Menu</span>
      </div>
    </div>
  );
}
