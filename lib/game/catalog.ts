// Deliberately curated releases, not a moving 'latest' channel.
export const loaderCatalog = [
  { loader: "Forge", minecraft: "1.20.1", version: "47.4.10" },
  { loader: "Forge", minecraft: "1.19.2", version: "43.5.0" },
  { loader: "NeoForge", minecraft: "1.20.1", version: "47.1.106" },
  { loader: "NeoForge", minecraft: "1.21.1", version: "21.1.217" },
  { loader: "Fabric", minecraft: "1.20.1", version: "0.16.14" },
  // Fabulously Optimized 6.5.0 release pins this version on Minecraft 1.21.1.
  { loader: "Fabric", minecraft: "1.21.1", version: "0.19.3" },
  { loader: "Fabric", minecraft: "1.21.1", version: "0.16.14" },
] as const;

export function supportedVanillaVersion(id: string) {
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(id)) return false;
  const [major, minor, patch = 0] = id.split(".").map(Number);
  return major > 1 || (major === 1 && (minor > 7 || (minor === 7 && patch >= 10)));
}

export function supportedRelease(version: { id: string; type: string }) {
  return version.type === "release" && supportedVanillaVersion(version.id);
}

export function supportedLoader(value: {
  loader: string;
  version: string;
  loaderVersion?: string | null;
}) {
  return value.loader === "Vanilla"
    ? !value.loaderVersion && supportedVanillaVersion(value.version)
    : loaderCatalog.some(
        (entry) =>
          entry.loader === value.loader &&
          entry.minecraft === value.version &&
          entry.version === value.loaderVersion,
      );
}
