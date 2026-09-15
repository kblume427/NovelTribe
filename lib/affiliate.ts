export function buildAmazonBookUrl(params: {
  title: string;
  author: string;
  isbn?: string | null;
  associateTag: string;
}): string {
  const identifier = params.isbn?.replace(/^isbn[:\s]*/i, "").replace(/[\s-]/g, "").trim();
  const query = identifier || `${params.title} ${params.author}`;

  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&i=stripbooks&tag=${encodeURIComponent(params.associateTag)}`;
}
