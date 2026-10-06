import { AsyncLocalStorage } from "node:async_hooks";

export const transferProgress = new AsyncLocalStorage<
  (bytes: number) => void
>();
