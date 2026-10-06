export interface InstanceFileEntry {
  name: string;
  size: number;
  modifiedAt: number;
}

export interface WorldEntry extends InstanceFileEntry {
  backups: InstanceFileEntry[];
}

export interface ServerEntry {
  name: string;
  address: string;
}

export interface InstanceDataSnapshot {
  instanceId: string;
  worlds: WorldEntry[];
  screenshots: InstanceFileEntry[];
  servers: ServerEntry[];
  notes: string;
  logs: (InstanceFileEntry & { kind: "log" | "crash" })[];
}

export type InstanceDataCommand =
  | { action: "notes.save"; instanceId: string; notes: string }
  | { action: "world.backup"; instanceId: string; world: string }
  | {
      action: "world.restore";
      instanceId: string;
      world: string;
      backup: string;
    }
  | { action: "world.delete"; instanceId: string; world: string }
  | {
      action: "backup.delete";
      instanceId: string;
      world: string;
      backup: string;
    }
  | {
      action:
        | "screenshot.open"
        | "screenshot.reveal"
        | "screenshot.delete"
        | "screenshot.preview";
      instanceId: string;
      name: string;
    }
  | {
      action: "server.save";
      instanceId: string;
      index: number | null;
      server: ServerEntry;
    }
  | { action: "server.delete"; instanceId: string; index: number }
  | {
      action: "log.read";
      instanceId: string;
      kind: "log" | "crash";
      name: string;
    };

export interface InstanceDataResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
