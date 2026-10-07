import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type RouteComponent,
} from "@tanstack/react-router";
import type { Page } from "@/lib/utils/interface";

const launcherPages = [
  "home",
  "library",
  "downloads",
  "accounts",
  "settings",
  "settings/help",
  "content",
  "instance-data",
  "shortcuts",
  "mods",
  "modpacks",
  "resourcepacks",
  "shaders",
  "console",
  "gallery",
  "notifications",
  "settings/instance",
] as const satisfies readonly Page[];

function createLauncherRouter(component: RouteComponent) {
  const root = createRootRoute({ component });
  const routes = launcherPages.map((page) =>
    createRoute({ getParentRoute: () => root, path: "/" + page }),
  );
  return createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/home"] }),
    defaultPendingMinMs: 0,
  });
}
export { createLauncherRouter, launcherPages };
