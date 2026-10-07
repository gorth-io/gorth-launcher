import { z } from "zod";

export const settingsSchema = z.object({
  showTitlebarLogo: z.boolean().default(true),
  memory: z.number().int().min(1).max(64),
  javaPath: z.string().max(4096),
  trashRetentionDays: z.number().int().min(0).max(365).default(30),
  keepSavesOnTrashCleanup: z.boolean().default(true),
});
