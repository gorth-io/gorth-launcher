import * as React from "react";
import { DashboardLink as Link } from "@/components/dashboard/navigation";
import { usePathname } from "@/components/dashboard/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavMainItem } from "@/components/dashboard/interface";

interface NavCoreProps extends React.ComponentPropsWithoutRef<
  typeof SidebarGroup
> {
  items: NavMainItem[];
}
export function NavSecondary({ items, ...props }: NavCoreProps) {
  const pathname = usePathname();
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  className="h-9 group-data-[collapsible=icon]:size-9! [&>svg]:size-4"
                  isActive={item.isActive ?? pathname === item.url}
                  aria-current={
                    (item.isActive ?? pathname === item.url)
                      ? "page"
                      : undefined
                  }
                  render={<Link href={item.url} />}
                >
                  <Icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
