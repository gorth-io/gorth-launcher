import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { getUserProfile } from "@/controllers/user-profile";

export function createUserProfileRoutes(
  getIdentityId: () => string | null,
  requireDesktop: () => MiddlewareHandler,
) {
  const routes = new Hono();
  // A cached profile is never authentication. Resolve the ID from the live vault session.
  routes.get("/profile", requireDesktop(), (c) =>
    getUserProfile(c, getIdentityId()),
  );
  return routes;
}
