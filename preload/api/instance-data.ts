import { ipcRenderer } from "electron";
import type {
  InstanceDataCommand,
  InstanceDataResult,
  InstanceDataSnapshot,
} from "@/lib/instance/interface";

export const instanceDataApi = {
  snapshot: (
    instanceId: string,
  ): Promise<InstanceDataResult<InstanceDataSnapshot>> =>
    ipcRenderer.invoke("instance-data:snapshot", { instanceId }),
  command: (
    command: InstanceDataCommand,
  ): Promise<
    InstanceDataResult<{ snapshot: InstanceDataSnapshot; content?: string }>
  > => ipcRenderer.invoke("instance-data:command", command),
  export: (instanceId: string): Promise<InstanceDataResult<string | null>> =>
    ipcRenderer.invoke("instance-data:export", { instanceId }),
  import: (): Promise<InstanceDataResult<unknown>> =>
    ipcRenderer.invoke("instance-data:import"),
};
