import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calls, directory, frame, handlers, sender } from "./electron-auth-mock";
import { registerAuthIpc } from "../lib/auth/service";

test("Startup does not decrypt; denied/corrupt vault retries safely; auth IPC hides tokens and rejects untrusted callers", async () => {
  const filename = path.join(directory, "auth.v1.enc");
  const identity = {
    id: "test-user", name: "Test User", email: "user@example.test",
    tokens: { accessToken: "SECRET-ACCESS", refreshToken: "SECRET-REFRESH", expiresAt: Date.now() + 60_000, binding: "other-config" },
  };
  const encoded = "TEST-ONLY:" + JSON.stringify({ version: 1, launcher: identity, accounts: [], selectedAccountId: null });
  await writeFile(filename, encoded);
  registerAuthIpc();
  const event = { sender, senderFrame: frame };
  const snapshot = () => handlers.get("auth:snapshot")!(event) as import('../lib/utils/interface').AuthResult;
  const command = async (action: string) => await handlers.get("auth:command")!(event, { action }) as import('../lib/utils/interface').AuthResult;
  assert.equal((await snapshot()).snapshot.locked, true);
  assert.equal(calls.decrypt, 0);
  const denied = await command("launcher.unlock");
  assert(denied.error);
  assert.equal(await readFile(filename, "utf8"), encoded);
  calls.available = true;
  await writeFile(filename, 'TEST-ONLY:{"version":1,"accounts":[],"session":42}');
  assert((await command("launcher.unlock")).error);
  await writeFile(filename, encoded);
  const unlocked = await command("launcher.unlock");
  assert(!unlocked.error);
  assert.equal(unlocked.snapshot.launcher?.id, "test-user");
  assert.equal(unlocked.snapshot.locked, false);
  assert(!JSON.stringify(unlocked).includes("SECRET-"));
  assert(!JSON.stringify(calls.snapshots).includes("SECRET-"));
  await assert.rejects(async () => handlers.get("auth:command")!({ sender: {}, senderFrame: frame }, { action: "launcher.unlock" }));
  await assert.rejects(async () => handlers.get("auth:snapshot")!({ sender, senderFrame: {} }));
  assert((await command("ely.login")).error);
  const before = calls.decrypt;
  await snapshot();
  assert.equal(calls.decrypt, before);
  // Missing SSO configuration simulates remote revocation failure. Local logout must still succeed.
  const loggedOut = await command("launcher.logout");
  assert.equal(loggedOut.snapshot.launcher, null);
  assert(!(await readFile(filename, "utf8")).includes("SECRET-"));
});
