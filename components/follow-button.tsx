"use client";

import { useEffect, useState } from "react";

import { trackEvent } from "@/lib/analytics";

export default function FollowButton({ username }: { username: string }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    fetch(`/api/follows?username=${encodeURIComponent(username)}`)
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        setSignedIn(true);
        setFollowing(Boolean(payload.following));
      })
      .finally(() => setLoading(false));
  }, [username]);

  const toggleFollow = async () => {
    setLoading(true);
    const response = await fetch("/api/follows", {
      method: following ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (response.ok) {
      const nextFollowing = !following;
      setFollowing(nextFollowing);
      trackEvent(nextFollowing ? "user_followed" : "user_unfollowed");
    }
    setLoading(false);
  };

  if (!signedIn) return null;

  return (
    <button
      type="button"
      onClick={() => void toggleFollow()}
      disabled={loading}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        following
          ? "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          : "bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/20 hover:brightness-110"
      }`}
    >
      {loading ? "..." : following ? "Following" : "Follow"}
    </button>
  );
}
