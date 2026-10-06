import type { Artifact } from "@/lib/utils/interface";
export type ContentProvider = "modrinth" | "curseforge";
export type ContentKind =
  "mod" | "modpack" | "shader" | "resourcepack" | "datapack";
export interface ContentQuery {
  provider: ContentProvider;
  kind: ContentKind;
  query: string;
  version: string;
  loader: string;
  offset: number;
}
export interface ContentProject {
  id: string;
  url: string;
  name: string;
  description: string;
  downloads: number;
}
export interface ContentVersion {
  id: string;
  name: string;
  filename: string;
}
export interface ContentStatus {
  busy: boolean;
  message: string;
  completed: number;
  total: number;
  error?: string;
}
export interface ContentInstall {
  query: ContentQuery;
  projectId: string;
  versionId: string;
  instanceId?: string;
  worldName?: string;
}
export interface ContentFile {
  directory?: "mods" | "resourcepacks" | "shaderpacks" | "datapacks";
  projectId: string;
  versionId: string;
  filename: string;
  artifact: Artifact;
  required: { projectId?: string; versionId?: string }[];
  conflicts?: string[];
}
export interface InstalledContent {
  id: string;
  provider: ContentProvider | null;
  kind: ContentKind;
  projectId: string | null;
  versionId: string | null;
  filename: string;
  directory: string;
  worldName?: string;
  enabled: boolean;
  managed: boolean;
  modified: boolean;
  update?: ContentVersion;
}
export interface ContentInventory {
  instanceId: string;
  worlds: string[];
  items: InstalledContent[];
}
export type ContentManageAction = "enable" | "disable" | "remove" | "update";
export interface ContentManage {
  action: ContentManageAction;
  instanceId: string;
  id: string;
}
export interface ContentResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
