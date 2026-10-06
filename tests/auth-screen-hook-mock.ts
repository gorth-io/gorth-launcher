// Renderer-only fixture: no real credentials or privileged APIs.
export function useAuth() {
  return {
    authenticated: true,
    error: "",
    account: { name: "UI Test" },
    loading: false,
    cancel: async () => {
      window.authUiTest.cancelled++;
    },
    login: async () => {},
  };
}
