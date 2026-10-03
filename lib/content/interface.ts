import type { Artifact } from "@/lib/utils/interface";
export type ContentProvider = "modrinth" | "curseforge";
export type ContentKind = "mod" | "modpack" | "shader" | "resourcepack";
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
}
export interface ContentFile {
  directory?: "mods" | "resourcepacks" | "shaderpacks";
  projectId: string;
  versionId: string;
  filename: string;
  artifact: Artifact;
  required: { projectId?: string; versionId?: string }[];
}
export interface ContentResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
