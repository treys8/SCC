import { ImageResponse } from "next/og";

// iOS home-screen icon. Full-bleed club green with the gold "SCC" monogram,
// mirroring components/crest.tsx (literal hex — CSS variables don't resolve
// inside ImageResponse). Next auto-injects <link rel="apple-touch-icon">.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#335d3b",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 150,
            height: 150,
            borderRadius: "50%",
            border: "5px solid #b08d57",
            color: "#b08d57",
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          SCC
        </div>
      </div>
    ),
    { ...size },
  );
}
