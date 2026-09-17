"use client";

import { useEffect, useRef } from "react";

const bookmarkletCode = `javascript:(function(){
  let books = [];
  document.querySelectorAll('div').forEach(el => {
    let text = el.innerText || "";
    if (text.includes('Acquired on')) {
      let lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
      let acquiredLineIndex = lines.findIndex(l => l.startsWith('Acquired on'));
      if (acquiredLineIndex >= 2) {
        let title = lines[acquiredLineIndex - 2];
        let author = lines[acquiredLineIndex - 1];
        let acquired = lines[acquiredLineIndex];
        if (title === 'SAMPLE') {
          title = author;
          author = lines[acquiredLineIndex];
        }
        let htmlContent = el.outerHTML || "";
        let readStatus = "Unknown";
        if (text.includes("Mark as Read") || htmlContent.includes("Mark as Read")) {
          readStatus = "Unread";
        } else if (text.includes("Mark as Unread") || htmlContent.includes("Mark as Unread")) {
          readStatus = "Read";
        }
        if (!books.some(b => b.title === title && b.acquired === acquired)) {
          books.push({ title, author, acquired, readStatus });
        }
      }
    }
  });
  if (books.length === 0) {
    alert("No books found. Make sure you are on the 'Books' tab of Manage Your Content and Devices.");
    return;
  }
  let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(books, null, 2));
  let downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "kindle_library.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
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
