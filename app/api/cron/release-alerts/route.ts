import { authorizeCron } from "@/lib/cron";
import { getFavoriteAuthors, getSeriesInProgress, type BookRecord } from "@/lib/recommendations";
import {
  authorQuery,
  fetchNewestVolumes,
  releaseBookKey,
  selectAuthorReleases,
  selectSeriesReleases,
  seriesQuery,
  type ReleaseCandidate,
  type ReleaseVolume,
} from "@/lib/releases";
import { supabaseAdmin } from "@/lib/server";

export const maxDuration = 60;

const USERS_PER_RUN = 25;
const LOOKUP_BUDGET = 80;
const ACTIVE_WINDOW_DAYS = 30;
const RELEASE_WINDOW_DAYS = 30;
const MAX_ALERTS_PER_USER = 5;

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;
  if (!supabaseAdmin) return Response.json({ error: "Service role is not configured" }, { status: 503 });

  const now = new Date();
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("feature_flags->>release_alerts", "true")
    .gte("last_active_at", activeSince)
    .order("release_checked_at", { ascending: true, nullsFirst: true })
    .limit(USERS_PER_RUN);

  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });

  const lookupCache = new Map<string, ReleaseVolume[]>();
  let lookupsUsed = 0;
  let stopReason: string | null = null;

  async function lookup(query: string) {
    const cached = lookupCache.get(query);
    if (cached) return cached;
    if (lookupsUsed >= LOOKUP_BUDGET) throw new Error("lookup budget exhausted");
    lookupsUsed += 1;
    const volumes = await fetchNewestVolumes(query);
    lookupCache.set(query, volumes);
    return volumes;
  }

  let usersChecked = 0;
  let alertsCreated = 0;

  for (const profile of profiles ?? []) {
    const { data: books } = await supabaseAdmin
      .from("books")
      .select("title, author, genre, status, rating")
      .eq("user_id", profile.id);
    const library = (books ?? []) as BookRecord[];

    const candidates: ReleaseCandidate[] = [];
    try {
      for (const progress of getSeriesInProgress(library)) {
        candidates.push(...selectSeriesReleases(progress, await lookup(seriesQuery(progress)), now, RELEASE_WINDOW_DAYS));
      }
      for (const favorite of getFavoriteAuthors(library)) {
        candidates.push(...selectAuthorReleases(favorite, await lookup(authorQuery(favorite)), now, RELEASE_WINDOW_DAYS));
      }
    } catch (error) {
      stopReason = error instanceof Error ? error.message : "lookup failed";
      break;
    }

    const ownedKeys = new Set(library.map((book) => releaseBookKey(book.title, book.author)));
    const unique = new Map<string, ReleaseCandidate>();
    candidates.forEach((candidate) => {
      if (!ownedKeys.has(candidate.bookKey) && !unique.has(candidate.bookKey)) unique.set(candidate.bookKey, candidate);
    });

    let fresh: ReleaseCandidate[] = [];
    if (unique.size > 0) {
      const { data: existing } = await supabaseAdmin
        .from("release_alerts")
        .select("book_key")
        .eq("user_id", profile.id)
        .in("book_key", [...unique.keys()]);
      const alreadyAlerted = new Set((existing ?? []).map((row) => row.book_key));
      // Series continuations first, since those are the most wanted.
      fresh = [...unique.values()]
        .filter((candidate) => !alreadyAlerted.has(candidate.bookKey))
        .sort((a, b) => (a.source === b.source ? 0 : a.source === "series" ? -1 : 1))
        .slice(0, MAX_ALERTS_PER_USER);
    }

    if (fresh.length > 0) {
      const { error: alertError } = await supabaseAdmin.from("release_alerts").upsert(
        fresh.map((candidate) => ({
          user_id: profile.id,
          book_key: candidate.bookKey,
          title: candidate.title,
          author: candidate.author,
          source: candidate.source,
          detail: candidate.detail,
          published_date: candidate.publishedDate,
          isbn: candidate.isbn,
          cover_url: candidate.coverUrl,
        })),
        { onConflict: "user_id,book_key", ignoreDuplicates: true },
      );

      if (!alertError) {
        await supabaseAdmin.from("notifications").insert(
          fresh.map((candidate) => ({
            recipient_id: profile.id,
            type: "release",
            message: `New release: ${candidate.title} by ${candidate.author}. ${candidate.detail}.`,
            metadata: {
              title: candidate.title,
              author: candidate.author,
              isbn: candidate.isbn,
              cover_url: candidate.coverUrl,
              detail: candidate.detail,
            },
          })),
        );
        alertsCreated += fresh.length;
      }
    }

    await supabaseAdmin.from("profiles").update({ release_checked_at: now.toISOString() }).eq("id", profile.id);
    usersChecked += 1;
  }

  return Response.json({ usersChecked, alertsCreated, lookupsUsed, stopReason });
}
