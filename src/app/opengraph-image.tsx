import { ImageResponse } from "next/og";
import { site } from "@/content/site";

/**
 * Default Open Graph image for every page (1200×630), drawn in code.
 * PLACEHOLDER design: uses the system font, not Oswald. Swap for a designed
 * image by replacing this file with opengraph-image.png.
 */
export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const charcoal = "#15171C";
const cream = "#F5F1E8";
const tomato = "#B8321F";
const gold = "#F2B544";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: charcoal,
          color: cream,
          padding: 72,
          borderBottom: `24px solid ${gold}`,
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: 4 }}>
          PICK <span style={{ color: gold, margin: "0 14px" }}>&amp;</span> POUR
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 112, fontWeight: 800, lineHeight: 1 }}>
            DEAD SUNDAY?
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 112,
              fontWeight: 800,
              lineHeight: 1.05,
              color: gold,
            }}
          >
            MAKE IT GAME DAY.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", fontSize: 34 }}>
          <div
            style={{
              display: "flex",
              background: tomato,
              borderRadius: 999,
              padding: "14px 34px",
              marginRight: 28,
              fontWeight: 700,
            }}
          >
            Team wins, tab drops
          </div>
          Free for guests. Never above menu price.
        </div>
      </div>
    ),
    size,
  );
}
