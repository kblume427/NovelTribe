"use client";

import { useEffect, useRef } from "react";

const bookmarkletCode = `javascript:(function(){
  const books = [];
  document.querySelectorAll("div").forEach((element) => {
    const text = element.innerText || "";
    if (!text.includes("Acquired on")) return;
    const lines = text.split("\\n").map((line) => line.trim()).filter(Boolean);
    const acquiredIndex = lines.findIndex((line) => line.startsWith("Acquired on"));
    if (acquiredIndex < 2) return;
    let title = lines[acquiredIndex - 2];
    let author = lines[acquiredIndex - 1];
    const acquired = lines[acquiredIndex];
    if (title === "SAMPLE") {
      title = author;
      author = lines[acquiredIndex];
    }
    const html = element.outerHTML || "";
    const readStatus = text.includes("Mark as Unread") || html.includes("Mark as Unread") ? "Read" : "Unread";
    if (!books.some((book) => book.title === title && book.acquired === acquired)) {
      books.push({ title, author, acquired, readStatus });
    }
  });
  if (!books.length) {
    alert("No Kindle books found. Open Amazon Content and Devices, choose Books, and try again.");
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(books, null, 2));
  anchor.download = "kindle_library.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
})();`;

export default function KindleExportLink() {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (linkRef.current) linkRef.current.href = bookmarkletCode;
  }, []);

  return (
    <a
      ref={linkRef}
      href="#"
      onClick={(event) => event.preventDefault()}
      className="inline-flex cursor-grab items-center rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-3 text-sm font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110 active:cursor-grabbing"
    >
      Drag this to your bookmarks bar
    </a>
  );
}
