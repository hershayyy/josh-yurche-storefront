import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#221f1c",
          color: "#f7f4ef",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          letterSpacing: "-0.04em",
        }}
      >
        JY
      </div>
    ),
    { ...size },
  );
}
