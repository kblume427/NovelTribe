import { ImageResponse } from "next/og";

export const alt = "NovelTribe book tracking and recommendations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        color: "white",
        background: "linear-gradient(120deg, #09090b 0%, #111827 55%, #164e63 100%)",
      }}
    >
      <div style={{ fontSize: 28, letterSpacing: 8, color: "#a5f3fc" }}>NOVELTRIBE</div>
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>Track your reading.<br />Find your next obsession.</div>
      <div style={{ marginTop: 30, fontSize: 28, color: "#d4d4d8" }}>A free reading tracker for curious readers.</div>
    </div>,
  );
}