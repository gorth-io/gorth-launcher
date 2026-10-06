import {
  Box,
  Bell,
  Camera,
  Package,
  Sparkles,
  Terminal,
  WandSparkles,
  Download,
  Home,
  Layers,
  Database,
  Keyboard,
  Settings2,
  UserRound,
} from "lucide-react";
import type { Page } from "@/lib/utils/interface";

export const navigation = [
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "home", label: "Tổng quan", icon: Home },
  { id: "library", label: "Thư viện", icon: Layers },
  { id: "instance-data", label: "Dữ liệu instance", icon: Database },
  { id: "content", label: "Mod & modpack", icon: Box },
  { id: "mods", label: "Mods", icon: Package },
  { id: "modpacks", label: "Modpacks", icon: Layers },
  { id: "resourcepacks", label: "Resource Packs", icon: Sparkles },
  { id: "shaders", label: "Shaders", icon: WandSparkles },
  { id: "downloads", label: "Tải xuống", icon: Download },
  { id: "accounts", label: "Tài khoản", icon: UserRound },
  { id: "console", label: "Console", icon: Terminal },
  { id: "gallery", label: "Gallery", icon: Camera },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Cài đặt", icon: Settings2 },
  { id: "settings/instance", label: "Instance Settings", icon: Settings2 },
] as const satisfies ReadonlyArray<{
  id: Page;
  label: string;
  icon: typeof Box;
}>;
