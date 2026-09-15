/**
 * Utility functions for resolving, sanitizing, and upgrading book cover artwork.
 */

/**
 * Sanitizes and upgrades cover image URLs to HTTPS and maximum resolution.
 */
export function sanitizeCoverUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let cleanUrl = url.trim();
  if (!cleanUrl) return null;

  // Enforce HTTPS
  if (cleanUrl.startsWith("http://")) {
    cleanUrl = cleanUrl.replace(/^http:\/\//i, "https://");
  }

  // Google Books upgrades
  if (cleanUrl.includes("books.google.com") || cleanUrl.includes("googleusercontent.com")) {
    cleanUrl = cleanUrl.replace(/&edge=curl/g, "");
    // Upgrade tiny zoom levels to high-res zoom
    if (cleanUrl.includes("zoom=5") || cleanUrl.includes("zoom=1")) {
      cleanUrl = cleanUrl.replace(/zoom=[15]/, "zoom=2");
    }
  }

  // Open Library resolution upgrade
  if (cleanUrl.includes("covers.openlibrary.org")) {
    cleanUrl = cleanUrl.replace(/-[SM]\.jpg/i, "-L.jpg");
  }

  return cleanUrl;
}

/**
 * Normalizes an ISBN string to pure alphanumeric digits.
 */
export function normalizeIsbn(isbn: string | null | undefined): string | null {
  if (!isbn || typeof isbn !== "string") return null;
  const cleaned = isbn.replace(/^isbn[:\s]*/i, "").replace(/[\s-]/g, "").toUpperCase();
  if (/^(?:\d{9}[\dXx]|\d{13})$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Checks if a remote image URL exists (returns HTTP 200).
 */
export async function checkImageExists(url: string, timeoutMs = 3500): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "NovelTribe/1.0 (https://novel-tribe.com; contact@novel-tribe.com)",
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * High-res cover resolution waterfall:
 * 1. Open Library Direct ISBN CDN (fast, high-resolution)
 * 2. Open Library Title & Author Search (work cover_i / edition ISBN)
 * 3. Google Books Volume Search (tertiary fallback)
 */
export async function resolveCoverUrl(params: {
  isbn?: string | null;
  title?: string;
  author?: string;
}): Promise<string | null> {
  const cleanIsbn = normalizeIsbn(params.isbn);

  // 1. Try Direct Open Library ISBN CDN
  if (cleanIsbn) {
    const directIsbnUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
    const exists = await checkImageExists(`${directIsbnUrl}?default=false`, 3000);
    if (exists) {
      return directIsbnUrl;
    }
  }

  // 2. Try Open Library Search with Title and Author
  if (params.title) {
    try {
      const olUrl = new URL("https://openlibrary.org/search.json");
      olUrl.searchParams.set("title", params.title);
      if (params.author) olUrl.searchParams.set("author", params.author);
      olUrl.searchParams.set("fields", "cover_i,isbn");
      olUrl.searchParams.set("limit", "3");

      const olRes = await fetch(olUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });

      if (olRes.ok) {
        const olData = (await olRes.json()) as {
          docs?: Array<{ cover_i?: number; isbn?: string[] }>;
        };
        const docs = olData.docs || [];
        for (const doc of docs) {
          if (doc.cover_i) {
            return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          }
          if (doc.isbn && doc.isbn.length > 0) {
            for (const docIsbn of doc.isbn.slice(0, 3)) {
              const cleanedDocIsbn = normalizeIsbn(docIsbn);
              if (cleanedDocIsbn) {
                const docUrl = `https://covers.openlibrary.org/b/isbn/${cleanedDocIsbn}-L.jpg`;
                const exists = await checkImageExists(`${docUrl}?default=false`, 2500);
                if (exists) return docUrl;
              }
            }
          }
        }
      }
    } catch {
      // Continue to Google Books fallback
    }
  }

  // 3. Fallback to Google Books Search
  const searchQuery = cleanIsbn
    ? `isbn:${cleanIsbn}`
    : params.title && params.author
    ? `${params.title} ${params.author}`
    : params.title;

  if (searchQuery) {
    try {
      const gbUrl = new URL("https://www.googleapis.com/books/v1/volumes");
      gbUrl.searchParams.set("q", searchQuery);
      gbUrl.searchParams.set("maxResults", "3");
      gbUrl.searchParams.set("printType", "books");
      if (process.env.GOOGLE_BOOKS_API_KEY) {
        gbUrl.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
      }

      const gbRes = await fetch(gbUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });

      if (gbRes.ok) {
        const gbData = (await gbRes.json()) as {
          items?: Array<{
            volumeInfo?: {
              imageLinks?: {
                extraLarge?: string;
                large?: string;
                medium?: string;
                thumbnail?: string;
                smallThumbnail?: string;
              };
            };
          }>;
        };

        for (const item of gbData.items || []) {
          const links = item.volumeInfo?.imageLinks;
          const rawUrl = links?.extraLarge || links?.large || links?.medium || links?.thumbnail || links?.smallThumbnail;
          if (rawUrl) {
            const sanitized = sanitizeCoverUrl(rawUrl);
            if (sanitized) return sanitized;
          }
        }
      }
    } catch {
      // Return null if all failed
    }
  }

  return null;
}
