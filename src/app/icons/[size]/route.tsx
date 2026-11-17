import { ImageResponse } from "next/og";

const SIZES = [192, 512];

/** PNG app icons for the install manifest, drawn in code: a gold ampersand on charcoal. */
export async function GET(_request: Request, context: RouteContext<"/icons/[size]">) {
  const size = Number((await context.params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15171C",
          color: "#F2B544",
          fontSize: size * 0.7,
          fontWeight: 800,
        }}
      >
        &amp;
      </div>
    ),
    { width: size, height: size },
  );
}
