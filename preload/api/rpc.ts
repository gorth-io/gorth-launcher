import { ipcRenderer } from "electron";
import type { RpcRequest, RpcResponse } from "@/lib/rpc/interface";
export const rpcApi = {
  request: (request: RpcRequest): Promise<RpcResponse> =>
    ipcRenderer.invoke("desktop:rpc", request),
};
