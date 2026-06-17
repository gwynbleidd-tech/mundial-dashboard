import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1B5E3A",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#F4EFE3", fontSize: 104, fontWeight: 900, lineHeight: 1 }}>
          M
        </div>
        <div style={{ color: "#C8A23A", fontSize: 34, fontWeight: 900, lineHeight: 1, letterSpacing: 2 }}>
          2026
        </div>
      </div>
    ),
    { ...size }
  );
}
