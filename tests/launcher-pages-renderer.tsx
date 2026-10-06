import { createRoot } from "react-dom/client";
import { ToasterProvider } from "@/providers/toaster";
import { HomePage } from "@/pages/home";
import { LibraryPage } from "@/pages/library";
import { AccountsPage } from "@/pages/accounts";
import { ContentPage } from "@/pages/content";
import { ConsolePage } from "@/pages/console";
import { GalleryPage } from "@/pages/gallery";
import { SettingsPage } from "@/pages/settings";
import { InstancePreferencesPage } from "@/pages/settings/instance";
import { NotificationsPage } from "@/pages/notifications";
import { defaultInstanceSettings } from "@/lib/library/instance-settings";
import { defaultSettings } from "@/lib/utils/launcher";
import type { ContentKind } from "@/lib/content/interface";

const instance = {
  id: "demo",
  name: "Survival",
  version: "1.20.1",
  loader: "Vanilla",
  createdAt: 1,
};
const account = {
  id: "offline",
  username: "Player",
  uuid: "offline-uuid",
  provider: "offline" as const,
  expiresAt: null,
  needsLogin: false,
};
const job = {
  instanceId: "demo",
  version: "1.20.1",
  phase: "running" as const,
  message: "Running",
  completed: 1,
  total: 1,
  logs: ["[INFO] Hello", "[ERROR] Test error"],
  speed: 0,
  eta: null,
  queuePosition: null,
};
const game = {
  directory: "/test/minecraft",
  jobs: [job],
  activeId: "demo",
  activeIds: ["demo"],
  downloadingId: null,
  queue: [],
  history: [],
};
const calls: string[] = [];
const errors: string[] = [];
const root = createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) => errors.push(String(error)),
});
const snapshot = {
  instanceId: "demo",
  worlds: [],
  screenshots: [{ name: "test.png", size: 68, modifiedAt: 1 }],
  servers: [],
  notes: "",
  logs: [],
};
const noop = () => {};
Object.assign(window, {
  electronAPI: {
    instanceData: {
      snapshot: async () => ({ ok: true, data: snapshot }),
      command: async (input: { action: string }) => {
        calls.push(input.action);
        return {
          ok: true,
          data: {
            snapshot,
            content:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ8AAAAASUVORK5CYII=",
          },
        };
      },
    },
    content: {
      onChanged: () => noop,
      status: async () => ({
        status: { busy: false, message: "", completed: 0, total: 0 },
        curseforgeConfigured: true,
      }),
      inventory: async () => ({ ok: true, data: { items: [] } }),
    },
  },
  pagesTest: {
    calls,
    errors,
    setLogs(lines: string[]) {
      job.logs = lines;
      (
        window as unknown as { pagesTest: { render: (page: string) => void } }
      ).pagesTest.render("console");
    },
    render(page: string, empty = false) {
      const instances = empty ? [] : [instance];
      const props = {
        instances,
        onSelect: () => calls.push("select"),
        statusLabel: () => "Running",
        onCreate: () => calls.push("create"),
      };
      const gameProps = {
        game: empty ? { ...game, jobs: [], activeIds: [] } : game,
        instances,
        versions: [],
        ready: true,
        error: "",
        clearError: noop,
        run: async (input: { action: string }) => {
          calls.push(input.action);
          return true;
        },
        openDirectory: async () => {
          calls.push("folder");
        },
        exportLog: async () => {
          calls.push("export");
          return true;
        },
      };
      const views = {
        home: (
          <HomePage
            {...props}
            game={gameProps.game}
            versions={empty ? [] : [{ id: "1.20.1", type: "release" }]}
            onVersionCreate={() => calls.push("create-version")}
            accounts={empty ? [] : [account]}
            accountId={empty ? null : account.id}
            info={null}
            onOpenLibrary={noop}
            onPlay={() => calls.push("play")}
            onStop={() => calls.push("stop")}
            onAccount={noop}
          />
        ),
        library: (
          <LibraryPage
            {...props}
            query=""
            filter="all"
            onQueryChange={noop}
            onFilterChange={noop}
          />
        ),
        accounts: (
          <AccountsPage
            auth={{
              launcher: null,
              accounts: empty ? [] : [account],
              selectedAccountId: account.id,
              pending: null,
              providers: { gorthLauncher: true, ely: false, gorthGame: false },
            }}
            busy={false}
            error=""
            ready={true}
            view={null}
            run={async (input) => {
              calls.push(input.action);
              return true;
            }}
            cancel={async () => {}}
          />
        ),
        console: <ConsolePage {...gameProps} />,
        gallery: (
          <GalleryPage
            instances={instances}
            onOpenDirectory={gameProps.openDirectory}
          />
        ),
        settings: (
          <SettingsPage
            settings={defaultSettings}
            setSettings={noop}
            theme="dark"
            setTheme={noop}
            info={null}
            setNotice={noop}
          />
        ),
        instance: (
          <InstancePreferencesPage
            instances={instances}
            settings={{ demo: defaultInstanceSettings(defaultSettings) }}
            accounts={[account]}
            busy={false}
            onSave={async () => {
              calls.push("save");
              return true;
            }}
            onEdit={noop}
          />
        ),
        notifications: (
          <NotificationsPage
            items={
              empty
                ? []
                : [
                    {
                      id: "one",
                      title: "Launcher",
                      body: "Installed",
                      time: 1,
                      read: false,
                    },
                  ]
            }
            unread={empty ? 0 : 1}
            markRead={() => calls.push("read")}
            dismiss={noop}
            clear={() => calls.push("clear")}
          />
        ),
      };
      const kinds: Record<string, ContentKind> = {
        mods: "mod",
        modpacks: "modpack",
        shaders: "shader",
        resourcepacks: "resourcepack",
      };
      root.render(
        <ToasterProvider>
          <div key={page + String(empty)} data-test-page={page}>
            {kinds[page] ? (
              <ContentPage
                instances={instances}
                fixedKind={kinds[page]}
                gameBusy={false}
                onLibrary={noop}
                hideWebview={false}
                onDetailChange={noop}
              />
            ) : (
              views[page as keyof typeof views]
            )}
          </div>
        </ToasterProvider>,
      );
    },
  },
});
