import { Box, Info, LogIn, KeySquare, UserRound } from "lucide-react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { navigation } from "@/components/dashboard/navigation-data";
import { useAuth } from "@/hooks/use-auth";
import type { Page } from "@/lib/utils/interface";

interface DashboardProps {
  page: Page;
  onNavigate: (page: Page) => void;
  instanceCount: number;
  unreadCount: number;
}
export function Dashboard({
  page,
  onNavigate,
  instanceCount,
  unreadCount,
}: DashboardProps) {
  const auth = useAuth();
  const account = auth.auth?.launcher;
  return (
    <AppSidebar
      collapsible="offcanvas"
      className="top-28 h-[calc(100svh-7rem)]"
      pathname={page}
      auth={auth}
      onNavigate={(url) => {
        const target = navigation.find((item) => item.id === url);
        if (target) onNavigate(target.id);
        else if (url === "settings/help") onNavigate("settings/help");
      }}
      data={{
        brand: { name: "Launcher", icon: Box, url: "home" },
        navMain: navigation.map((item) => ({
          title: item.label,
          url: item.id,
          icon: item.icon,
          isActive:
            page === item.id ||
            (item.id === "settings" && page === "settings/help"),
          badge:
            item.id === "library"
              ? instanceCount
              : item.id === "notifications" && unreadCount > 0
                ? unreadCount
                : undefined,
        })),
        user: {
          name: account?.name ?? "Đăng nhập Gorth",
          email: account?.email ?? "",
          avatar: account?.image,
        },
        navDropdown: [
          { title: "Tài khoản", url: "accounts", icon: UserRound },
          { title: "Về Gorth Launcher", url: "settings/help", icon: Info },
        ],
        navSignal: [
          { title: "Sign in", url: "/sign-in", icon: LogIn },
          { title: "Create account", url: "/sign-up", icon: KeySquare },
        ],
      }}
    />
  );
}
