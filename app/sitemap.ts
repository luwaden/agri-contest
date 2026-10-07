import type { MetadataRoute } from "next";
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/apply", "/mentors", "/privacy", "/terms"].map((p) => ({ url: `${site()}${p}`, lastModified: now, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.7 }));
}
