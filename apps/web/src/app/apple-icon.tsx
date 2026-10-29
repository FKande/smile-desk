import { ImageResponse } from "next/og";
import { TOOTH_PATH } from "@/components/icons/Icon";

/* iOS home-screen icon, rendered to PNG at build time from the same tooth
 * glyph as icon.svg. iOS rounds the corners itself, so the square is full
 * bleed. Colors are literal because the image renderer cannot read CSS
 * tokens: #007a77 is --brand-solid (teal-900) in light mode. */
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
          background: "#007a77",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d={TOOTH_PATH} />
        </svg>
      </div>
    ),
    size,
  );
}
