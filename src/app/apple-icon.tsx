import { ImageResponse } from "next/og";

/**
 * Apple touch icon (spec 003, FR-010, research R6): the brand monogram on a solid ink background (iOS doesn't
 * support transparency). No request-time APIs, so it's generated once at build time.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BARS = [
  { left: 44, top: 98, height: 48 },
  { left: 78, top: 70, height: 76 },
  { left: 112, top: 42, height: 104 },
];

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#052E2B" }}>
      {BARS.map((bar) => (
        <div
          key={bar.left}
          style={{
            position: "absolute",
            left: bar.left,
            top: bar.top,
            width: 24,
            height: bar.height,
            borderRadius: 7,
            background: "#34D399",
          }}
        />
      ))}
    </div>,
    size,
  );
}
