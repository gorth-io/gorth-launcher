import { useState } from "react";
import { RouterProvider } from "@tanstack/react-router";
import Application from "@/app";
import { createLauncherRouter } from "@/lib/navigation";

function LauncherRouter() {
  const [router] = useState(() => createLauncherRouter(Application));
  return <RouterProvider router={router} />;
}
export { LauncherRouter };
