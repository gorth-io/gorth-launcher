import { PortalPanel } from "@/providers/portal";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PopoverMenuProps {
  ariaLabel: string;
  children: (close: () => void) => ReactNode;
  className?: string;
  contentClassName?: string;
  icon: ReactNode;
  label?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  title?: string;
}

interface PopoverMenuItemProps extends ComponentProps<typeof Button> {
  destructive?: boolean;
}

function PopoverMenu({
  ariaLabel,
  children,
  className,
  contentClassName,
  icon,
  label,
  onOpenChange,
  title,
}: PopoverMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChangeRef.current?.(nextOpen);
  };

  useEffect(
    () => () => {
      onOpenChangeRef.current?.(false);
    },
    [],
  );

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-9 items-center justify-center gap-2 rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
        onClick={() => updateOpen(!open)}
        size="sm"
        title={title}
        variant="ghost"
      >
        {icon}
        {label}
      </Button>

      {open && (
        <PortalPanel
          anchor={
            containerRef.current?.getBoundingClientRect() ?? {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
            }
          }
          onClose={() => updateOpen(false)}
          className={contentClassName}
        >
          {children(() => updateOpen(false))}
        </PortalPanel>
      )}
    </div>
  );
}

function PopoverMenuItem({
  children,
  className,
  destructive,
  ...props
}: PopoverMenuItemProps) {
  return (
    <Button
      className={cn(
        "flex h-9 shrink-0 w-full min-w-0 max-w-full items-center justify-start gap-2 overflow-hidden rounded-sm px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        destructive && "text-destructive hover:bg-destructive/10",
        className,
      )}
      role="menuitem"
      size="sm"
      variant="ghost"
      {...props}
    >
      {children}
    </Button>
  );
}

function PopoverMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}

function PopoverMenuSeparator() {
  return <div className="-mx-1 my-1 h-px bg-border" role="separator" />;
}

export { PopoverMenu, PopoverMenuItem, PopoverMenuLabel, PopoverMenuSeparator };
