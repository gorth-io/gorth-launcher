import type { PropsWithChildren } from "react";
import { AuthContext } from "@/hooks/use-auth";
import { useAuthController } from "@/hooks/use-auth-controller";
export function AuthProvider({ children }: PropsWithChildren) {
  const auth = useAuthController();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
