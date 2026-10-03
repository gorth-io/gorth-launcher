import type { ContentStatus } from "./interface";
let controller: AbortController | null = null;
let status: ContentStatus = {
  busy: false,
  message: "",
  completed: 0,
  total: 0,
};
const listeners = new Set<(status: ContentStatus) => void>();
export const contentIsBusy = () => controller !== null;
export const contentSnapshot = () => ({ ...status });
export function subscribeContent(listener: (status: ContentStatus) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function updateContent(message: string, completed = 0, total = 0) {
  status = { busy: contentIsBusy(), message, completed, total };
  for (const listener of listeners) listener(contentSnapshot());
}
export function beginContent() {
  if (controller) throw new Error("Đang xử lý mod/modpack. Vui lòng chờ.");
  controller = new AbortController();
  updateContent("Đang chuẩn bị…");
  return controller.signal;
}
export function finishContent(error?: string) {
  controller = null;
  status = {
    ...status,
    busy: false,
    error,
    completed: error ? status.completed : status.total,
    message: error ?? "Đã cài đặt. Mở Thư viện để tải/chạy game.",
  };
  for (const listener of listeners) listener(contentSnapshot());
}
export const cancelContent = () => controller?.abort();
