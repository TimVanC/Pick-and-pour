import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Keep the app's private surfaces (TV board and guest links) out of search.
    rules: { userAgent: "*", allow: "/", disallow: ["/tv/", "/p/"] },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
