import { useAuth } from "@/hooks/use-auth";
export function useUser() {
  const auth = useAuth();
  return {
    user: auth.account,
    username: auth.username,
    raw: auth.account,
    isLoggedIn: auth.authenticated,
    isLoading: auth.loading,
    loading: auth.loading,
    locked: auth.locked,
    error: auth.error,
    refresh: auth.refresh,
  };
}
export function useAccount() {
  return useAuth().account;
}
