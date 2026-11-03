/**
 * Minimal ZIP writer (stored, no compression) for the full-backup export. Checked against the
 * format: local headers, central directory, end record, CRC-32 (verified with Node's zlib).
 */
import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createZip } from "@/lib/zip";

const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint32(at, true);
const u16 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint16(at, true);

// ignoreBOM keeps a leading BOM in the decoded text (the default would strip it).
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

/** Reads the stored files back from the central directory. */
function readZip(zip: Uint8Array): Record<string, string> {
  const end = zip.length - 22;
  expect(u32(zip, end)).toBe(0x06054b50);
  const count = u16(zip, end + 10);
  let p = u32(zip, end + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(u32(zip, p)).toBe(0x02014b50);
    const crc = u32(zip, p + 16);
    const size = u32(zip, p + 20);
    const nameLen = u16(zip, p + 28);
    const offset = u32(zip, p + 42);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    expect(u32(zip, offset)).toBe(0x04034b50);
    const dataAt = offset + 30 + u16(zip, offset + 26) + u16(zip, offset + 28);
    const data = zip.subarray(dataAt, dataAt + size);
    expect(crc).toBe(crc32(data));
    out[name] = decoder.decode(data);
    p += 46 + nameLen;
  }
  return out;
}

describe("createZip", () => {
  it("stores every file intact with valid CRC-32s", () => {
    const files = { "a.csv": "﻿x,y\r\n1,2\r\n", "b.csv": "café,año\r\n", "empty.csv": "" };
    expect(readZip(createZip(files, new Date("2026-11-03T10:20:30Z")))).toEqual(files);
  });

  it("produces an empty but valid archive", () => {
    const zip = createZip({}, new Date("2026-11-03T00:00:00Z"));
    expect(zip.length).toBe(22);
    expect(readZip(zip)).toEqual({});
  });
});
