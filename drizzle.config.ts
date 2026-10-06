import { defineConfig } from "drizzle-kit";
import path from "node:path";
import { getDataDirectory } from "./lib/utils/data-directory";

export default defineConfig({
  dialect: "sqlite",
  schema: "./database/schema.ts",
  out: "./database/migrations",
  dbCredentials: {
    url: path.join(getDataDirectory(), "gorth-launcher.db"),
  },
});
