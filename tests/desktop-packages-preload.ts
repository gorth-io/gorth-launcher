import { contextBridge } from "electron";
import { rpcApi } from "@/preload/api/rpc";
contextBridge.exposeInMainWorld("electronAPI", { rpc: rpcApi });
