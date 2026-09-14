export type ReadingSession = {
  id: string;
  user_id: string;
  book_id: string | null;
  duration_minutes: number | null;
  pages_read: number | null;
  notes: string | null;
  session_date: string;
  created_at: string;
};

export function calculateStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const uniqueDates = Array.from(new Set(dates.map((d) => d.slice(0, 10)))).sort().reverse();
  if (!uniqueDates.length) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const mostRecent = uniqueDates[0];
  if (mostRecent !== today && mostRecent !== yesterday) {
    return 0;
  }

  let streak = 0;
  let expectedTime = new Date(mostRecent + "T00:00:00Z").getTime();

  for (const dateStr of uniqueDates) {
    const curTime = new Date(dateStr + "T00:00:00Z").getTime();
    const diffDays = Math.round((expectedTime - curTime) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      streak++;
      expectedTime = curTime - 86400000;
    } else {
      break;
    }
  }

  return streak;
}
