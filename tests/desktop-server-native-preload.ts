import { contextBridge, ipcRenderer } from "electron";
import { authApi } from "@/preload/api/auth";
contextBridge.exposeInMainWorld("testDesktop", {
  profileData: authApi.profile,
  profile: async () => {
    const connection = await ipcRenderer.invoke("desktop:connection");
    const response = await fetch(connection.origin + "/user/profile", {
      headers: { "x-gorth-desktop-session": connection.capability },
    });
    return { status: response.status, body: await response.json() };
  },
});
