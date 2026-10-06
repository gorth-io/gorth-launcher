"use client";

import { useState } from "react";
import { usePathname } from "@/components/dashboard/navigation";
import { DashboardLink as Link } from "@/components/dashboard/navigation";
import { ChevronRight, CircleDot, CircleSmall } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "cn";
import { NavCoreProps, NavMainItem } from "@/components/dashboard/interface";

function isPathActive(pathname: string, url: string) {
  return url !== "#" && pathname === url;
}

function NavItems({ items, ...props }: NavCoreProps) {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const closeMobile = () => {
    setOpenMobile(false);
  };

  return (
    <SidebarGroup {...props}>
      <SidebarMenu>
        {items.map((item: NavMainItem, index) => {
          const key = `${item.title}-${item.url}-${index}`;
          const directActive =
            item.isActive ?? isPathActive(pathname, item.url);
          const childActive = Boolean(
            item.items?.some((child) => isPathActive(pathname, child.url)),
          );
          const hasChildren = Boolean(item.items?.length);

          if (!hasChildren) {
            return (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  className="h-9 group-data-[collapsible=icon]:size-9! [&>svg]:size-4"
                  tooltip={item.title}
                  isActive={directActive}
                  aria-current={directActive ? "page" : undefined}
                  render={<Link href={item.url} onClick={closeMobile} />}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
                {item.badge !== undefined && (
                  <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          }

          if (state === "collapsed" && !isMobile) {
            return (
              <SidebarMenuItem key={key}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton
                        className="h-9 group-data-[collapsible=icon]:size-9! [&>svg]:size-4"
                        tooltip={item.title}
                        isActive={directActive || childActive}
                        aria-label={`Open ${item.title} menu`}
                      />
                    }
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ms-auto size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="right"
                    align="start"
                    sideOffset={4}
                    className="w-56"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {item.items?.map((child, childIndex) => {
                        const active = isPathActive(pathname, child.url);
                        return (
                          <DropdownMenuItem
                            className="h-9"
                            key={`${child.title}-${child.url}-${childIndex}`}
                            render={
                              <Link
                                href={child.url}
                                onClick={closeMobile}
                                className={cn(
                                  "w-full",
                                  active && "bg-accent text-accent-foreground",
                                )}
                              />
                            }
                          >
                            {active ? (
                              <CircleDot className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <CircleSmall className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="max-w-48 text-wrap">
                              {child.title}
                            </span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            );
          }

          const open = openItems[key] ?? childActive;
          const parentActive = directActive || (childActive && !open);

          return (
            <Collapsible
              key={key}
              open={open}
              onOpenChange={(nextOpen) =>
                setOpenItems((current) => ({ ...current, [key]: nextOpen }))
              }
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    className="h-9 group-data-[collapsible=icon]:size-9! [&>svg]:size-4"
                    tooltip={item.title}
                    isActive={parentActive}
                  />
                }
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
                <ChevronRight className="ms-auto size-4 transition-transform duration-300 group-data-open/collapsible:rotate-90 rtl:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((child, childIndex) => {
                    const active = isPathActive(pathname, child.url);
                    return (
                      <SidebarMenuSubItem
                        key={`${child.title}-${child.url}-${childIndex}`}
                      >
                        <SidebarMenuSubButton
                          className="h-9 group-data-[collapsible=icon]:size-9! [&>svg]:size-4"
                          isActive={active}
                          render={
                            <Link href={child.url} onClick={closeMobile} />
                          }
                        >
                          {active ? (
                            <CircleDot className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <CircleSmall className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm text-foreground">
                            {child.title}
                          </span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function NavMaster(props: NavCoreProps) {
  return <NavItems {...props} />;
}

export function NavOrigin(props: NavCoreProps) {
  return <NavItems {...props} />;
}

export function NavCapital(props: NavCoreProps) {
  return <NavItems {...props} />;
}

export function NavMain(props: NavCoreProps) {
  return <NavItems {...props} />;
}

export function NavSub(props: NavCoreProps) {
  return <NavItems {...props} />;
}
