import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PortalProvider } from "@/providers/portal";
import { MenuPortal } from "@/providers/menu";
import { TooltipProvider } from "@/providers/tooltip";
import { ToasterProvider } from "@/providers/toaster";
import Application from "@/app";
import "@/styles/globals.css";
const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <StrictMode>
    <PortalProvider>
      <TooltipProvider>
        <ToasterProvider>
          <Application />
          <MenuPortal />
        </ToasterProvider>
      </TooltipProvider>
    </PortalProvider>
  </StrictMode>,
);
