import { PageShell } from "@/layouts/page-shell";
import { PageBanner } from "@/components/element/page-banner";
import accountsBackground from "@/assets/dawn/accounts.png";
import { useForm } from "@tanstack/react-form";
import {
  Check,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { useAuth } from "@/hooks/use-auth";
const names = { offline: "Offline", ely: "Ely.by", gorth: "Gorth" };
export function AccountsPage({
  auth,
  busy,
  error,
  run,
}: ReturnType<typeof useAuth>) {
  const offlineForm = useForm({
    defaultValues: { username: "" },
    onSubmit: async ({ value }) => {
      if (await run({ action: "offline.add", username: value.username }))
        offlineForm.reset();
    },
  });
  if (!auth) return <p role="status">{error || "Đang đọc tài khoản…"}</p>;
  return (
    <div className="space-y-4" data-page-url="gorth://settings/profile">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {auth.locked && (
        <Card>
          <CardHeader>
            <CardTitle>Phiên đã lưu</CardTitle>
            <CardDescription>
              Mở phiên đã lưu khi bạn muốn sử dụng tài khoản. macOS có thể yêu
              cầu cấp quyền Keychain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={busy}
              onClick={() => void run({ action: "launcher.unlock" })}
            >
              Mở khóa phiên Gorth
            </Button>
          </CardContent>
        </Card>
      )}
      {auth.pending && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p role="status" className="flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              Đang xác thực Gorth trong cửa sổ này…
            </p>
            <Button
              className="h-9"
              variant="outline"
              onClick={() => void run({ action: "cancel" })}
            >
              Hủy đăng nhập
            </Button>
          </CardContent>
        </Card>
      )}
      <PageBanner
        title="Accounts"
        description="Quản lý tài khoản Gorth launcher và hồ sơ game Offline/Ely.by/Gorth."
        image={accountsBackground}
      />
      <PageShell
        aside={
          <>
            {" "}
            <Card>
              <CardHeader>
                <CardTitle>Tài khoản launcher</CardTitle>
                <CardDescription>
                  Gorth là phương thức đăng nhập duy nhất cho launcher. Tài
                  khoản game được quản lý riêng.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {auth.launcher ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{auth.launcher.name}</p>
                      {auth.launcher.email && (
                        <p className="text-sm text-muted-foreground">
                          {auth.launcher.email}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {auth.launcher.needsLogin
                          ? "Phiên hết hạn — làm mới hoặc đăng nhập lại"
                          : "Đã đăng nhập Gorth"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="h-9"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void run({ action: "launcher.refresh" })}
                      >
                        <RefreshCw />
                        Làm mới
                      </Button>
                      <Button
                        className="h-9"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void run({ action: "launcher.logout" })}
                      >
                        <LogOut />
                        Đăng xuất launcher
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Bạn chưa đăng nhập launcher. Hồ sơ Offline vẫn có thể được
                    tạo trên thiết bị.
                  </p>
                )}
                <Button
                  className="h-9"
                  disabled={busy || !auth.providers.gorthLauncher}
                  onClick={() => void run({ action: "launcher.login" })}
                >
                  <LogIn />
                  {auth.launcher ? "Đổi tài khoản Gorth" : "Đăng nhập Gorth"}
                </Button>
                {!auth.launcher && (
                  <Button
                    className="h-9"
                    variant="outline"
                    disabled={busy || !auth.providers.gorthLauncher}
                    onClick={() => void run({ action: "launcher.register" })}
                  >
                    Đăng ký Gorth
                  </Button>
                )}
                {!auth.providers.gorthLauncher && (
                  <p className="text-xs text-muted-foreground">
                    Đăng nhập Gorth chưa được cấu hình cho bản launcher này.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Đăng xuất xóa phiên trên thiết bị và thu hồi token của
                  launcher, không xóa tài khoản game hoặc phiên SSO trong trình
                  duyệt.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Offline</CardTitle>
                <CardDescription>
                  Chơi đơn hoặc trên server cho phép tài khoản Offline.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void offlineForm.handleSubmit();
                  }}
                  className="flex items-end gap-3"
                >
                  <label className="flex-1 space-y-2 text-sm">
                    Tên Minecraft
                    <offlineForm.Field name="username">
                      {(field) => (
                        <Input
                          className="h-9"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          minLength={3}
                          maxLength={16}
                          pattern="[A-Za-z0-9_]{3,16}"
                          required
                          placeholder="Player"
                        />
                      )}
                    </offlineForm.Field>
                  </label>
                  <Button type="submit" className="h-9" disabled={busy}>
                    Thêm Offline
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Tài khoản game</CardTitle>
            <CardDescription>
              Tài khoản được chọn sẽ dùng khi nhấn Chơi Minecraft trong thư
              viện.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            {!auth.accounts.length && (
              <p className="py-4 text-sm text-muted-foreground">
                Chưa có tài khoản game. Thêm hồ sơ Offline bên dưới.
              </p>
            )}
            {auth.accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <UserRound className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {account.username}{" "}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {names[account.provider]}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.needsLogin
                        ? "Cần làm mới phiên hoặc đăng nhập lại"
                        : account.provider === "offline"
                          ? "Hồ sơ cục bộ · không xác thực online"
                          : "Đã kết nối"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="h-9"
                    variant={
                      auth.selectedAccountId === account.id
                        ? "secondary"
                        : "outline"
                    }
                    disabled={busy || auth.selectedAccountId === account.id}
                    onClick={() =>
                      void run({ action: "game.select", id: account.id })
                    }
                  >
                    {auth.selectedAccountId === account.id && <Check />}
                    {auth.selectedAccountId === account.id
                      ? "Đang chọn"
                      : "Sử dụng"}
                  </Button>
                  {account.provider !== "offline" && (
                    <Button
                      className="h-9"
                      variant="outline"
                      size="icon"
                      aria-label={"Làm mới " + account.username}
                      disabled={busy}
                      onClick={() =>
                        void run({ action: "game.refresh", id: account.id })
                      }
                    >
                      <RefreshCw />
                    </Button>
                  )}
                  <Button
                    className="h-9"
                    variant="ghost"
                    size="icon"
                    aria-label={"Xóa " + account.username}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Xóa tài khoản game " +
                            account.username +
                            " khỏi thiết bị?",
                        )
                      )
                        void run({ action: "game.remove", id: account.id });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageShell>
    </div>
  );
}
