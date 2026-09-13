import { buildHeuristicRecommendations, type BookRecord } from "@/lib/recommendations";
import { openai } from "@/lib/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    books?: BookRecord[];
    exploreGenre?: string;
  };

  const books = body.books ?? [];
  const exploreGenre = body.exploreGenre ?? "Adventure";

  if (openai) {
    try {
      const prompt = [
        "You are building a reading recommendation engine for a book tracker.",
        "Return JSON only with an array of 4 objects. Each object should include title, author, genre, score, and reason.",
        `The user has read these books: ${JSON.stringify(books)}`,
        `The user wants to explore the genre: ${exploreGenre}`,
        "Priority should be books that match their tastes and also expand them into the chosen genre.",
      ].join(" ");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const raw = completion.choices[0]?.message?.content ?? "[]";
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return Response.json({ recommendations: parsed });
      }
    } catch (error) {
      console.warn("OpenAI recommendation fetch failed, using local fallback", error);
    }
  }

  return Response.json({
    recommendations: buildHeuristicRecommendations(books, exploreGenre),
  });
}
