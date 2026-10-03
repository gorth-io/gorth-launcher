import { z } from "zod";
import { curseforgeClasses, curseforgePaths, projectWebsite } from "./website";
import { curseforgeApiKey } from "@/lib/utils/environment";
import type {
  ContentFile,
  ContentProject,
  ContentProvider,
  ContentQuery,
  ContentVersion,
} from "./interface";
const loaderIds: Record<string, number> = { Forge: 1, Fabric: 4, NeoForge: 6 };
export const hasCurseForgeKey = () => Boolean(curseforgeApiKey);
const identifier = (value: string) => {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value))
    throw new Error("Project/file ID không hợp lệ.");
  return value;
};
export async function providerJson<T>(
  provider: ContentProvider,
  route: string,
  signal: AbortSignal,
): Promise<T> {
  if (provider === "curseforge" && !curseforgeApiKey)
    throw new Error(
      "CurseForge cần CURSEFORGE_API_KEY trong môi trường main process. Xem .env.example và khởi động lại launcher.",
    );
  const result = await fetch(
    (provider === "modrinth"
      ? "https://api.modrinth.com/v2"
      : "https://api.curseforge.com/v1") + route,
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      redirect: "error",
      headers: {
        "User-Agent": "GorthLauncher/0.0.0",
        ...(provider === "curseforge" ? { "x-api-key": curseforgeApiKey } : {}),
      },
    },
  );
  if (!result.ok)
    throw new Error(
      provider +
        " HTTP " +
        result.status +
        (result.status === 429
          ? ": quá nhiều yêu cầu, hãy thử lại sau."
          : ": không lấy được dữ liệu."),
    );
  return result.json() as Promise<T>;
}
const mrVersion = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  version_type: z.string(),
  game_versions: z.array(z.string()),
  loaders: z.array(z.string()),
  files: z
    .array(
      z.object({
        filename: z.string(),
        url: z.string(),
        size: z.number().int().nonnegative(),
        primary: z.boolean(),
        hashes: z.object({ sha1: z.string(), sha512: z.string().optional() }),
      }),
    )
    .min(1),
  dependencies: z.array(
    z.object({
      project_id: z.string().nullable(),
      version_id: z.string().nullable(),
      dependency_type: z.string(),
    }),
  ),
});
const cfFile = z.object({
  id: z.number().int(),
  modId: z.number().int(),
  displayName: z.string(),
  fileName: z.string(),
  isAvailable: z.boolean(),
  releaseType: z.number(),
  gameVersions: z.array(z.string()),
  downloadUrl: z.string().nullable(),
  fileLength: z.number().int().nonnegative(),
  hashes: z.array(z.object({ algo: z.number(), value: z.string() })),
  dependencies: z.array(
    z.object({ modId: z.number().int(), relationType: z.number() }),
  ),
});
function compatibleMr(value: z.infer<typeof mrVersion>, query: ContentQuery) {
  return (
    value.version_type === "release" &&
    value.game_versions.includes(query.version) &&
    (query.kind === "shader" ||
      query.kind === "resourcepack" ||
      value.loaders.includes(query.loader.toLowerCase()))
  );
}
function compatibleCf(value: z.infer<typeof cfFile>, query: ContentQuery) {
  return (
    value.isAvailable &&
    value.releaseType === 1 &&
    value.gameVersions.includes(query.version) &&
    (query.kind === "shader" ||
      query.kind === "resourcepack" ||
      value.gameVersions.some(
        (item) => item.toLowerCase() === query.loader.toLowerCase(),
      ))
  );
}
export async function searchContent(
  query: ContentQuery,
  signal: AbortSignal,
): Promise<{ projects: ContentProject[]; more: boolean }> {
  if (query.provider === "modrinth") {
    const params = new URLSearchParams({
      query: query.query,
      limit: "20",
      offset: String(query.offset),
      facets: JSON.stringify([
        ["project_type:" + query.kind],
        ["versions:" + query.version],
        ...(query.kind === "mod" || query.kind === "modpack"
          ? [["categories:" + query.loader.toLowerCase()]]
          : []),
      ]),
    });
    const result = await providerJson<{
      hits: {
        project_id: string;
        slug?: string;
        title: string;
        description: string;
        downloads: number;
      }[];
      total_hits: number;
    }>(query.provider, "/search?" + params, signal);
    return {
      projects: result.hits.map((item) => ({
        id: item.project_id,
        url: projectWebsite(
          query.provider,
          query.kind,
          item.slug ?? item.project_id,
        ),
        name: item.title,
        description: item.description,
        downloads: item.downloads,
      })),
      more: query.offset + result.hits.length < result.total_hits,
    };
  }
  const params = new URLSearchParams({
    gameId: "432",
    classId: String(curseforgeClasses[query.kind]),
    searchFilter: query.query,
    gameVersion: query.version,
    ...(query.kind === "mod" || query.kind === "modpack"
      ? { modLoaderType: String(loaderIds[query.loader]) }
      : {}),
    pageSize: "20",
    index: String(query.offset),
    sortField: "2",
    sortOrder: "desc",
  });
  const result = await providerJson<{
    data: {
      id: number;
      slug?: string;
      name: string;
      summary: string;
      downloadCount: number;
    }[];
    pagination: { totalCount: number };
  }>(query.provider, "/mods/search?" + params, signal);
  return {
    projects: result.data.map((item) => ({
      id: String(item.id),
      url: projectWebsite(
        query.provider,
        query.kind,
        item.slug ?? String(item.id),
      ),
      name: item.name,
      description: item.summary,
      downloads: item.downloadCount,
    })),
    more: query.offset + result.data.length < result.pagination.totalCount,
  };
}
export async function contentVersions(
  query: ContentQuery,
  projectId: string,
  signal: AbortSignal,
): Promise<ContentVersion[]> {
  identifier(projectId);
  if (query.provider === "modrinth") {
    const params = new URLSearchParams({
      game_versions: JSON.stringify([query.version]),
      ...(query.kind === "mod" || query.kind === "modpack"
        ? { loaders: JSON.stringify([query.loader.toLowerCase()]) }
        : {}),
    });
    const values = z
      .array(mrVersion)
      .parse(
        await providerJson(
          query.provider,
          "/project/" + projectId + "/version?" + params,
          signal,
        ),
      );
    return values
      .filter((v) => compatibleMr(v, query))
      .map((v) => ({
        id: v.id,
        name: v.name,
        filename: (v.files.find((f) => f.primary) ?? v.files[0]).filename,
      }));
  }
  const params = new URLSearchParams({
    gameVersion: query.version,
    ...(query.kind === "mod" || query.kind === "modpack"
      ? { modLoaderType: String(loaderIds[query.loader]) }
      : {}),
    pageSize: "50",
  });
  const result = await providerJson<{ data: unknown[] }>(
    query.provider,
    "/mods/" + projectId + "/files?" + params,
    signal,
  );
  return z
    .array(cfFile)
    .parse(result.data)
    .filter((v) => compatibleCf(v, query))
    .map((v) => ({
      id: String(v.id),
      name: v.displayName,
      filename: v.fileName,
    }));
}
export async function resolveContentFile(
  query: ContentQuery,
  projectId: string,
  versionId: string,
  signal: AbortSignal,
  pinnedPackFile = false,
): Promise<ContentFile> {
  identifier(projectId);
  identifier(versionId);
  if (query.provider === "modrinth") {
    const v = mrVersion.parse(
      await providerJson(query.provider, "/version/" + versionId, signal),
    );
    const project = await providerJson<{
      project_type: string;
      client_side: string;
    }>(query.provider, "/project/" + projectId, signal);
    if (
      v.project_id !== projectId ||
      !compatibleMr(v, query) ||
      project.project_type !== query.kind ||
      project.client_side === "unsupported"
    )
      throw new Error(
        "Phiên bản Modrinth không tương thích client/Minecraft/loader.",
      );
    const file = v.files.find((item) => item.primary) ?? v.files[0];
    return {
      projectId,
      versionId,
      filename: file.filename,
      directory:
        query.kind === "shader"
          ? "shaderpacks"
          : query.kind === "resourcepack"
            ? "resourcepacks"
            : "mods",
      artifact: {
        url: file.url,
        sha1: file.hashes.sha1,
        sha512: file.hashes.sha512,
        size: file.size,
      },
      required: v.dependencies
        .filter((d) => d.dependency_type === "required")
        .map((d) => ({
          projectId: d.project_id ?? undefined,
          versionId: d.version_id ?? undefined,
        })),
    };
  }
  const result = await providerJson<{ data: unknown }>(
    query.provider,
    "/mods/" + projectId + "/files/" + versionId,
    signal,
  );
  const v = cfFile.parse(result.data);
  const project = await providerJson<{
    data: {
      classId: number;
      slug?: string;
      allowModDistribution: boolean | null;
    };
  }>(query.provider, "/mods/" + projectId, signal);
  if (
    String(v.modId) !== projectId ||
    (!pinnedPackFile && !compatibleCf(v, query)) ||
    !v.isAvailable ||
    !(
      pinnedPackFile ? [6, 12, 6552] : [curseforgeClasses[query.kind]]
    ).includes(project.data.classId)
  )
    throw new Error("File CurseForge không tương thích hoặc không khả dụng.");
  if (!v.downloadUrl || project.data.allowModDistribution === false)
    throw new Error(
      "Tác giả không cho tải file này qua ứng dụng bên thứ ba. Tải thủ công từ https://www.curseforge.com/minecraft/" +
        curseforgePaths[query.kind] +
        "/" +
        encodeURIComponent(project.data.slug ?? projectId) +
        "/files/" +
        versionId +
        ". Launcher không dùng URL thay thế để vượt hạn chế.",
    );
  const sha1 = v.hashes.find((hash) => hash.algo === 1)?.value;
  if (!sha1) throw new Error("CurseForge không cung cấp SHA-1 của file.");
  return {
    projectId,
    versionId,
    filename: v.fileName,
    directory:
      project.data.classId === 12
        ? "resourcepacks"
        : project.data.classId === 6552
          ? "shaderpacks"
          : "mods",
    artifact: { url: v.downloadUrl, sha1, size: v.fileLength },
    required: v.dependencies
      .filter((d) => d.relationType === 3)
      .map((d) => ({ projectId: String(d.modId) })),
  };
}
export async function resolveMods(
  query: ContentQuery,
  projectId: string,
  versionId: string,
  signal: AbortSignal,
) {
  const files = new Map<string, ContentFile>();
  async function visit(project: string, version: string) {
    if (files.has(project)) {
      if (files.get(project)!.versionId !== version)
        throw new Error(
          "Dependency yêu cầu hai phiên bản khác nhau của cùng một mod.",
        );
      return;
    }
    if (files.size >= 200) throw new Error("Quá nhiều dependency mod.");
    const file = await resolveContentFile(query, project, version, signal);
    files.set(project, file);
    for (const dependency of file.required) {
      let id = dependency.projectId;
      if (!id && dependency.versionId && query.provider === "modrinth")
        id = (
          await providerJson<{ project_id: string }>(
            query.provider,
            "/version/" + identifier(dependency.versionId),
            signal,
          )
        ).project_id;
      if (!id) throw new Error("Dependency thiếu project ID.");
      const chosen =
        dependency.versionId ??
        files.get(id)?.versionId ??
        (await contentVersions(query, id, signal))[0]?.id;
      if (!chosen)
        throw new Error("Không có dependency release phù hợp: " + id);
      await visit(id, chosen);
    }
  }
  await visit(projectId, versionId);
  return [...files.values()];
}
