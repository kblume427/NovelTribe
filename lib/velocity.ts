import type { ReadingSession } from "@/lib/sessions";

export type VelocityEstimate = {
  progressPercent: number;
  remainingPages: number;
  daysToFinish: number;
  estimatedFinishDate: string;
  dailyPace: number;
};

/**
 * Calculates average pages read per active day from recent reading sessions.
 * Falls back to 25 pages/day if insufficient session data is available.
 */
export function calculateDailyPace(sessions: ReadingSession[]): number {
  if (!sessions || sessions.length === 0) return 25;

  const validSessions = sessions.filter((s) => s.pages_read && s.pages_read > 0);
  if (validSessions.length === 0) return 25;

  // Group pages by unique session_date
  const pagesByDate = new Map<string, number>();
  for (const s of validSessions) {
    const d = s.session_date.slice(0, 10);
    pagesByDate.set(d, (pagesByDate.get(d) ?? 0) + (s.pages_read ?? 0));
  }

  const activeDays = pagesByDate.size;
  if (activeDays === 0) return 25;

  const totalPages = Array.from(pagesByDate.values()).reduce((sum, p) => sum + p, 0);
  const avg = Math.round(totalPages / activeDays);
  return Math.max(5, avg);
}

/**
 * Calculates progress and estimated finish date for a book given page tracking.
 */
export function estimateBookCompletion(
  currentPage: number | null | undefined,
  totalPages: number | null | undefined,
  dailyPace: number,
): VelocityEstimate | null {
  if (!totalPages || totalPages <= 0) return null;
  const current = Math.max(0, currentPage ?? 0);
  if (current >= totalPages) {
    return {
      progressPercent: 100,
      remainingPages: 0,
      daysToFinish: 0,
      estimatedFinishDate: "Completed",
      dailyPace,
    };
  }

  const remaining = totalPages - current;
  const progressPercent = Math.min(99, Math.round((current / totalPages) * 100));
  const daysToFinish = Math.max(1, Math.ceil(remaining / Math.max(1, dailyPace)));

  const finishDate = new Date(Date.now() + daysToFinish * 86400000);
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(finishDate);

  return {
    progressPercent,
    remainingPages: remaining,
    daysToFinish,
    estimatedFinishDate: formattedDate,
    dailyPace,
  };
}
