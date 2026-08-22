"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flame, Trophy, Target, Calendar } from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  backgroundColor: string | null;
  accentColor: string | null;
  discordAvatar: string | null;
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  createdAt: string;
  rank: number;
  progress: {
    solvedAt: string;
    dailyProblem: {
      tier: string;
      problem: { name: string; rating: number; tags: string[] };
    };
  }[];
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/users/${username}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setProfile)
      .catch(() => setError("User not found"))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-48 rounded-xl bg-gray-800" />
          <div className="h-8 w-48 rounded bg-gray-800" />
          <div className="h-4 w-32 rounded bg-gray-800" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">User not found</h1>
        <p className="text-gray-400 mb-4">No user with username &quot;{username}&quot;</p>
        <Link href="/" className="text-cyan-400 hover:text-cyan-300">
          Go home
        </Link>
      </div>
    );
  }

  const accent = profile.accentColor || "#22d3ee";
  const bg = profile.backgroundColor || "#030712";
  const avatar = profile.avatarUrl || profile.discordAvatar;

  const tierColors: Record<string, string> = {
    beginner: "bg-emerald-500/20 text-emerald-400",
    intermediate: "bg-blue-500/20 text-blue-400",
    advanced: "bg-orange-500/20 text-orange-400",
    expert: "bg-red-500/20 text-red-400",
  };

  const ratingColor = (r: number) => {
    if (r < 1200) return "text-gray-400";
    if (r < 1400) return "text-green-400";
    if (r < 1600) return "text-cyan-400";
    if (r < 1900) return "text-blue-400";
    if (r < 2100) return "text-purple-400";
    if (r < 2400) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      {/* Banner */}
      <div
        className="rounded-xl overflow-hidden mb-6 relative"
        style={{ backgroundColor: bg }}
      >
        {profile.bannerUrl ? (
          <img
            src={profile.bannerUrl}
            alt="Banner"
            className="w-full h-48 object-cover"
          />
        ) : (
          <div
            className="w-full h-48"
            style={{
              background: `linear-gradient(135deg, ${accent}22, ${accent}08)`,
            }}
          />
        )}
      </div>

      {/* Profile Header */}
      <div className="flex items-end gap-6 -mt-16 mb-8 relative z-10 px-4">
        <div
          className="w-28 h-28 rounded-full border-4 overflow-hidden flex-shrink-0"
          style={{ borderColor: bg, backgroundColor: "#1f2937" }}
        >
          {avatar ? (
            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500">
              {(profile.displayName || profile.username)[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="pb-1">
          <h1 className="text-2xl font-bold" style={{ color: accent }}>
            {profile.displayName || profile.username}
          </h1>
          <p className="text-gray-400">@{profile.username}</p>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-gray-300 mb-6 px-4 whitespace-pre-wrap">{profile.bio}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-center">
          <Trophy className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
          <p className="text-2xl font-bold">#{profile.rank}</p>
          <p className="text-xs text-gray-500">Rank</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-center">
          <Target className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
          <p className="text-2xl font-bold">{profile.totalSolved}</p>
          <p className="text-xs text-gray-500">Solved</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-center">
          <Flame className="w-5 h-5 mx-auto mb-1 text-orange-400" />
          <p className="text-2xl font-bold">{profile.currentStreak}</p>
          <p className="text-xs text-gray-500">Day Streak</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-center">
          <Calendar className="w-5 h-5 mx-auto mb-1 text-purple-400" />
          <p className="text-2xl font-bold">{profile.longestStreak}</p>
          <p className="text-xs text-gray-500">Best Streak</p>
        </div>
      </div>

      {/* Solved Problems */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 className="text-lg font-semibold mb-4">
          Recent Solves ({profile.progress.length})
        </h2>
        {profile.progress.length === 0 ? (
          <p className="text-gray-500">No problems solved yet</p>
        ) : (
          <div className="space-y-2">
            {profile.progress.slice(0, 20).map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${tierColors[p.dailyProblem.tier] || "text-gray-400 bg-gray-800"}`}>
                    {p.dailyProblem.tier}
                  </span>
                  <span className="text-sm text-gray-300">
                    {p.dailyProblem.problem.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-mono ${ratingColor(p.dailyProblem.problem.rating)}`}>
                    {p.dailyProblem.problem.rating}
                  </span>
                  <span className="text-xs text-gray-600">
                    {new Date(p.solvedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
