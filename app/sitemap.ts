import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: "https://novel-tribe.com", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://novel-tribe.com/features", lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: "https://novel-tribe.com/getting-started", lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://novel-tribe.com/updates", lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: "https://novel-tribe.com/about", lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: "https://novel-tribe.com/recommendations", lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: "https://novel-tribe.com/reading", lastModified, changeFrequency: "weekly", priority: 0.7 },
  ];
}