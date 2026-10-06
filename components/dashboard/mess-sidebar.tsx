"use client";

import React from "react";

import {
  DashboardNavigationProvider,
  DashboardLink as Link,
} from "@/components/dashboard/navigation";

import { Command } from "lucide-react";

import { NavUser } from "@/components/dashboard/nav-user";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { MessSidebarProps } from "@/components/dashboard/interface";
import { cn } from "cn";

export function MessSidebar({
  pathname,
  onNavigate,
  ...props
}: MessSidebarProps) {
  return (
    <DashboardNavigationProvider pathname={pathname} onNavigate={onNavigate}>
      <MessSidebarContent {...props} />
    </DashboardNavigationProvider>
  );
}

function MessSidebarContent({
  data,
  auth,
  activeMessageId = "",
  ...props
}: Omit<MessSidebarProps, "pathname" | "onNavigate">) {
  const [activeItem, setActiveItem] = React.useState(data.navMain[0]);
  const [query, setQuery] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const messages = data.navMessage.filter(
    (message) =>
      (!unreadOnly || message.unread) &&
      [message.name, message.email, message.subject, message.teaser].some(
        (text) => text?.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  const { setOpen } = useSidebar();
  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="default"
                className="h-9 group-data-[collapsible=icon]:size-9! md:p-0"
                render={<Link href="/" />}
              >
                {data.brand && data.brand.logo ? (
                  <>
                    <div className="flex aspect-square size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                      <img
                        src={data.brand.logo}
                        width={36}
                        height={36}
                        className="size-9"
                        alt={data.brand.name}
                      />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      {data.brand.plan ? (
                        <>
                          <span className="truncate font-medium">
                            {data.brand.name}
                          </span>
                          <span className="truncate text-xs">
                            {data.brand.plan}
                          </span>
                        </>
                      ) : (
                        <span className="truncate font-medium text-xl">
                          {data.brand.name}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex aspect-square size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                      <Command className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {data.brand?.name ?? "Gorth"}
                      </span>
                      <span className="truncate text-xs">
                        {data.brand?.plan}
                      </span>
                    </div>
                  </>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        setActiveItem(item);
                        setOpen(true);
                      }}
                      isActive={activeItem?.title === item.title}
                      className="h-9 group-data-[collapsible=icon]:size-9! px-2.5"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {data.user && auth && (
            <NavUser
              user={data.user}
              type="sidebar"
              side="right"
              size="icon"
              auth={auth}
              nav={{
                main: data.navDropdown ?? [],
                secondary: data.navSignal ?? [],
              }}
            />
          )}
        </SidebarFooter>
      </Sidebar>
      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">
              {activeItem?.title}
            </div>
            <Label className="flex items-center gap-2 text-sm">
              <span>Unreads</span>
              <Switch
                className="shadow-none"
                checked={unreadOnly}
                onCheckedChange={setUnreadOnly}
              />
            </Label>
          </div>
          <SidebarInput
            className="h-9"
            placeholder="Type to search..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              {messages.map((mail) => (
                <Link
                  href={
                    mail.url ?? `/message/${encodeURIComponent(mail.email)}`
                  }
                  key={mail.email}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    activeMessageId === mail.email &&
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                >
                  <div className="flex w-full items-center gap-2">
                    <span>{mail.name}</span>{" "}
                    <span className="ml-auto text-xs">{mail.date}</span>
                  </div>
                  <span className="font-medium">{mail.subject}</span>
                  <span className="line-clamp-2 w-full text-xs whitespace-break-spaces">
                    {mail.teaser}
                  </span>
                </Link>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  );
}
