import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createDesktopRoutes } from "@/routes";
import { registerAuthCallback } from "@/services/auth-callback";
import { upsertUserProfile, getUserProfile } from "@/services/user-profile";

test("SQLite profiles use SSO identity, refresh mutable fields, retain creation time and never store tokens", () => {
  const filename = path.join(
    mkdtempSync(path.join(tmpdir(), "gorth-profile-test-")),
    "profile.sqlite",
  );
  const db = new DatabaseSync(filename);
  db.exec(
    "CREATE TABLE existing_data (value TEXT); INSERT INTO existing_data VALUES ('preserved')",
  );
  db.close();
  upsertUserProfile(
    {
      id: "subject-1",
      name: "Before",
      email: "before@example.test",
      emailVerified: false,
    },
    filename,
  );
  const before = getUserProfile("subject-1", filename)!;
  const identity = {
    id: "subject-1",
    name: "After",
    email: "after@example.test",
    username: "changed",
    image: "https://example.test/avatar.png",
    emailVerified: true,
    tokens: { accessToken: "PRIVATE-TOKEN" },
  };
  upsertUserProfile(identity, filename);
  const after = getUserProfile("subject-1", filename)!;
  assert.equal(after.name, "After");
  assert.equal(after.email, "after@example.test");
  assert.equal(after.username, "changed");
  assert.equal(after.emailVerified, true);
  assert.equal(after.createdAt, before.createdAt);
  assert(after.syncedAt >= before.syncedAt);
  assert(!JSON.stringify(after).includes("PRIVATE-TOKEN"));
  upsertUserProfile(
    { id: "subject-2", name: "Other", email: "after@example.test" },
    filename,
  );
  assert.equal(getUserProfile("subject-2", filename)?.ssoUserId, "subject-2");
  const check = new DatabaseSync(filename);
  assert.equal(
    check.prepare("SELECT COUNT(*) AS total FROM user_profiles").get()?.total,
    2,
  );
  assert.equal(
    check.prepare("SELECT value FROM existing_data").get()?.value,
    "preserved",
  );
  assert(
    !check
      .prepare("PRAGMA table_info(user_profiles)")
      .all()
      .some((row) => /token|password|credential/i.test(String(row.name))),
  );
  check.close();
});

test("Hono rejects foreign hosts, cross-origin/profile access and expired callbacks; callback is single-use", async () => {
  const origin = "http://localhost:5500";
  const routes = createDesktopRoutes({
    origin,
    capability: "test-capability",
    getIdentityId: () => null,
  });
  const request = (url: string, headers: Record<string, string> = {}) =>
    routes.request(origin + url, {
      headers: { host: "localhost:5500", ...headers },
    });
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal((await request("/health", { host: "evil.test" })).status, 400);
  assert.equal((await request("/user/profile")).status, 403);
  assert.equal(
    (
      await request("/user/profile", {
        "x-gorth-desktop-session": "test-capability",
        origin: "https://evil.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/user/profile", {
        "x-gorth-desktop-session": "test-capability",
      })
    ).status,
    401,
    "A cached profile cannot authenticate a user",
  );
  assert.equal(
    (await request("/auth/callback?state=missing&code=PRIVATE-CODE")).status,
    400,
  );
  let consumed = false;
  const remove = registerAuthCallback((value) => {
    const url = new URL(value);
    if (consumed || url.searchParams.get("state") !== "expected") return false;
    consumed = true;
    return true;
  });
  try {
    assert.equal(
      (await request("/auth/callback?state=wrong&code=PRIVATE-CODE")).status,
      400,
    );
    const accepted = await request(
      "/auth/callback?state=expected&code=PRIVATE-CODE",
    );
    assert.equal(accepted.status, 200);
    assert(!(await accepted.text()).includes("PRIVATE-CODE"));
    assert.equal(
      (await request("/auth/callback?state=expected&code=PRIVATE-CODE")).status,
      400,
    );
  } finally {
    remove();
  }
  assert.equal(
    (await request("/auth/callback?state=expected&code=PRIVATE-CODE")).status,
    400,
  );
});
