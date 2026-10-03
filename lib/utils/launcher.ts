import { Instance, Settings } from "@/lib/utils/interface";

export const defaultSettings: Settings = { memory: 4, javaPath: "" };
const instancesCookie = "launcher-instances";
const settingsCookie = "launcher-settings";
function readCookie(name: string): string | null {
  return (
    document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}
function readJsonCookie<T>(name: string, fallback: T): T {
  const cookie = readCookie(name);
  if (cookie !== null) {
    try {
      return JSON.parse(decodeURIComponent(cookie)) as T;
    } catch {
      /* Try the older localStorage format. */
    }
  }
  try {
    return (
      (JSON.parse(localStorage.getItem("gorth-" + name) ?? "null") as T) ??
      fallback
    );
  } catch {
    return fallback;
  }
}
export function readInstances(): Instance[] {
  try {
    const data: unknown = readJsonCookie(instancesCookie, []);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is Instance =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.version === "string" &&
        typeof item.loader === "string" &&
        typeof item.createdAt === "number",
    );
  } catch {
    return [];
  }
}

export function readSettings(): Settings {
  try {
    const data = readJsonCookie(settingsCookie, {} as Partial<Settings>);
    const memory = data.memory;
    return {
      memory:
        typeof memory === "number" &&
        Number.isInteger(memory) &&
        memory >= 1 &&
        memory <= 64
          ? memory
          : 4,
      javaPath: typeof data?.javaPath === "string" ? data.javaPath : "",
    };
  } catch {
    return defaultSettings;
  }
}
