import type { ServerOptions } from "vite";
import { getDesktopPipe } from "./pipe.ts";

// Development only: Vite owns the public port; Hono stays in Electron main.
export function createDesktopDevServer(
  root: string,
  port: number,
): ServerOptions {
  return {
    host: "127.0.0.1",
    port,
    strictPort: true,
    proxy: {
      "^/(auth/callback|user/profile|health)([/?]|$)": {
        target: {
          protocol: "http:",
          host: "localhost",
          // Required target metadata; socketPath bypasses TCP (no port 80 listener).
          port: 80,
          socketPath: getDesktopPipe(root).path,
        },
        // Preserve Host for Hono's origin/host validation in Electron main.
        changeOrigin: false,
        configure(proxy) {
          // Vite logs req.url on proxy errors: strip OAuth codes/state before logging.
          proxy.on("error", (_error, request) => {
            request.url = request.url?.split("?")[0];
          });
        },
      },
    },
  };
}
