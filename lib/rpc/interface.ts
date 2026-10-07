export interface RpcRequest {
  url: string;
  method: "GET" | "POST";
  body?: string;
}
export interface RpcResponse {
  status: number;
  body: string;
}
