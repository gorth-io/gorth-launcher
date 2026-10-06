import { createContext, useContext } from "react";
import type { useAuthController } from "@/hooks/use-auth-controller";
export const AuthContext = createContext<ReturnType<
  typeof useAuthController
> | null>(null);
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
