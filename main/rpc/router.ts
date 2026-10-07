import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type {
  LibraryResult,
  LibrarySnapshot,
  Settings,
} from "@/lib/utils/interface";
import { settingsSchema } from "@/lib/library/settings-schema";
export interface DesktopContext {
  snapshot: () => LibrarySnapshot;
  settings: (settings: Settings) => Promise<LibraryResult>;
}
const t = initTRPC.context<DesktopContext>().create({
  errorFormatter: ({ shape }) => ({
    ...shape,
    message:
      shape.data.code === "INTERNAL_SERVER_ERROR"
        ? "Desktop operation failed."
        : shape.message,
    data: { ...shape.data, stack: undefined },
  }),
});
export const desktopRouter = t.router({
  library: t.router({
    snapshot: t.procedure.input(z.void()).query(({ ctx }) => ctx.snapshot()),
    settings: t.procedure
      .input(settingsSchema)
      .mutation(({ ctx, input }) => ctx.settings(input)),
  }),
});
export type DesktopRouter = typeof desktopRouter;
