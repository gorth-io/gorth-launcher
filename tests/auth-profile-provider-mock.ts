import type { UserProfileIdentity } from "@/lib/server/interface";
const tokens = {
  accessToken: "PRIVATE-ACCESS",
  refreshToken: "PRIVATE-REFRESH",
  expiresAt: Date.now() + 3600_000,
  binding: "test-binding",
};
export const gorthBinding = () => "test-binding";
export async function loginGorth() {
  return {
    id: "verified-subject",
    name: "Before",
    email: "before@example.test",
    tokens,
  };
}
export async function refreshGorth(session: UserProfileIdentity) {
  return {
    ...session,
    name: "After",
    email: "after@example.test",
    username: "changed",
    image: "https://example.test/avatar.png",
    emailVerified: true,
    tokens: { ...tokens, accessToken: "PRIVATE-ROTATED" },
  };
}
export async function revokeGorth() {}
