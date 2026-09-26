import { describe, expect, it } from "vitest";
import {
  isRecentRelease,
  parsePublishedDate,
  releaseBookKey,
  selectAuthorReleases,
  selectSeriesReleases,
  type ReleaseVolume,
} from "@/lib/releases";

const now = new Date("2026-09-26T12:00:00Z");

function volume(title: string, publishedDate: string, authors = ["Rebecca Yarros"], bookDisplayNumber?: string): ReleaseVolume {
  return {
    id: title,
    volumeInfo: { title, authors, publishedDate, seriesInfo: bookDisplayNumber ? { bookDisplayNumber } : undefined },
  };
}

describe("parsePublishedDate / isRecentRelease", () => {
  it("accepts full and month-precision dates but rejects year-only dates", () => {
    expect(parsePublishedDate("2026-09-10")).not.toBeNull();
    expect(parsePublishedDate("2026-09")).not.toBeNull();
    expect(parsePublishedDate("2026")).toBeNull();
    expect(parsePublishedDate(undefined)).toBeNull();
  });

  it("treats only past dates within the window as recent", () => {
    expect(isRecentRelease("2026-09-10", now, 30)).toBe(true);
    expect(isRecentRelease("2026-07-01", now, 30)).toBe(false);
    expect(isRecentRelease("2026-12-01", now, 30)).toBe(false);
  });
});

describe("selectSeriesReleases", () => {
  const progress = { series: "The Empyrean", author: "Rebecca Yarros", highestNumber: 2, booksRead: 2, genre: "Romantasy" };

  it("alerts only on recent books numbered after what the reader has finished", () => {
    const releases = selectSeriesReleases(
      progress,
      [
        volume("Onyx Storm", "2026-09-15", ["Rebecca Yarros"], "3"),
        volume("Iron Flame", "2026-09-15", ["Rebecca Yarros"], "2"),
        volume("Old Book (The Empyrean #4)", "2025-01-01"),
      ],
      now,
      30,
    );
    expect(releases.map((release) => release.title)).toEqual(["Onyx Storm"]);
    expect(releases[0].source).toBe("series");
    expect(releases[0].detail).toContain("Book 3");
  });

  it("skips box sets and books by other authors", () => {
    const releases = selectSeriesReleases(
      progress,
      [volume("The Empyrean Boxed Set", "2026-09-15", ["Rebecca Yarros"], "3"), volume("Onyx Storm", "2026-09-15", ["Someone Else"], "3")],
      now,
      30,
    );
    expect(releases).toEqual([]);
  });
});

describe("selectAuthorReleases", () => {
  it("returns recent books by the favorite author", () => {
    const releases = selectAuthorReleases(
      { author: "Freida McFadden", highlyRatedCount: 3, averageRating: 4.7, genre: "Thriller" },
      [volume("The Tenant", "2026-09-20", ["Freida McFadden"]), volume("The Housemaid", "2022-04-26", ["Freida McFadden"])],
      now,
      30,
    );
    expect(releases.map((release) => release.title)).toEqual(["The Tenant"]);
    expect(releases[0].source).toBe("author");
  });
});

describe("releaseBookKey", () => {
  it("matches the same book regardless of series suffix or co-authors", () => {
    expect(releaseBookKey("Onyx Storm (The Empyrean #3)", "Rebecca Yarros")).toBe(releaseBookKey("Onyx Storm", "Rebecca Yarros, Someone Else"));
  });
});
