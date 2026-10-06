import { z } from "zod";
import type { InstanceSettings, Settings } from "@/lib/utils/interface";

const safeText = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine(
      (value) => !value.includes("\0"),
      "Giá trị chứa ký tự không hợp lệ.",
    );

export const instanceSettingsSchema = z
  .object({
    memoryMin: z.number().int().min(1).max(64),
    memoryMax: z.number().int().min(1).max(64),
    javaPath: safeText(4096),
    jvmArguments: z.array(safeText(1024)).max(128),
    resolutionWidth: z.number().int().min(320).max(16384),
    resolutionHeight: z.number().int().min(240).max(16384),
    fullscreen: z.boolean(),
    environment: z
      .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), safeText(4096))
      .refine(
        (value) => Object.keys(value).length <= 64,
        "Chỉ cho phép tối đa 64 biến môi trường.",
      ),
    accountId: z.string().max(100).nullable(),
    joinServer: safeText(255),
    joinWorld: safeText(255),
    preLaunchCommand: safeText(4096),
    postExitCommand: safeText(4096),
    gpuPreference: z.enum(["default", "high-performance", "integrated"]),
    openGlPath: safeText(4096),
    openAlPath: safeText(4096),
    glfwPath: safeText(4096),
  })
  .refine((value) => value.memoryMin <= value.memoryMax, {
    message: "RAM tối thiểu không được lớn hơn RAM tối đa.",
  })
  .refine((value) => !(value.joinServer && value.joinWorld), {
    message: "Chỉ có thể vào server hoặc world, không thể chọn cả hai.",
  });

export function defaultInstanceSettings(settings: Settings): InstanceSettings {
  return {
    memoryMin: 1,
    memoryMax: settings.memory,
    javaPath: settings.javaPath,
    jvmArguments: [],
    resolutionWidth: 1280,
    resolutionHeight: 720,
    fullscreen: false,
    environment: {},
    accountId: null,
    joinServer: "",
    joinWorld: "",
    preLaunchCommand: "",
    postExitCommand: "",
    gpuPreference: "default",
    openGlPath: "",
    openAlPath: "",
    glfwPath: "",
  };
}
