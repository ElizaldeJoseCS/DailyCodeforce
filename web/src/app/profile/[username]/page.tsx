"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Flame,
  Trophy,
  Target,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Globe,
  Edit3,
} from "lucide-react";

interface SocialLinks {
  github?: string;
  twitter?: string;
  website?: string;
}

interface ProfileLayout {
  showStats: boolean;
  showSolves: boolean;
  bioPosition: "top" | "side";
}

interface UserProfile {
  id: string;
  username: string;
  cfHandle: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  backgroundColor: string | null;
  accentColor: string | null;
  socialLinks: SocialLinks | null;
  profileLayout: ProfileLayout | null;
  avatarFrame: string | null;
  discordAvatar: string | null;
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  createdAt: string;
  rank: number;
  progress: {
    solvedAt: string;
    verified: boolean;
    dailyProblem: {
      tier: string;
      problem: { name: string; rating: number; tags: string[] };
    };
  }[];
}

function getFrameStyle(streak: number): { class: string; label: string } {
  if (streak >= 100) return { class: "ring-4 ring-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.4)]", label: "Diamond" };
  if (streak >= 30) return { class: "ring-4 ring-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.4)]", label: "Gold" };
  if (streak >= 7) return { class: "ring-4 ring-orange-400/60 shadow-[0_0_20px_rgba(249,115,22,0.4)]", label: "Fire" };
  return { class: "", label: "" };
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

function getBadges(profile: UserProfile): Badge[] {
  const badges: Badge[] = [];
  const p = profile;

  // First solve
  if (p.totalSolved >= 1) badges.push({ id: "first-blood", name: "First Blood", icon: "🩸", description: "Solved your first problem", color: "text-red-400" });

  // Solve milestones
  if (p.totalSolved >= 5) badges.push({ id: "solved-5", name: "Getting Started", icon: "⭐", description: "Solved 5 problems", color: "text-yellow-400" });
  if (p.totalSolved >= 10) badges.push({ id: "solved-10", name: "Double Digits", icon: "🔟", description: "Solved 10 problems", color: "text-yellow-400" });
  if (p.totalSolved >= 25) badges.push({ id: "solved-25", name: "Dedicated", icon: "💎", description: "Solved 25 problems", color: "text-cyan-400" });
  if (p.totalSolved >= 50) badges.push({ id: "solved-50", name: "Half Century", icon: "🏆", description: "Solved 50 problems", color: "text-yellow-400" });
  if (p.totalSolved >= 100) badges.push({ id: "solved-100", name: "Century", icon: "👑", description: "Solved 100 problems", color: "text-purple-400" });

  // Streak badges
  if (p.currentStreak >= 3) badges.push({ id: "streak-3", name: "On Fire", icon: "🔥", description: "3-day streak", color: "text-orange-400" });
  if (p.longestStreak >= 7) badges.push({ id: "streak-7", name: "Week Warrior", icon: "⚔️", description: "7-day streak achieved", color: "text-orange-400" });
  if (p.longestStreak >= 14) badges.push({ id: "streak-14", name: "Fortnight Champion", icon: "🗓️", description: "14-day streak achieved", color: "text-orange-400" });
  if (p.longestStreak >= 30) badges.push({ id: "streak-30", name: "Monthly Master", icon: "🌟", description: "30-day streak achieved", color: "text-yellow-400" });
  if (p.longestStreak >= 100) badges.push({ id: "streak-100", name: "Legendary", icon: "🦄", description: "100-day streak achieved", color: "text-purple-400" });

  // Tier badges — check if user has solved problems in each tier
  const tierSolved = new Set(p.progress.map((pr) => pr.dailyProblem.tier));
  if (tierSolved.has("beginner")) badges.push({ id: "tier-beginner", name: "Beginner Cleared", icon: "🟢", description: "Solved a beginner problem", color: "text-emerald-400" });
  if (tierSolved.has("intermediate")) badges.push({ id: "tier-intermediate", name: "Intermediate Done", icon: "🔵", description: "Solved an intermediate problem", color: "text-blue-400" });
  if (tierSolved.has("advanced")) badges.push({ id: "tier-advanced", name: "Advanced Ace", icon: "🟠", description: "Solved an advanced problem", color: "text-orange-400" });
  if (tierSolved.has("expert")) badges.push({ id: "tier-expert", name: "Expert Elite", icon: "🔴", description: "Solved an expert problem", color: "text-red-400" });

  // All tiers
  if (tierSolved.size >= 4) badges.push({ id: "all-tiers", name: "All-Rounder", icon: "🌈", description: "Solved problems in all 4 tiers", color: "text-cyan-400" });

  // Verified badge
  const verifiedCount = p.progress.filter((pr) => pr.verified).length;
  if (verifiedCount >= 5) badges.push({ id: "verified-5", name: "Verified Solver", icon: "✅", description: "5 verified solves", color: "text-green-400" });
  if (verifiedCount >= 20) badges.push({ id: "verified-20", name: "Trusted", icon: "🛡️", description: "20 verified solves", color: "text-green-400" });

  return badges;
}

function ActivityHeatmap({ progress }: { progress: UserProfile["progress"] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build a map of date -> count for the last 90 days
  const solveCounts = new Map<string, number>();
  for (const p of progress) {
    const d = new Date(p.solvedAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    solveCounts.set(key, (solveCounts.get(key) || 0) + 1);
  }

  // Generate 90 days of data
  const days: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: solveCounts.get(key) || 0 });
  }

  const maxCount = Math.max(1, ...days.map((d) => d.count));

  const getColor = (count: number) => {
    if (count === 0) return "bg-gray-100 dark:bg-gray-800";
    const ratio = count / maxCount;
    if (ratio <= 0.25) return "bg-emerald-900/40";
    if (ratio <= 0.5) return "bg-emerald-700/50";
    if (ratio <= 0.75) return "bg-emerald-500/60";
    return "bg-emerald-400";
  };

  // Group by weeks (7 columns)
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const monthLabels: string[] = [];
  let lastMonth = -1;
  for (const week of weeks) {
    const d = new Date(week[0].date);
    const m = d.getMonth();
    if (m !== lastMonth) {
      monthLabels.push(d.toLocaleString("default", { month: "short" }));
      lastMonth = m;
    } else {
      monthLabels.push("");
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-fit">
        {/* Month labels */}
        <div className="flex gap-0.5 ml-8">
          {monthLabels.map((label, i) => (
            <div key={i} className="text-[10px] text-gray-500 w-[14px] text-center">
              {label}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1">
            {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
              <div key={i} className="text-[10px] text-gray-500 h-[14px] leading-[14px] text-right">
                {label}
              </div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`w-[14px] h-[14px] rounded-[3px] ${getColor(day.count)} transition-colors`}
                  title={`${day.date}: ${day.count} solved`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const { data: session } = useSession();
  const username = params.username as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isOwner = (session?.user as Record<string, string>)?.username === username;

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
  const frame = getFrameStyle(profile.currentStreak);
  const socials = profile.socialLinks as SocialLinks | null;
  const layout = profile.profileLayout || { showStats: true, showSolves: true, bioPosition: "top" as const };

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

  const hasSocials = socials?.github || socials?.twitter || socials?.website;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: bg }}
    >
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
          className={`w-28 h-28 rounded-full border-4 overflow-hidden flex-shrink-0 ${frame.class}`}
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
        <div className="pt-16 pb-1 flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ color: accent }}>
              {profile.displayName || profile.username}
            </h1>
            {frame.label && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-orange-400 border border-orange-500/20">
                {frame.label} Frame
              </span>
            )}
          </div>
          <p className="text-gray-400">@{profile.username}</p>

          {/* Side bio */}
          {layout.bioPosition === "side" && profile.bio && (
            <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap max-w-md">{profile.bio}</p>
          )}

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <a
              href={`https://codeforces.com/profile/${profile.cfHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              <ExternalLink className="w-3 h-3" />
              {profile.cfHandle}
            </a>
            {hasSocials && (
              <>
                {socials?.github && (
                  <a
                    href={`https://github.com/${socials.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
                  >
                    <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    {socials.github}
                  </a>
                )}
                {socials?.twitter && (
                  <a
                    href={`https://twitter.com/${socials.twitter.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
                  >
                    <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    {socials.twitter}
                  </a>
                )}
                {socials?.website && (
                  <a
                    href={socials.website.startsWith("http") ? socials.website : `https://${socials.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
                  >
                    <Globe className="w-3 h-3" />
                    {socials.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </>
            )}
          </div>
        </div>
        {isOwner && (
          <Link
            href={`/profile/${username}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-300 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </Link>
        )}
      </div>

      {/* Bio - top position */}
      {layout.bioPosition === "top" && profile.bio && (
        <div className="mb-8 px-4">
          <div className="prose prose-invert max-w-none text-gray-300 text-sm whitespace-pre-wrap">
            {profile.bio}
          </div>
        </div>
      )}

      {/* Badges */}
      {(() => {
        const badges = getBadges(profile);
        if (badges.length === 0) return null;
        return (
          <div className="mb-8 px-4">
            <h2 className="text-lg font-semibold mb-3">Achievements</h2>
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm"
                  title={b.description}
                >
                  <span>{b.icon}</span>
                  <span className={`font-medium ${b.color}`}>{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      {layout.showStats && (
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
      )}

      {/* Activity Heatmap */}
      {layout.showStats && profile.progress.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Activity</h2>
          <ActivityHeatmap progress={profile.progress} />
        </div>
      )}

      {/* Solved Problems */}
      {layout.showSolves && (
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
                    {p.verified && (
                      <span title="Verified on Codeforces">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                      </span>
                    )}
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
      )}
      </div>
    </div>
  );
}
