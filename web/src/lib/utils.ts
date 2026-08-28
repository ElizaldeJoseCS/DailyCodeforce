import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tierColor(tier: string): string {
  switch (tier) {
    case "beginner":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "intermediate":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "advanced":
      return "bg-orange-500/10 text-orange-400 border-orange-500/30";
    case "expert":
      return "bg-red-500/10 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export function ratingColor(rating: number): string {
  if (rating < 1100) return "text-emerald-400";
  if (rating < 1600) return "text-blue-400";
  if (rating < 2100) return "text-orange-400";
  return "text-red-400";
}
