import { useState } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DashboardMenu, DashboardMenuItem } from "@/components/dashboard/menu";
import type { TeamProps } from "@/components/dashboard/interface";

export function TeamSwitcher({
  teams,
  size = "lg",
  onTeamChange,
  onAddTeam,
}: {
  teams: TeamProps[];
  size?: "default" | "lg";
  onTeamChange?: (team: TeamProps) => void;
  onAddTeam?: () => void;
}) {
  const [activeName, setActiveName] = useState(teams[0]?.name);
  const activeTeam = teams.find((team) => team.name === activeName) ?? teams[0];
  if (!activeTeam) return null;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DashboardMenu
          label="Switch team"
          align="start"
          trigger={
            <SidebarMenuButton
              size={size}
              className={
                size === "lg"
                  ? "h-14 group-data-[collapsible=icon]:h-14!"
                  : "h-9 group-data-[collapsible=icon]:size-9!"
              }
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          }
        >
          {(close) => (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Teams
              </div>
              {teams.map((team) => (
                <DashboardMenuItem
                  key={team.name}
                  onClick={() => {
                    setActiveName(team.name);
                    onTeamChange?.(team);
                    close();
                  }}
                >
                  <team.logo className="size-4" />
                  <span className="truncate">{team.name}</span>
                </DashboardMenuItem>
              ))}
              {onAddTeam && (
                <>
                  <Separator className="my-1" />
                  <DashboardMenuItem
                    onClick={() => {
                      close();
                      onAddTeam();
                    }}
                  >
                    <Plus />
                    Add team
                  </DashboardMenuItem>
                </>
              )}
            </>
          )}
        </DashboardMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
