import { NextResponse } from "next/server";

const feedbackRecipient = "kblume427@gmail.com";
const feedbackSender = "noreply@novel-tribe.com";
const allowedTypes = new Set(["Bug report", "Feature idea", "Import issue", "General feedback"]);

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Feedback service is not configured." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null) as {
    type?: string;
    message?: string;
    contact?: string;
  } | null;
  const type = payload?.type?.trim() ?? "";
  const message = payload?.message?.trim() ?? "";
  const contact = payload?.contact?.trim() ?? "";

  if (!allowedTypes.has(type) || !message || message.length > 4000) {
    return NextResponse.json({ error: "Please provide a feedback type and message." }, { status: 400 });
  }

  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return NextResponse.json({ error: "Please provide a valid reply-to email." }, { status: 400 });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `NovelTribe Feedback <${feedbackSender}>`,
      to: [feedbackRecipient],
      reply_to: contact || undefined,
      subject: `[NovelTribe] ${type}`,
      text: `${message}\n\nReply-to: ${contact || "Not provided"}`,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Feedback could not be sent. Please try again later." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
