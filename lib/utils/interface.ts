export type Page =
  | "home"
  | "library"
  | "downloads"
  | "accounts"
  | "settings"
  | "settings/help"
  | "content"
  | "instance-data"
  | "shortcuts"
  | "mods"
  | "modpacks"
  | "resourcepacks"
  | "shaders"
  | "console"
  | "gallery"
  | "notifications"
  | "settings/instance";
export type AppMenuAction = Page | "new-instance";

export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: string;
  loaderVersion?: string | null;
  iconData?: string | null;
  group?: string | null;
  createdAt: number;
}

export interface Settings {
  showTitlebarLogo?: boolean;
  memory: number;
  javaPath: string;
  trashRetentionDays?: number;
  keepSavesOnTrashCleanup?: boolean;
}

export interface TrashEntry extends Instance {
  deletedAt: number;
}

export type GpuPreference = "default" | "high-performance" | "integrated";
export interface InstanceSettings {
  memoryMin: number;
  memoryMax: number;
  javaPath: string;
  jvmArguments: string[];
  resolutionWidth: number;
  resolutionHeight: number;
  fullscreen: boolean;
  environment: Record<string, string>;
  accountId: string | null;
  joinServer: string;
  joinWorld: string;
  preLaunchCommand: string;
  postExitCommand: string;
  gpuPreference: GpuPreference;
  openGlPath: string;
  openAlPath: string;
  glfwPath: string;
}

export interface LibrarySnapshot {
  instances: Instance[];
  settings: Settings;
  instanceSettings: Record<string, InstanceSettings>;
  trash: TrashEntry[];
}
export type LibraryCommand =
  | {
      action: "create";
      name: string;
      version: string;
      loader: string;
      loaderVersion?: string | null;
    }
  | { action: "rename" | "copy"; id: string; name: string }
  | { action: "delete" | "restore"; id: string }
  | { action: "metadata"; id: string; group: string | null }
  | {
      action: "runtime";
      id: string;
      version: string;
      loader: string;
      loaderVersion?: string | null;
    }
  | { action: "icon"; id: string; iconData: string | null }
  | { action: "trash.purge"; id: string; keepSaves: boolean }
  | { action: "trash.cleanup" }
  | { action: "orphans.import" }
  | { action: "instance.settings"; id: string; settings: InstanceSettings }
  | { action: "settings"; settings: Settings }
  | { action: "migrate"; instances: Instance[]; settings: Settings };
export interface LibraryResult {
  ok: boolean;
  error?: string;
  snapshot: LibrarySnapshot;
}

// ====================================

export type GameProvider = "offline" | "ely" | "gorth";
export interface AccountView {
  id: string;
  provider: GameProvider;
  username: string;
  uuid: string;
  expiresAt: number | null;
  needsLogin: boolean;
}
export interface LauncherSessionView {
  id: string;
  name: string;
  email?: string;
  username?: string;
  image?: string;
  emailVerified?: boolean;
  expiresAt: number;
  canRefresh?: boolean;
  needsLogin: boolean;
}
export interface AuthSnapshot {
  locked?: boolean;
  launcher: LauncherSessionView | null;
  accounts: AccountView[];
  selectedAccountId: string | null;
  pending: {
    provider: "ely" | "gorth";
    userCode?: string;
    verificationUrl?: string;
    expiresAt: number;
  } | null;
  providers: { gorthLauncher: boolean; ely: boolean; gorthGame: boolean };
}
export type AuthCommand =
  | { action: "offline.add"; username: string }
  | { action: "game.select" | "game.remove" | "game.refresh"; id: string }
  | {
      action:
        | "launcher.login"
        | "launcher.register"
        | "launcher.unlock"
        | "launcher.logout"
        | "launcher.refresh"
        | "ely.login"
        | "cancel";
    }
  | { action: "gorth.game.login"; username: string; password: string };
export interface AuthResult {
  ok: boolean;
  error?: string;
  snapshot: AuthSnapshot;
}

// ====================================

export interface GameVersion {
  id: string;
  type: string;
}
export type GamePhase =
  | "idle"
  | "queued"
  | "paused"
  | "checking"
  | "downloading"
  | "ready"
  | "starting"
  | "running"
  | "stopping"
  | "cancelled"
  | "crashed"
  | "error";
export interface GameStatus {
  instanceId: string;
  version: string;
  phase: GamePhase;
  message: string;
  completed: number;
  total: number;
  logs: string[];
  speed: number;
  eta: number | null;
  queuePosition: number | null;
  crashHint?: string;
}
export interface PlaySession {
  id: string;
  instanceId: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  exitCode: number | null;
  crashed: boolean;
}
export interface GameSnapshot {
  directory: string;
  jobs: GameStatus[];
  activeId: string | null;
  activeIds: string[];
  downloadingId: string | null;
  queue: string[];
  history: PlaySession[];
}
export type GameCommand =
  | { action: "install" | "play"; instance: Instance }
  | { action: "cancel" | "stop" | "pause" | "resume"; id: string };

export interface GameResult {
  ok: boolean;
  error?: string;
  snapshot: GameSnapshot;
}

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  binding: string;
}
export interface GameAccount {
  id: string;
  provider: GameProvider;
  username: string;
  uuid: string;
  tokens?: Tokens;
  clientToken?: string;
}
export interface LauncherSession {
  id: string;
  name: string;
  email?: string;
  username?: string;
  image?: string;
  emailVerified?: boolean;
  tokens: Tokens;
}
export interface AuthData {
  version: 1;
  launcher: LauncherSession | null;
  accounts: GameAccount[];
  selectedAccountId: string | null;
}
export interface Artifact {
  url: string;
  sha1?: string;
  sha256?: string;
  sha512?: string;
  size?: number;
  path?: string;
}
export interface Rule {
  action: "allow" | "disallow";
  os?: { name?: string; arch?: string; version?: string };
  features?: Record<string, boolean>;
}
export interface Argument {
  rules: Rule[];
  value: string | string[];
}
export interface Library {
  name: string;
  url?: string;
  sha1?: string;
  size?: number;
  rules?: Rule[];
  downloads?: { artifact?: Artifact; classifiers?: Record<string, Artifact> };
  natives?: Record<string, string>;
}
export interface Version {
  id: string;
  inheritsFrom?: string;
  minecraftArguments?: string;
  type: string;
  mainClass: string;
  javaVersion?: { majorVersion: number };
  downloads: { client: Artifact };
  assetIndex: Artifact & { id: string };
  libraries: Library[];
  arguments?: { jvm: (string | Argument)[]; game: (string | Argument)[] };
  logging?: { client: { argument: string; file: Artifact & { id: string } } };
}
export interface InstalledGame {
  gameAssets?: string;
  version: Version;
  java: string;
  gameDir: string;
  natives: string;
  classpath: string[];
  root: string;
  logConfig?: string;
}
export interface GameIdentity {
  username: string;
  uuid: string;
  accessToken: string;
  authlibRoot: string | null;
}
