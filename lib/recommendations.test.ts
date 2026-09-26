import { describe, expect, it } from "vitest";
import { extractSeries, getFavoriteAuthors, getSeriesInProgress, stripSeriesSuffix, type BookRecord } from "@/lib/recommendations";

describe("extractSeries", () => {
  it("parses Goodreads-style series suffixes", () => {
    expect(extractSeries("The Fellowship of the Ring (The Lord of the Rings, #1)")).toEqual({ series: "The Lord of the Rings", number: 1 });
    expect(extractSeries("Iron Flame (The Empyrean #2)")).toEqual({ series: "The Empyrean", number: 2 });
  });

  it("parses Kindle-style 'Book N' and volume suffixes", () => {
    expect(extractSeries("Ashes of the Dark (Shadow Court Book 3)")).toEqual({ series: "Shadow Court", number: 3 });
    expect(extractSeries("Fated (Moonlit Wolves, Book 2)")).toEqual({ series: "Moonlit Wolves", number: 2 });
    expect(extractSeries("Ember (Sky Isles, Vol. 4)")).toEqual({ series: "Sky Isles", number: 4 });
  });

  it("uses the last number of a range", () => {
    expect(extractSeries("Edge of Collapse Boxset (Edge of Collapse, #1-7)")).toEqual({ series: "Edge of Collapse", number: 7 });
  });

  it("returns null for standalone titles", () => {
    expect(extractSeries("Project Hail Mary")).toBeNull();
    expect(extractSeries("The Women (A Novel)")).toBeNull();
  });
});

describe("stripSeriesSuffix", () => {
  it("removes only the series suffix", () => {
    expect(stripSeriesSuffix("Iron Flame (The Empyrean #2)")).toBe("Iron Flame");
    expect(stripSeriesSuffix("The Women (A Novel)")).toBe("The Women (A Novel)");
  });
});

describe("getSeriesInProgress", () => {
  const book = (title: string, status: BookRecord["status"], rating = 0): BookRecord => ({
    id: title,
    title,
    author: "Rebecca Yarros",
    genre: "Romantasy",
    status,
    rating,
  });

  it("tracks the highest number read per series and ignores Want to Read", () => {
    const progress = getSeriesInProgress([
      book("Fourth Wing (The Empyrean #1)", "Read", 5),
      book("Iron Flame (The Empyrean #2)", "Currently Reading"),
      book("Onyx Storm (The Empyrean #3)", "Want to Read"),
    ]);
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ series: "The Empyrean", highestNumber: 2, booksRead: 2 });
  });
});

describe("getFavoriteAuthors", () => {
  const book = (author: string, rating: number, status: BookRecord["status"] = "Read"): BookRecord => ({
    id: `${author}-${rating}-${Math.random()}`,
    title: "Some Book",
    author,
    genre: "Thriller",
    status,
    rating,
  });

  it("ranks authors by number of highly rated reads, then average rating", () => {
    const authors = getFavoriteAuthors([
      book("Freida McFadden", 5),
      book("Freida McFadden", 4),
      book("Riley Sager", 5),
      book("Lisa Jewell", 3),
      book("Colleen Hoover", 5, "Want to Read"),
    ]);
    expect(authors.map((entry) => entry.author)).toEqual(["Freida McFadden", "Riley Sager"]);
    expect(authors[0].highlyRatedCount).toBe(2);
  });

  it("credits the lead author on co-authored books and skips unknown authors", () => {
    const authors = getFavoriteAuthors([book("Jonathan Maas, Patty Ann Economos", 5), book("Unknown author", 5)]);
    expect(authors.map((entry) => entry.author)).toEqual(["Jonathan Maas"]);
  });
});
