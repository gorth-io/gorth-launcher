import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  formatInitials,
  formatNumber,
} from "@/lib/utils/formatter";

test("file sizes retain adaptive units, precision and invalid-value handling", () => {
  for (const value of [NaN, Infinity, -Infinity, -1, 0])
    assert.equal(formatFileSize(value), "0 B");
  assert.equal(formatFileSize(1023), "1023 B");
  assert.equal(formatFileSize(1024), "1.0 KB");
  assert.equal(formatFileSize(10 * 1024), "10 KB");
  assert.equal(formatFileSize(1024 ** 2), "1.0 MB");
  assert.equal(formatFileSize(1024 ** 3), "1.0 GB");
  assert.equal(formatFileSize(1024 ** 4), "1.0 TB");
  assert.equal(formatFileSize(1024 ** 5), "1024 TB");
});

test("dates and numbers preserve the user's locale and timezone", () => {
  for (const value of [0, 1_791_342_123_000]) {
    const date = new Date(value);
    assert.equal(
      formatDate(value),
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value),
    );
    assert.equal(formatDate(date), formatDate(value));
    assert.equal(formatDateTime(value), date.toLocaleString());
    assert.equal(formatDateTime(date), date.toLocaleString());
    assert.equal(date.getTime(), value);
  }
  assert.equal(formatDateTime(NaN), new Date(NaN).toLocaleString());
  assert.throws(() => formatDate(NaN), RangeError);
  for (const value of [0, 1234567.89, -12345, NaN, Infinity])
    assert.equal(formatNumber(value), new Intl.NumberFormat().format(value));
});

test("avatar initials preserve spacing, uppercase and fallback behavior", () => {
  assert.equal(formatInitials(""), "G");
  assert.equal(formatInitials("  \t "), "G");
  assert.equal(formatInitials("gorth"), "G");
  assert.equal(formatInitials("  Gorth   Browser  User "), "GB");
  assert.equal(formatInitials("nguyễn\nvăn an"), "NV");
});

import {
  formatDuration,
  formatFilenameTimestamp,
  formatInstanceFileSize,
  formatMinutes,
  formatRemainingTime,
  formatTransferRate,
} from "@/lib/utils/formatter";

test("instance sizes preserve fixed KB/MB precision and do not switch to GB", () => {
  assert.equal(formatInstanceFileSize(0), "0 B");
  assert.equal(formatInstanceFileSize(1023), "1023 B");
  assert.equal(formatInstanceFileSize(1024), "1.0 KB");
  assert.equal(formatInstanceFileSize(1536), "1.5 KB");
  assert.equal(formatInstanceFileSize(10 * 1024), "10.0 KB");
  assert.equal(formatInstanceFileSize(1024 ** 2), "1.0 MB");
  assert.equal(formatInstanceFileSize(1024 ** 3), "1024.0 MB");
});

test("play-time displays retain milliseconds, Vietnamese labels and total minutes", () => {
  assert.equal(formatDuration(0), "0 phút");
  assert.equal(formatDuration(59_999), "0 phút");
  assert.equal(formatDuration(60_000), "1 phút");
  assert.equal(formatDuration(3_600_000), "1 giờ 0 phút");
  assert.equal(formatDuration(3_660_000), "1 giờ 1 phút");
  assert.equal(formatMinutes(3_660_000), "61 phút");
  assert.equal(formatMinutes(3_660_000, "min"), "61 min");
});

test("download rates and estimates retain fixed MB/s and seconds", () => {
  assert.equal(formatTransferRate(0), "0.00 MB/s");
  assert.equal(formatTransferRate(1024), "0.00 MB/s");
  assert.equal(formatTransferRate(1.5 * 1024 ** 2), "1.50 MB/s");
  assert.equal(formatRemainingTime(0), "0 giây");
  assert.equal(formatRemainingTime(1.1), "2 giây");
  assert.equal(formatRemainingTime(61), "61 giây");
});

test("backup timestamps are deterministic, UTC and filename safe without reading the clock", () => {
  const value = Date.UTC(2026, 9, 7, 12, 34, 56, 789);
  const date = new Date(value);
  assert.equal(formatFilenameTimestamp(value), "2026-10-07T12-34-56-789Z");
  assert.equal(formatFilenameTimestamp(date), formatFilenameTimestamp(value));
  assert.equal(date.getTime(), value);
  assert.throws(() => formatFilenameTimestamp(NaN), RangeError);
});
