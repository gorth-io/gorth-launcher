import { GamePhase } from "@/lib/utils/interface";

export const gamePhaseLabels: Record<GamePhase, string> = {
  idle: "Chưa cài đặt",
  queued: "Trong hàng đợi",
  paused: "Đã tạm dừng",
  checking: "Đang kiểm tra",
  downloading: "Đang tải",
  ready: "Đã cài đặt",
  starting: "Đang khởi chạy",
  running: "Đang chơi",
  stopping: "Đang dừng",
  cancelled: "Đã hủy",
  crashed: "Đã crash",
  error: "Có lỗi",
};
