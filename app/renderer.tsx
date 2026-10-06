import { StrictMode } from "react";
import { QueryProvider } from "@/providers/query";
import { createRoot } from "react-dom/client";
import { PortalProvider } from "@/providers/portal";
import { MenuPortal } from "@/providers/menu";
import { TooltipProvider } from "@/providers/tooltip";
import { ToasterProvider } from "@/providers/toaster";
import Application from "@/app";
import { AuthProvider } from "@/providers/auth";
import "@/styles/globals.css";
const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <StrictMode>
    <QueryProvider>
      <PortalProvider>
        <TooltipProvider>
          <ToasterProvider>
            <AuthProvider>
              <Application />
              <MenuPortal />
            </AuthProvider>
          </ToasterProvider>
        </TooltipProvider>
      </PortalProvider>
    </QueryProvider>
  </StrictMode>,
);
