"use client";

import { useEffect, useState } from "react";

type Profile = { username: string; full_name: string | null; avatar_url: string | null };
type Notification = { id: string; message: string; read_at: string | null; created_at: string };

export default function SocialInbox() {
  const [tab, setTab] = useState<"followers" | "following">("followers");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch(`/api/social?type=${tab}`).then((response) => response.json()).then((payload) => setProfiles(payload.profiles ?? []));
  }, [tab]);

  useEffect(() => {
    fetch("/api/notifications").then((response) => response.json()).then((payload) => {
      setNotifications(payload.notifications ?? []);
      setUnread(payload.unread ?? 0);
    });
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    setUnread(0);
  };

  return (
    <section className="mt-8 rounded-[30px] border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-xs uppercase tracking-[0.24em] text-cyan-200">Your community</div><h2 className="mt-2 text-2xl font-bold text-white">Connections and notifications</h2></div>
        {unread > 0 && <button type="button" onClick={() => void markAllRead()} className="text-sm text-cyan-200 hover:text-white">Mark all read ({unread})</button>}
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex gap-2"><button type="button" onClick={() => setTab("followers")} className={`rounded-full px-3 py-1.5 text-sm ${tab === "followers" ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-zinc-400"}`}>Followers</button><button type="button" onClick={() => setTab("following")} className={`rounded-full px-3 py-1.5 text-sm ${tab === "following" ? "bg-cyan-500/20 text-cyan-100" : "bg-white/5 text-zinc-400"}`}>Following</button></div>
          <div className="mt-3 space-y-2">{profiles.length === 0 ? <p className="text-sm text-zinc-500">No {tab} yet.</p> : profiles.map((profile) => <a key={profile.username} href={`/u/${encodeURIComponent(profile.username)}`} className="block rounded-xl border border-white/10 bg-[#0b1120] p-3 text-sm text-white hover:border-cyan-400/40">{profile.full_name || `@${profile.username}`} <span className="text-zinc-500">@{profile.username}</span></a>)}</div>
        </div>
        <div><div className="text-sm font-semibold text-white">Notifications</div><div className="mt-3 space-y-2">{notifications.length === 0 ? <p className="text-sm text-zinc-500">No notifications yet.</p> : notifications.map((item) => <div key={item.id} className={`rounded-xl border p-3 text-sm ${item.read_at ? "border-white/10 bg-[#0b1120] text-zinc-400" : "border-cyan-400/30 bg-cyan-500/10 text-cyan-50"}`}>{item.message}<div className="mt-1 text-xs text-zinc-500">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.created_at))}</div></div>)}</div></div>
      </div>
    </section>
  );
}
