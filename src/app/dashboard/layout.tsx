"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-background text-foreground">
        {/* Sidebar kiri */}
        <AppSidebar />

        {/* Konten utama */}
        <SidebarInset className="flex flex-1 min-w-0 flex-col md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
          {/* Topbar */}
          <DesktopTopBar />
          <MobileTopBar />

          {/* Area konten */}
          <div className="flex-1 w-full overflow-y-auto">
            <div className="px-4 md:px-6 lg:px-10 py-5 md:py-8">
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function DesktopTopBar() {
  return (
    <div className="hidden md:block sticky top-0 z-30 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-neutral-950/50 dark:supports-[backdrop-filter]:bg-neutral-950/30">
      <div className="h-14 px-6 md:px-8 flex items-center gap-3">
        <SidebarTrigger className="h-9 w-9" />
      </div>
    </div>
  );
}

function MobileTopBar() {
  return (
    <div className="md:hidden sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:bg-neutral-950/50 dark:supports-[backdrop-filter]:bg-neutral-950/30">
      <div className="h-14 px-4 flex items-center gap-3">
        <SidebarTrigger className="h-9 w-9" />
        <span className="text-sm font-semibold">Menu</span>
      </div>
    </div>
  );
}
