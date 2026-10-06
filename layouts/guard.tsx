import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}
// Opt-in UI guard. Privileged operations still validate identity in main.
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const auth = useAuth();
  if (auth.loading) return <p role="status">Đang đọc phiên Gorth…</p>;
  if (auth.authenticated) return children;
  return (
    fallback ?? (
      <div className="space-y-3">
        <p>Đăng nhập Gorth để sử dụng tính năng này.</p>
        {auth.error && (
          <p role="alert" className="text-sm text-destructive">
            {auth.error}
          </p>
        )}
        <div className="flex gap-2">
          {auth.locked && (
            <Button className="h-9" onClick={() => void auth.unlock()}>
              Mở khóa phiên đã lưu
            </Button>
          )}
          <Button className="h-9" onClick={() => void auth.login()}>
            Đăng nhập
          </Button>
          <Button
            className="h-9"
            variant="outline"
            onClick={() => void auth.register()}
          >
            Đăng ký
          </Button>
        </div>
      </div>
    )
  );
}
