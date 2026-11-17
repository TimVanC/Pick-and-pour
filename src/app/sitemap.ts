import type { MetadataRoute } from "next";
import { site } from "@/content/site";

const paths = [
  "/",
  "/how-it-works",
  "/pricing",
  "/about",
  "/demo",
  "/faq",
  "/house-rules",
  "/terms",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({
    url: new URL(path, site.url).toString(),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path === "/demo" || path === "/pricing" ? 0.8 : 0.5,
  }));
}
