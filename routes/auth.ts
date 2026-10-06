import { Hono } from "hono";
import { receiveAuthCallback } from "@/controllers/auth";

export function createAuthRoutes() {
  const routes = new Hono();
  routes.get("/callback", receiveAuthCallback);
  return routes;
}
