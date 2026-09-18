import { describe, expect, it } from "vitest";
import {
  normalizeImportedGenre,
  normalizeImportedCategories,
  parseGoodreadsCSV,
  parseLibbyCSV,
  parseKindleJSON,
} from "@/lib/importExport";

describe("normalizeImportedGenre", () => {
  it("maps known keywords to canonical genres", () => {
    expect(normalizeImportedGenre(["Epic Fantasy"])).toBe("Fantasy");
    expect(normalizeImportedGenre(["Cozy Mystery"])).toBe("Mystery");
    expect(normalizeImportedGenre(["Sci-Fi"])).toBe("Science Fiction");
  });

  it("falls back to General Fiction when nothing matches", () => {
    expect(normalizeImportedGenre(["Periodicals"])).toBe("General Fiction");
    expect(normalizeImportedGenre([])).toBe("General Fiction");
  });
});

describe("normalizeImportedCategories", () => {
  it("splits, normalizes, and deduplicates delimited category strings", () => {
    const result = normalizeImportedCategories(["Fantasy, Fantasy", "Thriller"]);
    expect(result).toEqual(["Fantasy", "Thriller"]);
  });

  it("drops a bare 'Fiction' placeholder but keeps 'General Fiction' as Contemporary", () => {
    expect(normalizeImportedCategories(["Fiction"])).toEqual([]);
    expect(normalizeImportedCategories(["General Fiction"])).toEqual(["Contemporary"]);
  });
});

describe("parseGoodreadsCSV", () => {
  const header = "Title,Author,My Rating,Exclusive Shelf,ISBN13,Date Read,Binding";

  it("parses a read book with rating and ISBN", () => {
    const csv = [header, `"The Hobbit","J.R.R. Tolkien",5,read,"9780547928227","2024/01/15",Paperback`].join("\n");
    const [book] = parseGoodreadsCSV(csv);
    expect(book.title).toBe("The Hobbit");
    expect(book.author).toBe("J.R.R. Tolkien");
    expect(book.status).toBe("Read");
    expect(book.rating).toBe(5);
    expect(book.isbn).toBe("9780547928227");
    expect(book.finished_at).toBeTruthy();
  });

  it("maps currently-reading and to-read shelves", () => {
    const csv = [
      header,
      `"Book A","Author A",0,currently-reading,,,`,
      `"Book B","Author B",0,to-read,,,`,
    ].join("\n");
    const books = parseGoodreadsCSV(csv);
    expect(books[0].status).toBe("Currently Reading");
    expect(books[1].status).toBe("Want to Read");
  });

  it("returns an empty array when required columns are missing", () => {
    expect(parseGoodreadsCSV("Foo,Bar\n1,2")).toEqual([]);
  });
});

describe("parseLibbyCSV", () => {
  it("uses the latest activity event to determine status", () => {
    const csv = [
      "Title\tAuthor\tActivity\tDate",
      "Some Book\tSome Author\tBorrowed\t2024-01-01",
      "Some Book\tSome Author\tReturned\t2024-02-01",
    ].join("\n");
    const [book] = parseLibbyCSV(csv);
    expect(book.status).toBe("Read");
    expect(book.finished_at).toBeTruthy();
  });

  it("marks an active loan as Currently Reading", () => {
    const csv = [
      "Title\tAuthor\tActivity\tDate",
      "Loaned Book\tSome Author\tBorrowed\t2024-03-01",
    ].join("\n");
    const [book] = parseLibbyCSV(csv);
    expect(book.status).toBe("Currently Reading");
  });
});

describe("parseKindleJSON", () => {
  it("parses a bare array of Kindle books", () => {
    const json = JSON.stringify([
      { title: "Dune", author: "Frank Herbert", acquired: "Acquired on January 1, 2024", readStatus: "Read" },
    ]);
    const [book] = parseKindleJSON(json);
    expect(book.title).toBe("Dune");
    expect(book.status).toBe("Read");
    expect(book.format).toBe("E-Book");
    expect(book.custom_shelves).toEqual(["Kindle"]);
  });

  it("parses the { books: [...] } wrapper shape", () => {
    const json = JSON.stringify({ books: [{ title: "Foo", author: "Bar", readStatus: "Unread" }] });
    const [book] = parseKindleJSON(json);
    expect(book.status).toBe("Want to Read");
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseKindleJSON("not json")).toEqual([]);
  });
});
