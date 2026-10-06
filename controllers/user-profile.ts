import type { Context } from "hono";
import { getUserProfile as getUserProfileServices } from "@/services/user-profile";

export function getUserProfile(c: Context, identityId: string | null) {
  if (!identityId) return c.json({ error: "unauthenticated" }, 401);
  const profile = getUserProfileServices(identityId);
  return profile
    ? c.json({ profile })
    : c.json({ error: "profile_not_found" }, 404);
}
