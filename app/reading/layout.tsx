import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Currently Reading",
  description: "Keep track of the books you are reading right now with NovelTribe.",
  alternates: { canonical: "/reading" },
};

export default function ReadingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}