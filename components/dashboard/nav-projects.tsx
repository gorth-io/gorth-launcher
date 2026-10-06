import { Folder, MoreHorizontal, Share, Trash2 } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DashboardMenu, DashboardMenuItem } from "@/components/dashboard/menu";
import {
  DashboardLink,
  useDashboardNavigation,
} from "@/components/dashboard/navigation";
import type { ComponentProps } from "react";
import type { ProjectProps } from "@/components/dashboard/interface";

export function NavProjects({
  projects,
  title = "Explore",
  ...props
}: ComponentProps<typeof SidebarGroup> & {
  projects: ProjectProps[];
  title?: string;
}) {
  const { onNavigate } = useDashboardNavigation();
  return (
    <SidebarGroup {...props}>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.url} className="flex items-center gap-1">
            <SidebarMenuButton
              className="h-9 group-data-[collapsible=icon]:size-9! [&>svg]:size-4"
              render={<DashboardLink href={item.url} />}
            >
              <item.icon />
              <span className="truncate">{item.name}</span>
            </SidebarMenuButton>
            {(item.onShare || item.onDelete) && (
              <div className="w-9 shrink-0">
                <DashboardMenu
                  label={`More actions for ${item.name}`}
                  trigger={
                    <SidebarMenuButton className="size-9 p-2">
                      <MoreHorizontal />
                    </SidebarMenuButton>
                  }
                >
                  {(close) => (
                    <>
                      <DashboardMenuItem
                        onClick={() => {
                          close();
                          onNavigate(item.url);
                        }}
                      >
                        <Folder />
                        View project
                      </DashboardMenuItem>
                      {item.onShare && (
                        <DashboardMenuItem
                          onClick={() => {
                            close();
                            item.onShare?.();
                          }}
                        >
                          <Share />
                          Share project
                        </DashboardMenuItem>
                      )}
                      {item.onDelete && (
                        <>
                          <Separator className="my-1" />
                          <DashboardMenuItem
                            onClick={() => {
                              close();
                              item.onDelete?.();
                            }}
                          >
                            <Trash2 />
                            Delete project
                          </DashboardMenuItem>
                        </>
                      )}
                    </>
                  )}
                </DashboardMenu>
              </div>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
