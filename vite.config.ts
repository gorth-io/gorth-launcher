import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createDesktopDevServer } from "./lib/server/vite.ts";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root,
  publicDir: false,
  build: {
    rolldownOptions: { input: path.resolve(root, "assets/index.html") },
  },
  server: createDesktopDevServer(root, 5502),
  resolve: {
    alias: {
      "@": root,
    },
  },
});
