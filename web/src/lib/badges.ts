// Single source of truth for achievement badges and the cosmetics tied to
// them (avatar frame, name color, profile title). Frames and name colors are
// available to everyone to pick regardless of badges earned — only the
// profile title is actually gated, re-validated server-side in PUT
// /api/users so equipping a title can never be spoofed client-side.

export interface BadgeProgress {
  totalSolved: number;
  currentStreak: number;
  longestStreak: number;
  progress: { verified: boolean; dailyProblem: { tier: string } }[];
}

export interface BadgeUnlocks {
  frame?: { class: string; label: string; icon: string };
  title?: string;
  nameColor?: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  unlocks?: BadgeUnlocks;
}

interface BadgeDef extends Badge {
  condition: (p: BadgeProgress, tierSolved: Set<string>) => boolean;
}

const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first-blood", name: "First Blood", icon: "🩸", color: "text-red-400",
    description: "Solved your first problem",
    condition: (p) => p.totalSolved >= 1,
    unlocks: { nameColor: "#b91c1c" },
  },
  {
    id: "solved-5", name: "Getting Started", icon: "⭐", color: "text-yellow-400",
    description: "Solved 5 problems",
    condition: (p) => p.totalSolved >= 5,
  },
  {
    id: "solved-10", name: "Double Digits", icon: "🔟", color: "text-yellow-400",
    description: "Solved 10 problems",
    condition: (p) => p.totalSolved >= 10,
  },
  {
    id: "solved-25", name: "Dedicated", icon: "💎", color: "text-cyan-400",
    description: "Solved 25 problems",
    condition: (p) => p.totalSolved >= 25,
    unlocks: { nameColor: "#06b6d4" },
  },
  {
    id: "solved-50", name: "Half Century", icon: "🏆", color: "text-yellow-400",
    description: "Solved 50 problems",
    condition: (p) => p.totalSolved >= 50,
    unlocks: { nameColor: "#fbbf24" },
  },
  {
    id: "solved-100", name: "Century", icon: "👑", color: "text-purple-400",
    description: "Solved 100 problems",
    condition: (p) => p.totalSolved >= 100,
    unlocks: {
      frame: { class: "ring-4 ring-amber-300 ring-offset-2 ring-offset-gray-950 shadow-[0_0_25px_rgba(252,211,77,0.6)]", label: "Crown", icon: "👑" },
      title: "Century Solver",
    },
  },
  {
    id: "streak-3", name: "On Fire", icon: "🔥", color: "text-orange-400",
    description: "3-day streak",
    condition: (p) => p.currentStreak >= 3,
  },
  {
    id: "streak-7", name: "Week Warrior", icon: "⚔️", color: "text-orange-400",
    description: "7-day streak achieved",
    condition: (p) => p.longestStreak >= 7,
    unlocks: { frame: { class: "ring-4 ring-orange-400/60 shadow-[0_0_20px_rgba(249,115,22,0.4)]", label: "Fire", icon: "🔥" } },
  },
  {
    id: "streak-14", name: "Fortnight Champion", icon: "🗓️", color: "text-orange-400",
    description: "14-day streak achieved",
    condition: (p) => p.longestStreak >= 14,
  },
  {
    id: "streak-30", name: "Monthly Master", icon: "🌟", color: "text-yellow-400",
    description: "30-day streak achieved",
    condition: (p) => p.longestStreak >= 30,
    unlocks: {
      frame: { class: "ring-4 ring-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.4)]", label: "Gold", icon: "🥇" },
      nameColor: "#fb923c",
      title: "Monthly Master",
    },
  },
  {
    id: "streak-100", name: "Legendary", icon: "🦄", color: "text-purple-400",
    description: "100-day streak achieved",
    condition: (p) => p.longestStreak >= 100,
    unlocks: {
      frame: { class: "ring-4 ring-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.4)]", label: "Diamond", icon: "💎" },
      nameColor: "#a855f7",
      title: "Legendary",
    },
  },
  {
    id: "tier-beginner", name: "Beginner Cleared", icon: "🟢", color: "text-emerald-400",
    description: "Solved a beginner problem",
    condition: (_p, tierSolved) => tierSolved.has("beginner"),
  },
  {
    id: "tier-intermediate", name: "Intermediate Done", icon: "🔵", color: "text-blue-400",
    description: "Solved an intermediate problem",
    condition: (_p, tierSolved) => tierSolved.has("intermediate"),
  },
  {
    id: "tier-advanced", name: "Advanced Ace", icon: "🟠", color: "text-orange-400",
    description: "Solved an advanced problem",
    condition: (_p, tierSolved) => tierSolved.has("advanced"),
  },
  {
    id: "tier-expert", name: "Expert Elite", icon: "🔴", color: "text-red-400",
    description: "Solved an expert problem",
    condition: (_p, tierSolved) => tierSolved.has("expert"),
  },
  {
    id: "all-tiers", name: "All-Rounder", icon: "🌈", color: "text-cyan-400",
    description: "Solved problems in all 4 tiers",
    condition: (_p, tierSolved) => tierSolved.size >= 4,
    unlocks: {
      frame: { class: "ring-4 ring-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.5)]", label: "Prism", icon: "🌈" },
      nameColor: "#06b6d4",
      title: "All-Rounder",
    },
  },
  {
    id: "verified-5", name: "Verified Solver", icon: "✅", color: "text-green-400",
    description: "5 verified solves",
    condition: (p) => p.progress.filter((pr) => pr.verified).length >= 5,
  },
  {
    id: "verified-20", name: "Trusted", icon: "🛡️", color: "text-green-400",
    description: "20 verified solves",
    condition: (p) => p.progress.filter((pr) => pr.verified).length >= 20,
    unlocks: { nameColor: "#10b981", title: "Trusted" },
  },
];

function toBadge(def: BadgeDef): Badge {
  const { id, name, icon, description, color, unlocks } = def;
  return { id, name, icon, description, color, unlocks };
}

function getTierSolved(p: BadgeProgress): Set<string> {
  return new Set(p.progress.map((pr) => pr.dailyProblem.tier));
}

export function getAllBadgeDefs(): Badge[] {
  return BADGE_DEFS.map(toBadge);
}

export function getEarnedBadges(p: BadgeProgress): Badge[] {
  const tierSolved = getTierSolved(p);
  return BADGE_DEFS.filter((b) => b.condition(p, tierSolved)).map(toBadge);
}

export function isBadgeEarned(badgeId: string, p: BadgeProgress): boolean {
  const def = BADGE_DEFS.find((b) => b.id === badgeId);
  if (!def) return false;
  return def.condition(p, getTierSolved(p));
}

export function getFrameForBadgeId(badgeId: string | null | undefined): { class: string; label: string; icon: string } | null {
  if (!badgeId || badgeId === "none") return null;
  return BADGE_DEFS.find((b) => b.id === badgeId)?.unlocks?.frame ?? null;
}

export function getTitleForBadgeId(badgeId: string | null | undefined): string | null {
  if (!badgeId) return null;
  return BADGE_DEFS.find((b) => b.id === badgeId)?.unlocks?.title ?? null;
}
