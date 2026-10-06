import { createRoot } from "react-dom/client";
import { BookOpen, Settings, UserRound } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardNavigationProvider } from "@/components/dashboard/navigation";
import { TeamSwitcher } from "@/components/dashboard/team-switcher";
import { NavUser } from "@/components/dashboard/nav-user";

const calls: string[] = [];
const errors: string[] = [];
const root = createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) => errors.push(String(error)),
});
const auth = {
  authenticated: true,
  loading: false,
  login: () => {},
  register: () => {},
  logout: () => {},
};
Object.assign(window, {
  dashboardTest: {
    calls,
    errors,
    render(mode: string) {
      root.render(
        <SidebarProvider open={mode !== "collapsed"} className="min-h-0">
          {mode === "common" || mode === "collapsed" ? (
            <AppSidebar
              pathname="settings/help"
              collapsible={mode === "collapsed" ? "icon" : "none"}
              onNavigate={(url) => calls.push(url)}
              onClose={() => calls.push("close")}
              data={{
                brand: { name: "Gorth", icon: BookOpen, url: "home" },
                navMain: [
                  { title: "Bookmarks", url: "bookmarks", icon: BookOpen },
                ],
                navSecondary: [
                  { title: "Help", url: "settings/help", icon: Settings },
                ],
                projects: [{ name: "Library", url: "library", icon: BookOpen }],
                user: { name: "Desktop User", email: "fixture@example.test" },
                navDropdown: [
                  { title: "Account", url: "accounts", icon: UserRound },
                ],
              }}
              auth={auth}
            />
          ) : (
            <DashboardNavigationProvider
              pathname=""
              onNavigate={(url) => calls.push(url)}
            >
              <TeamSwitcher
                teams={[{ name: "Gorth", plan: "Desktop", logo: BookOpen }]}
                size={mode === "large" ? "lg" : "default"}
              />
              <NavUser
                user={{ name: "Desktop User", email: "fixture@example.test" }}
                nav={{ main: [], secondary: [] }}
                auth={auth}
                size={mode === "large" ? "lg" : "icon"}
              />
            </DashboardNavigationProvider>
          )}
        </SidebarProvider>,
      );
    },
  },
});
