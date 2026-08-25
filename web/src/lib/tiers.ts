export const TIERS = {
  beginner: { label: "Beginner", min: 800, max: 1000, color: "emerald" },
  intermediate: { label: "Intermediate", min: 1100, max: 1500, color: "blue" },
  advanced: { label: "Advanced", min: 1600, max: 2000, color: "orange" },
  expert: { label: "Expert", min: 2100, max: 3500, color: "red" },
} as const;

export type Tier = keyof typeof TIERS;

export const TIER_ORDER: Tier[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];
