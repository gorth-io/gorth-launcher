import type { ComponentProps, ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Sidebar, SidebarGroup } from "@/components/ui/sidebar";

export interface NavMainItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  badge?: ReactNode;
  items?: { title: string; url: string; icon?: LucideIcon }[];
}
export interface NavCoreProps extends ComponentProps<typeof SidebarGroup> {
  items: NavMainItem[];
}
export interface UserProps {
  name: string;
  email: string;
  avatar?: string;
}
export interface AuthSidebarProps {
  loading: boolean;
  authenticated: boolean;
  login: () => unknown;
  register: () => unknown;
  logout: () => unknown;
}
export interface NavDropdown {
  main: NavMainItem[];
  secondary: NavMainItem[];
}
export interface AppSidebarUserProps {
  user: UserProps;
  nav: NavDropdown;
  auth: AuthSidebarProps;
  type?: "sidebar" | "navbar";
  size?: "icon" | "sm" | "md" | "lg";
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}
export interface ProjectProps {
  name: string;
  url: string;
  icon: LucideIcon;
  onShare?: () => void;
  onDelete?: () => void;
}
export interface TeamProps {
  name: string;
  logo: ComponentType<{ className?: string }>;
  plan: string;
}
export interface SidebarData {
  brand?: {
    name: string;
    logo?: string;
    icon?: LucideIcon;
    url?: string;
    plan?: string;
  };
  teams?: TeamProps[];
  navMain: NavMainItem[];
  navSecondary?: NavMainItem[];
  projects?: ProjectProps[];
  user?: UserProps;
  navDropdown?: NavMainItem[];
  navSignal?: NavMainItem[];
}
export interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  data: SidebarData;
  auth?: AuthSidebarProps;
  pathname: string;
  onNavigate: (url: string) => void;
  onClose?: () => void;
  empty?: ReactNode;
}
export interface NavMessage {
  name: string;
  email: string;
  subject?: string;
  teaser?: string;
  date: string;
  url?: string;
  unread?: boolean;
}
export interface MessSidebarProps extends AppSidebarProps {
  data: SidebarData & { navMessage: NavMessage[] };
  activeMessageId?: string;
}
