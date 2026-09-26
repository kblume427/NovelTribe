import { sanitizeCoverUrl } from "@/lib/covers";
import {
  extractSeries,
  normalizeTitle,
  stripSeriesSuffix,
  type FavoriteAuthor,
  type SeriesProgress,
} from "@/lib/recommendations";

export type ReleaseVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: Array<{ identifier?: string }>;
    seriesInfo?: { bookDisplayNumber?: string };
  };
};

export type ReleaseCandidate = {
  bookKey: string;
  title: string;
  author: string;
  source: "series" | "author";
  detail: string;
  publishedDate: string;
  isbn: string | null;
  coverUrl: string | null;
};

const EXCLUDED_EDITIONS = /box(ed)? set|collection|omnibus|sampler|summary|study guide|books? \d+\s*[-–]\s*\d+/i;

export function releaseBookKey(title: string, author: string) {
  const leadAuthor = author.split(/,|&| and /)[0].trim();
  return `${normalizeTitle(stripSeriesSuffix(title))}::${normalizeTitle(leadAuthor)}`;
}

// Year-only dates are too imprecise to call something a new release.
export function parsePublishedDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return null;
  const date = new Date(value.length === 7 ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isRecentRelease(publishedDate: string | undefined, now: Date, windowDays: number) {
  const published = parsePublishedDate(publishedDate);
  if (!published) return false;
  const ageDays = (now.getTime() - published.getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays <= windowDays;
}

function authorMatches(authors: string[] | undefined, author: string) {
  const target = author.split(/,|&| and /)[0].trim().toLowerCase();
  return Boolean(authors?.some((name) => name.toLowerCase() === target));
}

function toCandidate(volume: ReleaseVolume, source: ReleaseCandidate["source"], detail: string): ReleaseCandidate {
  const info = volume.volumeInfo!;
  return {
    bookKey: releaseBookKey(info.title!, info.authors!.join(", ")),
    title: info.title!,
    author: info.authors!.join(", "),
    source,
    detail,
    publishedDate: info.publishedDate!,
    isbn: info.industryIdentifiers?.find((identifier) => identifier.identifier)?.identifier ?? null,
    coverUrl: sanitizeCoverUrl(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null),
  };
}

function usableVolumes(volumes: ReleaseVolume[], author: string, now: Date, windowDays: number) {
  return volumes.filter((volume) => {
    const info = volume.volumeInfo;
    return (
      info?.title &&
      authorMatches(info.authors, author) &&
      !EXCLUDED_EDITIONS.test(`${info.title} ${info.subtitle ?? ""}`) &&
      isRecentRelease(info.publishedDate, now, windowDays)
    );
  });
}

export function selectSeriesReleases(progress: SeriesProgress, volumes: ReleaseVolume[], now: Date, windowDays: number) {
  return usableVolumes(volumes, progress.author, now, windowDays)
    .map((volume) => {
      const displayNumber = Number(volume.volumeInfo?.seriesInfo?.bookDisplayNumber);
      const number = Number.isFinite(displayNumber) && displayNumber > 0 ? displayNumber : extractSeries(volume.volumeInfo!.title!)?.number;
      return { volume, number };
    })
    .filter(({ number }) => typeof number === "number" && number > progress.highestNumber)
    .map(({ volume, number }) =>
      toCandidate(volume, "series", `Book ${number} in the ${progress.series} series (you've read through #${progress.highestNumber})`),
    );
}

export function selectAuthorReleases(favorite: FavoriteAuthor, volumes: ReleaseVolume[], now: Date, windowDays: number) {
  return usableVolumes(volumes, favorite.author, now, windowDays).map((volume) =>
    toCandidate(volume, "author", `A new book from ${favorite.author}, an author you rate highly`),
  );
}

export async function fetchNewestVolumes(query: string): Promise<ReleaseVolume[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("orderBy", "newest");
  url.searchParams.set("maxResults", "20");
  url.searchParams.set("printType", "books");
  url.searchParams.set("langRestrict", "en");
  if (process.env.GOOGLE_BOOKS_API_KEY) url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (response.status === 429) throw new Error("Google Books rate limit reached");
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.items ?? []) as ReleaseVolume[];
}

export function seriesQuery(progress: SeriesProgress) {
  const surname = progress.author.split(/[\s,]+/).filter(Boolean).pop() ?? progress.author;
  return `intitle:"${progress.series}" inauthor:${surname}`;
}

export function authorQuery(favorite: FavoriteAuthor) {
  return `inauthor:"${favorite.author}"`;
}
