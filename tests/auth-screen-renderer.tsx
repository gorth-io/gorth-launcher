import { createRoot } from "react-dom/client";
import { useState } from "react";
import { NavigationBar } from "@/layouts/navigation-bar";
import { useLauncherNavigation } from "@/hooks/use-launcher-navigation";
import { AuthScreen } from "@/components/element/auth-screen";
import type { AuthViewState } from "@/lib/auth/view-types";

declare global {
  interface Window {
    authUiTest: {
      cancelled: number;
      returned: number;
      open: () => void;
      finish: (completed: boolean) => void;
      setLoading: (loading: boolean) => void;
      showNavigation: () => void;
    };
  }
}
let state: AuthViewState = {
  visible: true,
  mode: "login",
  loading: false,
  verifying: false,
  error: "",
  url: "http://localhost:3000/auth/sign-in",
};
const listeners = new Set<(state: AuthViewState) => void>();
Object.assign(window, {
  electronAPI: {
    auth: {
      onViewChanged: (listener: (value: AuthViewState) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      viewState: async () => state,
      setViewBounds: async () => {},
      setViewVisible: async () => {},
      reloadView: async () => {},
    },
  },
});
const root = createRoot(document.getElementById("root")!);
function NavigationFixture() {
  const navigation = useLauncherNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <>
      <NavigationBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onBack={navigation.back}
        onForward={navigation.forward}
        canGoBack={navigation.canGoBack}
        canGoForward={navigation.canGoForward}
      />
      <output data-current-page>{navigation.page}</output>
      <button data-go-library onClick={() => navigation.navigate("library")}>
        Library
      </button>
      <button data-go-accounts onClick={() => navigation.navigate("accounts")}>
        Accounts
      </button>
      <button data-go-settings onClick={() => navigation.navigate("settings")}>
        Settings
      </button>
    </>
  );
}
function open() {
  state = { ...state, visible: true, completed: false };
  root.render(
    <AuthScreen
      sidebarOpen
      onToggleSidebar={() => {}}
      onReturn={() => {
        window.authUiTest.returned++;
        root.render(<main data-route="gorth://settings/profile">Profile</main>);
      }}
    />,
  );
}
window.authUiTest = {
  cancelled: 0,
  returned: 0,
  open,
  showNavigation: () => root.render(<NavigationFixture />),
  setLoading: (loading) => {
    state = { ...state, loading };
    for (const listener of listeners) listener(state);
  },
  finish: (completed) => {
    state = { ...state, visible: false, completed };
    for (const listener of listeners) listener(state);
  },
};
open();
