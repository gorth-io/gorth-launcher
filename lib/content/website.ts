import type { ContentKind, ContentProvider } from "./interface";

export const contentLabels: Record<ContentKind, string> = {
  mod: "Mod",
  modpack: "Modpack",
  shader: "Shader",
  resourcepack: "Texture pack",
};
export const curseforgeClasses: Record<ContentKind, number> = {
  mod: 6,
  modpack: 4471,
  shader: 6552,
  resourcepack: 12,
};
export const curseforgePaths: Record<ContentKind, string> = {
  mod: "mc-mods",
  modpack: "modpacks",
  shader: "shaders",
  resourcepack: "texture-packs",
};
export function projectWebsite(
  provider: ContentProvider,
  kind: ContentKind,
  slug: string,
) {
  if (!/^[a-zA-Z0-9._()~-]{1,200}$/.test(slug) || slug === "." || slug === "..")
    throw new Error("Địa chỉ dự án không hợp lệ.");
  return provider === "modrinth"
    ? `https://modrinth.com/${kind}/${encodeURIComponent(slug)}`
    : `https://www.curseforge.com/minecraft/${curseforgePaths[kind]}/${encodeURIComponent(slug)}`;
}
export function allowedContentWebsite(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return false;
    return (
      (url.hostname === "modrinth.com" &&
        /^\/(mod|modpack|shader|resourcepack)\/[a-zA-Z0-9._()~-]+(?:\/|$)/.test(
          url.pathname,
        )) ||
      (url.hostname === "www.curseforge.com" &&
        /^\/minecraft\/(mc-mods|modpacks|shaders|texture-packs)\/[a-zA-Z0-9._()~-]+(?:\/|$)/.test(
          url.pathname,
        ))
    );
  } catch {
    return false;
  }
}
