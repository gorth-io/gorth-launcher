// Small, bounded NBT codec for Minecraft's servers.dat. Unknown fields are
// retained so editing a server does not discard Minecraft metadata/icons.
type NbtValue =
  | number
  | bigint
  | string
  | Buffer
  | Int32Array
  | BigInt64Array
  | NbtValue[]
  | NbtCompound;
interface NbtTag {
  type: number;
  value: NbtValue;
}
export interface NbtCompound {
  [key: string]: NbtTag;
}

const MAX_ITEMS = 100_000;
class Reader {
  offset = 0;
  constructor(readonly data: Buffer) {}
  take(size: number) {
    if (size < 0 || this.offset + size > this.data.length)
      throw new Error("NBT bị cắt ngắn.");
    const value = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    return value;
  }
  byte() {
    return this.take(1).readInt8();
  }
  ushort() {
    return this.take(2).readUInt16BE();
  }
  int() {
    return this.take(4).readInt32BE();
  }
  string() {
    const size = this.ushort();
    return this.take(size).toString("utf8");
  }
  value(type: number, depth = 0): NbtValue {
    if (depth > 32) throw new Error("NBT lồng quá sâu.");
    if (type === 1) return this.byte();
    if (type === 2) return this.take(2).readInt16BE();
    if (type === 3) return this.int();
    if (type === 4) return this.take(8).readBigInt64BE();
    if (type === 5) return this.take(4).readFloatBE();
    if (type === 6) return this.take(8).readDoubleBE();
    if (type === 7) {
      const n = this.int();
      if (n > MAX_ITEMS) throw new Error("NBT quá lớn.");
      return this.take(n);
    }
    if (type === 8) return this.string();
    if (type === 9) {
      const child = this.byte(),
        n = this.int();
      if (n < 0 || n > MAX_ITEMS) throw new Error("NBT list không hợp lệ.");
      return Array.from({ length: n }, () => ({
        type: child,
        value: this.value(child, depth + 1),
      })) as unknown as NbtValue[];
    }
    if (type === 10) {
      const result: NbtCompound = {};
      for (let n = 0; n < MAX_ITEMS; n++) {
        const child = this.byte();
        if (child === 0) return result;
        const name = this.string();
        result[name] = { type: child, value: this.value(child, depth + 1) };
      }
      throw new Error("NBT compound quá lớn.");
    }
    if (type === 11) {
      const n = this.int();
      if (n < 0 || n > MAX_ITEMS) throw new Error("NBT quá lớn.");
      const a = new Int32Array(n);
      for (let i = 0; i < n; i++) a[i] = this.int();
      return a;
    }
    if (type === 12) {
      const n = this.int();
      if (n < 0 || n > MAX_ITEMS) throw new Error("NBT quá lớn.");
      const a = new BigInt64Array(n);
      for (let i = 0; i < n; i++) a[i] = this.take(8).readBigInt64BE();
      return a;
    }
    throw new Error("NBT tag không hỗ trợ: " + type);
  }
}

const b1 = (n: number) => {
  const b = Buffer.alloc(1);
  b.writeInt8(n);
  return b;
};
const b2 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeInt16BE(n);
  return b;
};
const bu2 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
const b4 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n);
  return b;
};
const str = (v: string) => {
  const data = Buffer.from(v, "utf8");
  if (data.length > 65535) throw new Error("Chuỗi NBT quá dài.");
  return Buffer.concat([bu2(data.length), data]);
};
function encodeValue(tag: NbtTag, depth = 0): Buffer {
  if (depth > 32) throw new Error("NBT lồng quá sâu.");
  const v = tag.value;
  if (tag.type === 1) return b1(Number(v));
  if (tag.type === 2) return b2(Number(v));
  if (tag.type === 3) return b4(Number(v));
  if (tag.type === 4) {
    const b = Buffer.alloc(8);
    b.writeBigInt64BE(BigInt(v as bigint));
    return b;
  }
  if (tag.type === 5) {
    const b = Buffer.alloc(4);
    b.writeFloatBE(Number(v));
    return b;
  }
  if (tag.type === 6) {
    const b = Buffer.alloc(8);
    b.writeDoubleBE(Number(v));
    return b;
  }
  if (tag.type === 7)
    return Buffer.concat([b4((v as Buffer).length), v as Buffer]);
  if (tag.type === 8) return str(v as string);
  if (tag.type === 9) {
    const list = v as unknown as NbtTag[];
    const child = list[0]?.type ?? 10;
    return Buffer.concat([
      b1(child),
      b4(list.length),
      ...list.map((x) => encodeValue(x, depth + 1)),
    ]);
  }
  if (tag.type === 10) {
    const parts: Buffer[] = [];
    for (const [name, child] of Object.entries(v as NbtCompound))
      parts.push(b1(child.type), str(name), encodeValue(child, depth + 1));
    return Buffer.concat([...parts, b1(0)]);
  }
  if (tag.type === 11) {
    const a = v as Int32Array;
    return Buffer.concat([b4(a.length), ...Array.from(a, b4)]);
  }
  if (tag.type === 12) {
    const a = v as BigInt64Array;
    return Buffer.concat([
      b4(a.length),
      ...Array.from(a, (x) => {
        const b = Buffer.alloc(8);
        b.writeBigInt64BE(x);
        return b;
      }),
    ]);
  }
  throw new Error("NBT tag không hỗ trợ.");
}

export function readServersNbt(data: Buffer) {
  if (data.length > 16 * 1024 * 1024) throw new Error("servers.dat quá lớn.");
  const reader = new Reader(data),
    type = reader.byte();
  if (type !== 10) throw new Error("servers.dat không phải NBT compound.");
  reader.string();
  const root = reader.value(10) as NbtCompound;
  if (reader.offset !== data.length)
    throw new Error("servers.dat có dữ liệu dư.");
  return root;
}
export function writeServersNbt(root: NbtCompound) {
  return Buffer.concat([
    b1(10),
    str(""),
    encodeValue({ type: 10, value: root }),
  ]);
}
export function serverCompounds(root: NbtCompound): NbtCompound[] {
  const tag = root.servers;
  if (!tag) {
    root.servers = { type: 9, value: [] };
    return [];
  }
  if (tag.type !== 9 || !Array.isArray(tag.value))
    throw new Error("Danh sách server không hợp lệ.");
  return (tag.value as unknown as NbtTag[]).map((tag) => {
    if (tag.type !== 10) throw new Error("Server NBT không hợp lệ.");
    return tag.value as NbtCompound;
  });
}
export function setServerCompounds(root: NbtCompound, values: NbtCompound[]) {
  root.servers = {
    type: 9,
    value: values.map((value) => ({
      type: 10,
      value,
    })) as unknown as NbtValue[],
  };
}
export function nbtString(compound: NbtCompound, key: string) {
  const tag = compound[key];
  return tag?.type === 8 ? (tag.value as string) : "";
}
export function setNbtString(
  compound: NbtCompound,
  key: string,
  value: string,
) {
  compound[key] = { type: 8, value };
}
