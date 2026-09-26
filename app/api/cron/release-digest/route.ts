import { buildAmazonBookUrl } from "@/lib/affiliate";
import { authorizeCron } from "@/lib/cron";
import { resolveFeatureFlags } from "@/lib/featureFlags";
import { supabaseAdmin } from "@/lib/server";

export const maxDuration = 60;

const DIGEST_SENDER = "NovelTribe <noreply@novel-tribe.com>";
const USERS_PER_RUN = 50;

type AlertRow = {
  book_key: string;
  title: string;
  author: string;
  detail: string;
  isbn: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildDigest(alerts: AlertRow[]) {
  const associateTag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ?? "noveltribe-20";
  const items = alerts.map((alert) => {
    const buyUrl = buildAmazonBookUrl({ title: alert.title, author: alert.author, isbn: alert.isbn, associateTag });
    return {
      text: `- ${alert.title} by ${alert.author}\n  ${alert.detail}\n  ${buyUrl}`,
      html: `<li style="margin-bottom:16px"><strong>${escapeHtml(alert.title)}</strong> by ${escapeHtml(alert.author)}<br><span style="color:#555">${escapeHtml(alert.detail)}</span><br><a href="${escapeHtml(buyUrl)}">View on Amazon</a></li>`,
    };
  });

  const footerText = "You're receiving this because you turned on the weekly release email in your NovelTribe profile. Turn it off anytime at https://novel-tribe.com/profile.";
  return {
    subject: alerts.length === 1 ? `New release: ${alerts[0].title}` : `${alerts.length} new releases from your authors and series`,
    text: `New releases for you this week:\n\n${items.map((item) => item.text).join("\n\n")}\n\n${footerText}`,
    html: `<div style="font-family:Georgia,serif;max-width:560px"><h2>New releases for you this week</h2><ul style="padding-left:18px">${items.map((item) => item.html).join("")}</ul><p style="font-size:12px;color:#777">${escapeHtml(footerText)}</p></div>`,
  };
}

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;
  if (!supabaseAdmin) return Response.json({ error: "Service role is not configured" }, { status: 503 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return Response.json({ error: "RESEND_API_KEY is not configured" }, { status: 503 });

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, feature_flags")
    .eq("feature_flags->>release_email_digest", "true")
    .limit(USERS_PER_RUN);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let emailsSent = 0;
  let failures = 0;

  for (const profile of profiles ?? []) {
    // The digest only makes sense while in-app alerts are also on.
    if (!resolveFeatureFlags(profile.feature_flags).release_alerts) continue;

    const { data: alerts } = await supabaseAdmin
      .from("release_alerts")
      .select("book_key, title, author, detail, isbn")
      .eq("user_id", profile.id)
      .is("emailed_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (!alerts || alerts.length === 0) continue;

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    const email = userData?.user?.email;
    if (!email) continue;

    const digest = buildDigest(alerts as AlertRow[]);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: DIGEST_SENDER, to: [email], subject: digest.subject, text: digest.text, html: digest.html }),
    });

    if (!response.ok) {
      failures += 1;
      continue;
    }

    await supabaseAdmin
      .from("release_alerts")
      .update({ emailed_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .in("book_key", alerts.map((alert) => alert.book_key));
    emailsSent += 1;
  }

  return Response.json({ emailsSent, failures });
}
