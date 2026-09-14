import type { BookRecord } from "@/lib/recommendations";

export type Milestone = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progressText: string;
};

export function evaluateMilestones(
  books: BookRecord[],
  streak: number = 0,
  readingGoal: number | null = null,
): Milestone[] {
  const totalBooks = books.length;
  const finishedBooks = books.filter((b) => b.status === "Read");
  const finishedCount = finishedBooks.length;
  const reviewedCount = books.filter((b) => b.review && b.review.trim().length > 0).length;
  const fiveStarCount = books.filter((b) => b.rating === 5).length;

  const finishedGenres = new Set(finishedBooks.map((b) => b.genre).filter(Boolean));
  const uniqueFormats = new Set(books.map((b) => b.format).filter(Boolean));

  const totalQuotes = books.reduce((sum, b) => sum + (Array.isArray(b.quotes) ? b.quotes.length : 0), 0);

  return [
    {
      id: "first_book",
      title: "First Step",
      description: "Added your first book to NovelTribe",
      icon: "🌱",
      unlocked: totalBooks >= 1,
      progressText: totalBooks >= 1 ? "Completed" : "0/1 book",
    },
    {
      id: "first_review",
      title: "Reviewer",
      description: "Wrote a review sharing your thoughts",
      icon: "✍️",
      unlocked: reviewedCount >= 1,
      progressText: reviewedCount >= 1 ? "Completed" : "0/1 review",
    },
    {
      id: "five_star",
      title: "Found a Gem",
      description: "Awarded a 5-star rating to a book",
      icon: "⭐",
      unlocked: fiveStarCount >= 1,
      progressText: fiveStarCount >= 1 ? "Completed" : "0/1 rating",
    },
    {
      id: "finished_5",
      title: "Page Turner",
      description: "Finished reading 5 books",
      icon: "📚",
      unlocked: finishedCount >= 5,
      progressText: `${Math.min(5, finishedCount)}/5 finished`,
    },
    {
      id: "finished_10",
      title: "Bibliophile",
      description: "Finished reading 10 books",
      icon: "🏆",
      unlocked: finishedCount >= 10,
      progressText: `${Math.min(10, finishedCount)}/10 finished`,
    },
    {
      id: "genre_explorer",
      title: "Genre Explorer",
      description: "Read books across 3 different genres",
      icon: "🧭",
      unlocked: finishedGenres.size >= 3,
      progressText: `${Math.min(3, finishedGenres.size)}/3 genres`,
    },
    {
      id: "streak_3",
      title: "Daily Reader",
      description: "Achieved a 3-day reading streak",
      icon: "🔥",
      unlocked: streak >= 3,
      progressText: `${Math.min(3, streak)}/3 days`,
    },
    {
      id: "streak_7",
      title: "Habit Master",
      description: "Achieved a 7-day reading streak",
      icon: "⚡",
      unlocked: streak >= 7,
      progressText: `${Math.min(7, streak)}/7 days`,
    },
    {
      id: "multi_format",
      title: "Format Flexible",
      description: "Logged books across 2+ formats (Physical, E-Book, Audio)",
      icon: "🎧",
      unlocked: uniqueFormats.size >= 2,
      progressText: `${Math.min(2, uniqueFormats.size)}/2 formats`,
    },
    {
      id: "quote_collector",
      title: "Quote Collector",
      description: "Saved 3 memorable quotes from your reads",
      icon: "💬",
      unlocked: totalQuotes >= 3,
      progressText: `${Math.min(3, totalQuotes)}/3 quotes`,
    },
    ...(readingGoal && readingGoal > 0
      ? [
          {
            id: "goal_achieved",
            title: "Goal Crusher",
            description: `Hit your annual reading goal of ${readingGoal} books`,
            icon: "🎯",
            unlocked: finishedCount >= readingGoal,
            progressText: `${Math.min(readingGoal, finishedCount)}/${readingGoal} books`,
          },
        ]
      : []),
  ];
}
