export function formatFileSize(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0 B";
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let index = -1;
  do {
    size /= 1024;
    index += 1;
  } while (size >= 1024 && index < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value: Date | number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

/** Full local date/time, preserving the display used by history and downloads. */
export function formatDateTime(value: Date | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

export function formatInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "G"
  );
}

/** Instance files retain their fixed KB/MB precision (including large backups). */
export function formatInstanceFileSize(value: number): string {
  return value < 1024
    ? `${value} B`
    : value < 1024 ** 2
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 ** 2).toFixed(1)} MB`;
}

/** Elapsed play time in milliseconds, displayed as hours and minutes. */
export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} giờ ${minutes % 60} phút` : `${minutes} phút`;
}

/** Total minutes; unlike formatDuration, does not convert minutes to hours. */
export function formatMinutes(milliseconds: number, unit = "phút"): string {
  return `${Math.floor(milliseconds / 60_000)} ${unit}`;
}

export function formatTransferRate(bytesPerSecond: number): string {
  return `${(bytesPerSecond / 1024 ** 2).toFixed(2)} MB/s`;
}

export function formatRemainingTime(seconds: number): string {
  return `${Math.ceil(seconds)} giây`;
}

/** Clock and file operations stay with the caller; this only formats a value. */
export function formatFilenameTimestamp(value: Date | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().replace(/[:.]/g, "-");
}
