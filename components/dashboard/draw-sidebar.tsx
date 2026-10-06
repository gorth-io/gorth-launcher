"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "cn";
import type { AppSidebarProps } from "@/components/dashboard/interface";

export function DrawSidebar({
  data,
  auth,
  className,
  ...props
}: AppSidebarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const trigger = (
    <SidebarTrigger
      className="size-9 rounded-md"
      aria-label="Open sidebar navigation"
    />
  );
  const sidebar = (
    <AppSidebar
      data={data}
      auth={auth}
      {...props}
      collapsible="none"
      className={cn("h-full w-full", className)}
    />
  );

  return (
    <SidebarProvider defaultOpen={false} className="contents min-h-0 w-auto">
      {isMobile ? (
        <Drawer modal open={open} onOpenChange={setOpen} swipeDirection="left">
          <DrawerTrigger render={trigger} />
          <DrawerContent className="h-svh w-64 gap-0">
            <DrawerTitle className="sr-only">Navigation</DrawerTitle>
            {sidebar}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={trigger} />
          <SheetContent
            side="left"
            showCloseButton={false}
            className="h-svh gap-0"
            style={{ width: "16rem" }}
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
      )}
    </SidebarProvider>
  );
}
