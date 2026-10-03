import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root,
  publicDir: false,
  build: {
    rolldownOptions: { input: path.resolve(root, "assets/index.html") },
  },
  server: {
    port: 5502,
    host: true,
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
});
