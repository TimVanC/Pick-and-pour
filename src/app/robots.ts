import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Keep the app itself (bartender app, TV board, guest links) out of search.
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api/", "/tv/", "/p/"] },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
