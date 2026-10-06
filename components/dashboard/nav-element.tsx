import { Bell, Palette, Search, Settings2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
interface NavElementProps {
  onSearch?: () => void;
  onToggleTheme?: () => void;
  onCustomize?: () => void;
  onNotifications?: () => void;
  onUtility?: () => void;
}
export function NavElement(props: NavElementProps) {
  const actions = [
    { title: "Search", icon: Search, action: props.onSearch },
    { title: "Theme", icon: Palette, action: props.onToggleTheme },
    { title: "Customize", icon: Settings2, action: props.onCustomize },
    { title: "Notifications", icon: Bell, action: props.onNotifications },
    { title: "Utilities", icon: Wrench, action: props.onUtility },
  ];
  return (
    <div className="flex items-center gap-2">
      {actions
        .filter((item) => item.action)
        .map((item) => (
          <Button
            key={item.title}
            aria-label={item.title}
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={item.action}
          >
            <item.icon className="size-4" />
          </Button>
        ))}
    </div>
  );
}
