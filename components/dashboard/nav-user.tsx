import { ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { DashboardMenu, DashboardMenuItem } from "@/components/dashboard/menu";
import { useDashboardNavigation } from "@/components/dashboard/navigation";
import type {
  AppSidebarUserProps,
  AuthSidebarProps,
  NavDropdown,
  UserProps,
  NavMainItem,
} from "@/components/dashboard/interface";

export function NavAvatar({ user }: { user: UserProps }) {
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "G";
  return (
    <Avatar>
      <AvatarImage src={user.avatar || undefined} alt={user.name} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
export function NavName({ user }: { user: UserProps }) {
  return (
    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-xs">{user.email}</span>
    </div>
  );
}
export function NavUserDropdown({
  user,
  nav,
  auth,
  close,
}: {
  user: UserProps;
  nav: NavDropdown;
  auth: AuthSidebarProps;
  close: () => void;
}) {
  const { onNavigate } = useDashboardNavigation();
  const select = (item: NavMainItem) => {
    close();
    if (!auth.authenticated && item.url.endsWith("/sign-in")) auth.login();
    else if (!auth.authenticated && item.url.endsWith("/sign-up"))
      auth.register();
    else onNavigate(item.url);
  };
  return (
    <>
      <div className="flex items-center gap-2 p-2">
        <NavAvatar user={user} />
        <NavName user={user} />
      </div>
      <Separator className="my-1" />
      {(auth.authenticated ? nav.main : nav.secondary).map((item) => (
        <DashboardMenuItem
          key={item.url}
          disabled={auth.loading}
          onClick={() => select(item)}
        >
          <item.icon />
          <span className="truncate">{item.title}</span>
        </DashboardMenuItem>
      ))}
      {auth.authenticated && (
        <>
          <Separator className="my-1" />
          <DashboardMenuItem
            disabled={auth.loading}
            onClick={() => {
              close();
              auth.logout();
            }}
          >
            <LogOut />
            Sign out
          </DashboardMenuItem>
        </>
      )}
    </>
  );
}
export function NavUser({
  user,
  nav,
  auth,
  type = "sidebar",
  size = "icon",
  align = "end",
}: AppSidebarUserProps) {
  const content = (
    <>
      <NavAvatar user={user} />
      {size !== "icon" && (
        <>
          <NavName user={user} />
          <ChevronsUpDown className="ml-auto size-4" />
        </>
      )}
    </>
  );
  const menu = (
    <DashboardMenu
      label="Account menu"
      align={align === "start" ? "start" : "end"}
      trigger={
        type === "navbar" ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={auth.loading}
          >
            {content}
          </Button>
        ) : (
          <SidebarMenuButton
            size={size === "lg" ? "lg" : "default"}
            className={
              size === "lg"
                ? "h-14 group-data-[collapsible=icon]:h-14!"
                : "h-9 group-data-[collapsible=icon]:size-9!"
            }
            disabled={auth.loading}
          >
            {content}
          </SidebarMenuButton>
        )
      }
    >
      {(close) => (
        <NavUserDropdown user={user} nav={nav} auth={auth} close={close} />
      )}
    </DashboardMenu>
  );
  return type === "navbar" ? (
    menu
  ) : (
    <SidebarMenu>
      <SidebarMenuItem>{menu}</SidebarMenuItem>
    </SidebarMenu>
  );
}
