import { fetcher } from "@/lib/utils/fetcher";
import type { UserProfileCache } from "@/lib/server/interface";

// Main-process API request: the capability never crosses into the renderer.
export async function getAccountProfile(origin: string, capability: string) {
  const response = await fetcher<{ profile: UserProfileCache }>({
    method: "GET",
    timeout: 20_000,
    redirect: "error",
    url: "/user/profile",
    baseURL: origin,
    headers: { "x-gorth-desktop-session": capability },
    validateStatus: (status) =>
      (status >= 200 && status < 300) || status === 401,
  });
  return response.status === 401 ? null : response.data.profile;
}
