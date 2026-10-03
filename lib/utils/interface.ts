export type Page =
  "home" | "library" | "downloads" | "accounts" | "settings" | "content";
export type AppMenuAction = Page | "new-instance";

export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: string;
  loaderVersion?: string | null;
  createdAt: number;
}

export interface Settings {
  memory: number;
  javaPath: string;
}

export interface LibrarySnapshot {
  instances: Instance[];
  settings: Settings;
  trash: Instance[];
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
  expiresAt: number;
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
  | "checking"
  | "downloading"
  | "ready"
  | "starting"
  | "running"
  | "stopping"
  | "cancelled"
  | "error";
export interface GameStatus {
  instanceId: string;
  version: string;
  phase: GamePhase;
  message: string;
  completed: number;
  total: number;
  logs: string[];
}
export interface GameSnapshot {
  directory: string;
  jobs: GameStatus[];
  activeId: string | null;
}
export type GameCommand =
  | { action: "install" | "play"; instance: Instance; settings: Settings }
  | { action: "cancel" | "stop"; id: string };

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
