import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/login", "/profile"],
    },
    sitemap: "https://novel-tribe.com/sitemap.xml",
    host: "https://novel-tribe.com",
  };
}