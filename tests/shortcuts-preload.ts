import { contextBridge } from "electron";
import { shortcutsApi } from "@/preload/api/shortcuts";
contextBridge.exposeInMainWorld("electronAPI", { shortcuts: shortcutsApi });
