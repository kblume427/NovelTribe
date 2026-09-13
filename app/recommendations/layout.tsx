import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Recommendations",
  description: "Discover personalized book recommendations based on your reading history, ratings, and favorite categories.",
  alternates: { canonical: "/recommendations" },
  openGraph: {
    title: "Book Recommendations | NovelTribe",
    description: "Discover your next favorite book with NovelTribe.",
    url: "https://novel-tribe.com/recommendations",
  },
};

export default function RecommendationsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}