import Link from "next/link";
import { ExternalLink, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { TIERS, TIER_ORDER, type Tier } from "@/lib/tiers";
import { tierColor, ratingColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

type DailyEntry = {
  tier: Tier;
  id: string;
  editorialUrl: string | null;
  editorial: string | null;
  problem: {
    name: string;
    rating: number;
    tags: string[];
    url: string;
    cfContestId: number;
    cfIndex: string;
  };
} | { tier: Tier };

async function getTodayProblems(): Promise<DailyEntry[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const problems = await prisma.dailyProblem.findMany({
    where: { date: today },
    include: { problem: true },
  });

  return TIER_ORDER.map((tier): DailyEntry => {
    const found = problems.find((p) => p.tier === tier);
    if (!found) return { tier };
    return {
      tier,
      id: found.id,
      editorialUrl: found.editorialUrl,
      editorial: found.editorial,
      problem: found.problem,
    };
  });
}

export default async function HomePage() {
  const problems = await getTodayProblems();
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">
          Daily <span className="text-cyan-400">Codeforces</span> Problems
        </h1>
        <p className="text-gray-400 text-lg">
          Practice competitive programming with curated daily challenges across
          all difficulty levels.
        </p>
        <p className="text-gray-500 text-sm mt-2">{today}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {problems.map((entry) => {
          const config = TIERS[entry.tier];
          const problem = "problem" in entry ? entry.problem : null;
          const id = "id" in entry ? entry.id : null;

          if (!problem || !id) {
            return (
              <div
                key={entry.tier}
                className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 opacity-50"
              >
                <div className="text-sm text-gray-500 mb-2">
                  {config.label} ({config.min}–{config.max})
                </div>
                <p className="text-gray-600">No problem assigned today</p>
              </div>
            );
          }

          return (
            <Link
              key={entry.tier}
              href={`/problem/${id}`}
              className="group rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-700 hover:bg-gray-900 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${tierColor(entry.tier)}`}
                >
                  {config.label}
                </span>
                <span
                  className={`text-sm font-mono font-bold ${ratingColor(problem.rating)}`}
                >
                  {problem.rating}
                </span>
              </div>

              <h2 className="text-lg font-semibold mb-2 group-hover:text-cyan-400 transition-colors">
                {problem.name}
              </h2>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {problem.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400"
                  >
                    {tag}
                  </span>
                ))}
                {problem.tags.length > 4 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">
                    +{problem.tags.length - 4}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-cyan-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Codeforces
                </a>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
