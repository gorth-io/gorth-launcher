import type { Context } from "hono";
import { receiveAuthCallback as receiveAuthCallbackServices } from "@/services/auth-callback";

export function receiveAuthCallback(c: Context) {
  const accepted = receiveAuthCallbackServices(c.req.url);
  return c.text(
    accepted
      ? "Đã nhận phản hồi xác thực. Bạn có thể trở lại ứng dụng."
      : "Phản hồi xác thực không hợp lệ hoặc đã hết hạn.",
    accepted ? 200 : 400,
  );
}
