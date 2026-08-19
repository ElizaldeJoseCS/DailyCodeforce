export const TIERS = {
  beginner: { label: "Beginner", min: 800, max: 1200, color: "emerald" },
  intermediate: { label: "Intermediate", min: 1200, max: 1600, color: "blue" },
  advanced: { label: "Advanced", min: 1600, max: 2000, color: "orange" },
  expert: { label: "Expert", min: 2000, max: 3500, color: "red" },
} as const;

export type Tier = keyof typeof TIERS;

export const TIER_ORDER: Tier[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];
