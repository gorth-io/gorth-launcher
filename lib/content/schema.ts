import { z } from "zod";
import { loaderCatalog, supportedVanillaVersion } from "@/lib/game/catalog";
export const contentId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const querySchema = z
  .object({
    provider: z.enum(["modrinth", "curseforge"]),
    kind: z.enum(["mod", "modpack", "shader", "resourcepack", "datapack"]),
    query: z.string().trim().max(100),
    version: z.string().max(60),
    loader: z.enum(["Vanilla", "Fabric", "Forge", "NeoForge"]),
    offset: z.number().int().min(0).max(9900),
  })
  .refine(
    (value) =>
      (["shader", "resourcepack", "datapack"].includes(value.kind) &&
        supportedVanillaVersion(value.version)) ||
      loaderCatalog.some(
        (entry) =>
          entry.loader === value.loader && entry.minecraft === value.version,
      ),
    "Hãy chọn Minecraft/loader trong danh sách hỗ trợ.",
  );
export const installSchema = z.object({
  query: querySchema,
  projectId: contentId,
  versionId: contentId,
  instanceId: z
    .string()
    .regex(/^[a-zA-Z0-9-]{1,80}$/)
    .optional(),
  worldName: z.string().min(1).max(255).optional(),
});
export const versionsSchema = z.object({
  query: querySchema,
  projectId: contentId,
});
export const inventorySchema = z.object({
  instanceId: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
});
export const manageSchema = inventorySchema.extend({
  action: z.enum(["enable", "disable", "remove", "update"]),
  id: z.string().min(1).max(500),
});
