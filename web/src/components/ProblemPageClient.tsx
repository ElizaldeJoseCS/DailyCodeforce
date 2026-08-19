"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ArrowLeft, Calendar, Eye, EyeOff } from "lucide-react";
import { type Tier } from "@/lib/tiers";
import { tierColor, ratingColor } from "@/lib/utils";

interface DailyProblem {
  id: string;
  tier: string;
  date: Date;
  editorialUrl: string | null;
  visualUrl: string | null;
  visualPrompt: string | null;
  problem: {
    name: string;
    rating: number;
    tags: string[];
    url: string;
    cfContestId: number;
    cfIndex: string;
  };
}

const TIER_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export default function ProblemPageClient({ daily }: { daily: DailyProblem }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const tier = daily.tier as Tier;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to today
      </Link>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="p-8 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${tierColor(tier)}`}
            >
              {TIER_LABELS[daily.tier] || daily.tier}
            </span>
            <span
              className={`text-2xl font-mono font-bold ${ratingColor(daily.problem.rating)}`}
            >
              {daily.problem.rating}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-4">{daily.problem.name}</h1>

          <div className="flex flex-wrap gap-2 mb-6">
            {daily.problem.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-3 py-1 rounded-lg bg-gray-800 text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <a
              href={daily.problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Solve on Codeforces
            </a>
            {daily.editorialUrl && (
              <a
                href={daily.editorialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-600 text-gray-300 text-sm transition-colors"
              >
                View Editorial
              </a>
            )}
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-lg font-semibold mb-3">Problem Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Contest</span>
              <p className="font-mono">
                {daily.problem.cfContestId}
                {daily.problem.cfIndex}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Date Assigned</span>
              <p className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {daily.date instanceof Date
                  ? daily.date.toISOString().split("T")[0]
                  : String(daily.date).split("T")[0]}
              </p>
            </div>
          </div>
        </div>

        {daily.visualUrl && (
          <div className="border-t border-gray-800">
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {showAnswer ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-cyan-400" />
                )}
                <span className="font-semibold text-lg">
                  {showAnswer ? "Hide Answer" : "Show Answer & Visual"}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {showAnswer ? "Click to hide" : "Click to reveal"}
              </span>
            </button>

            {showAnswer && (
              <div className="px-8 pb-8 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    Algorithm Visualization
                  </h3>
                  <img
                    src={daily.visualUrl}
                    alt={`Visualization for ${daily.problem.name}`}
                    className="w-full rounded-lg border border-gray-800"
                  />
                </div>
                <a
                  href={daily.problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View solution on Codeforces
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
