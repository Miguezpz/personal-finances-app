/**
 * Brand icons (spec 003, T015, research R6). Run by hand when the monogram changes — NOT part of the build:
 *
 *   node scripts/generate-favicon.mjs
 *
 * Renders the monogram (ink rounded square + three ascending emerald bars, same design as src/app/icon.svg)
 * with `ImageResponse` from next/og and writes:
 *   - src/app/favicon.ico              16/32/48 px PNGs in an ICO container (ICO allows embedded PNG)
 *   - public/icons/icon-neon-192.png   manifest icon, Neon palette (black + acid green): Neon is the default theme and
 *   - public/icons/icon-neon-512.png   an installed app's icon is fixed at install time
 *   - public/icons/icon-neon-maskable-512.png  full-bleed black background, monogram inside the central 80 % safe zone
 * The favicon keeps the green palette: it's the tab icon of the light/dark themes (Neon swaps in its own SVG).
 * Commit the resulting binaries.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

/** Palettes: square, frame, bars. */
const GREEN = { square: "#052E2B", frame: "#0F766E", bars: "#34D399" };
const NEON = { square: "#0A0A0A", frame: "#CEE616", bars: "#CEE616" };

/**
 * The monogram as satori-compatible divs, drawn in a `size` px box.
 * `bleed`: the square fills the canvas with no rounded corners and the bars shrink into the maskable safe zone.
 */
function monogram(size, { bleed = false, palette = GREEN } = {}) {
  const tiny = size <= 16;
  // Geometry on a 32-unit grid (matches icon.svg); at 16 px the bars get thicker and the gaps smaller.
  const u = size / 32;
  const scale = bleed ? 0.8 : 1;
  const bars = tiny
    ? [
        { x: 6, w: 6, top: 16 },
        { x: 13, w: 6, top: 11 },
        { x: 20, w: 6, top: 6 },
      ]
    : [
        { x: 7, w: 5, top: 17 },
        { x: 13.5, w: 5, top: 12 },
        { x: 20, w: 5, top: 7 },
      ];
  const bottom = tiny ? 26 : 25;
  const origin = (32 - 32 * scale) / 2;
  const at = (v) => (origin + v * scale) * u;

  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        position: "relative",
        background: bleed ? palette.square : "transparent",
      },
    },
    !bleed &&
      h("div", {
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          background: palette.square,
          borderRadius: 8 * u,
          border: tiny ? "none" : `${Math.max(1, 2 * u)}px solid ${palette.frame}`,
        },
      }),
    ...bars.map((b) =>
      h("div", {
        key: b.x,
        style: {
          position: "absolute",
          left: at(b.x),
          top: at(b.top),
          width: b.w * scale * u,
          height: (bottom - b.top) * scale * u,
          background: palette.bars,
          borderRadius: Math.max(1, 1.5 * scale * u),
        },
      }),
    ),
  );
}

async function png(size, options) {
  const res = new ImageResponse(monogram(size, options), { width: size, height: size });
  return Buffer.from(await res.arrayBuffer());
}

/** ICO container with embedded PNGs (one directory entry per image). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const favicon = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await png(size) })),
);
writeFileSync("src/app/favicon.ico", ico(favicon));

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-neon-192.png", await png(192, { palette: NEON }));
writeFileSync("public/icons/icon-neon-512.png", await png(512, { palette: NEON }));
writeFileSync(
  "public/icons/icon-neon-maskable-512.png",
  await png(512, { bleed: true, palette: NEON }),
);

console.log("Wrote src/app/favicon.ico and public/icons/icon-neon-{192,512,maskable-512}.png");
