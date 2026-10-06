import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import type { DesktopServerOptions } from "@/lib/server/interface";
import { createAuthRoutes } from "@/routes/auth";
import { createUserProfileRoutes } from "@/routes/user-profile";

export function createDesktopRoutes(options: DesktopServerOptions) {
  const routes = new Hono();
  const origin = new URL(options.origin);
  routes.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Content-Type-Options", "nosniff");
    // Do not log request URLs: OAuth callbacks contain one-time authorization codes.
    if (c.req.header("host") !== origin.host)
      return c.text("Invalid host.", 400);
    await next();
  });
  routes.onError(
    () =>
      new Response("Desktop service unavailable.", {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }),
  );
  routes.get("/health", (c) => c.json({ status: "ok" }));
  routes.route("/auth", createAuthRoutes());
  const requireDesktop = () => {
    return async (c: import("hono").Context, next: import("hono").Next) => {
      const supplied = Buffer.from(
        c.req.header("x-gorth-desktop-session") ?? "",
      );
      const expected = Buffer.from(options.capability);
      if (
        !expected.length ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        return c.json({ error: "forbidden" }, 403);
      const requestOrigin = c.req.header("origin");
      if (
        (requestOrigin && requestOrigin !== origin.origin) ||
        c.req.header("sec-fetch-site") === "cross-site"
      )
        return c.json({ error: "forbidden" }, 403);
      await next();
    };
  };
  routes.route(
    "/user",
    createUserProfileRoutes(options.getIdentityId, requireDesktop),
  );
  return routes;
}
