import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          gap: 0,
        }}
      >
        <div style={{ color: "#F4EFE3", fontSize: 110, fontWeight: 900, lineHeight: 1 }}>
          M
        </div>
        <div style={{ color: "#C8A23A", fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: 2 }}>
          2026
        </div>
      </div>
    ),
    { ...size }
  );
}
