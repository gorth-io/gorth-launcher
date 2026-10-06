import { Command, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NavMaster } from "@/components/dashboard/nav-main";
import { NavSecondary } from "@/components/dashboard/nav-secondary";
import { NavProjects } from "@/components/dashboard/nav-projects";
import { NavUser } from "@/components/dashboard/nav-user";
import { TeamSwitcher } from "@/components/dashboard/team-switcher";
import {
  DashboardLink,
  DashboardNavigationProvider,
} from "@/components/dashboard/navigation";
import type { AppSidebarProps } from "@/components/dashboard/interface";

export function AppSidebar({
  data,
  auth,
  pathname,
  onNavigate,
  onClose,
  empty,
  collapsible = "none",
  ...props
}: AppSidebarProps) {
  const BrandIcon = data.brand?.icon ?? Command;
  return (
    <DashboardNavigationProvider pathname={pathname} onNavigate={onNavigate}>
      <Sidebar collapsible={collapsible} {...props}>
        <SidebarHeader>
          {data.teams?.length ? (
            <TeamSwitcher teams={data.teams} />
          ) : (
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-1">
                <SidebarMenuButton
                  className="h-9 group-data-[collapsible=icon]:size-9! [&>svg]:size-4"
                  render={<DashboardLink href={data.brand?.url ?? "/"} />}
                >
                  {data.brand?.logo ? (
                    <img src={data.brand.logo} alt="" className="size-4" />
                  ) : (
                    <BrandIcon className="size-4" />
                  )}
                  <span className="truncate font-medium">
                    {data.brand?.name ?? "Gorth"}
                  </span>
                </SidebarMenuButton>
                {onClose && (
                  <Button
                    aria-label="Close sidebar"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={onClose}
                  >
                    <PanelLeftClose className="size-4" />
                  </Button>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarHeader>
        <SidebarContent className="gap-0">
          <SidebarSeparator className="m-0" />
          {data.navMain.length ? <NavMaster items={data.navMain} /> : empty}
          {!!data.navSecondary?.length && (
            <>
              <SidebarSeparator className="m-0" />
              <NavSecondary items={data.navSecondary} />
            </>
          )}
          {!!data.projects?.length && (
            <>
              <SidebarSeparator className="m-0" />
              <NavProjects projects={data.projects} className="mt-auto" />
            </>
          )}
        </SidebarContent>
        {data.user && auth && (
          <SidebarFooter>
            <NavUser
              user={data.user}
              type="sidebar"
              size="lg"
              auth={auth}
              nav={{
                main: data.navDropdown ?? [],
                secondary: data.navSignal ?? [],
              }}
            />
          </SidebarFooter>
        )}
      </Sidebar>
    </DashboardNavigationProvider>
  );
}
