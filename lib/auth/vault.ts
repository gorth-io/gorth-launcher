import { app, safeStorage } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emptyAuthData } from "./model";
import type { AuthData } from "@/lib/utils/interface";
import { z } from "zod";

const tokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.number().finite(),
  binding: z.string().min(1),
});
const authSchema = z.object({
  version: z.literal(1),
  launcher: z
    .object({
      id: z.string().min(1),
      name: z.string(),
      email: z.string().optional(),
      username: z.string().optional(),
      tokens: tokensSchema,
    })
    .nullable(),
  accounts: z.array(
    z.object({
      id: z.string().min(1),
      provider: z.enum(["offline", "ely", "gorth"]),
      username: z.string(),
      uuid: z.string(),
      tokens: tokensSchema.optional(),
      clientToken: z.string().optional(),
    }),
  ),
  selectedAccountId: z.string().nullable(),
});
function file() {
  return path.join(app.getPath("userData"), "auth.v1.enc");
}
export function vaultExists() {
  return existsSync(file());
}
function ensureEncryption() {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  )
    throw new Error(
      "Kho khóa hệ điều hành chưa sẵn sàng. Không lưu token dạng văn bản.",
    );
}
export async function readVault(): Promise<AuthData> {
  let bytes: Buffer;
  try {
    bytes = await readFile(file());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return emptyAuthData();
    throw error;
  }
  ensureEncryption();
  const data = JSON.parse(safeStorage.decryptString(bytes));
  if (!authSchema.safeParse(data).success)
    throw new Error("Kho tài khoản không hợp lệ; dữ liệu được giữ nguyên.");
  return data as AuthData;
}
export async function writeVault(data: AuthData) {
  authSchema.parse(data);
  ensureEncryption();
  await mkdir(app.getPath("userData"), { recursive: true });
  const temp = file() + "." + randomUUID() + ".tmp";
  await writeFile(temp, safeStorage.encryptString(JSON.stringify(data)), {
    mode: 0o600,
  });
  await rename(temp, file());
}
