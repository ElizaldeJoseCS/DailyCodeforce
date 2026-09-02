import Link from "next/link";
import { ExternalLink, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { TIERS, TIER_ORDER, type Tier } from "@/lib/tiers";

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

const TIER_HEADER: Record<string, string> = {
  beginner: "from-emerald-500 to-emerald-700 border-emerald-800",
  intermediate: "from-blue-500 to-blue-700 border-blue-800",
  advanced: "from-orange-500 to-orange-700 border-orange-800",
  expert: "from-red-500 to-red-700 border-red-800",
};

export default async function HomePage() {
  const problems = await getTodayProblems();
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-3 [text-shadow:1px_1px_0_rgba(0,0,0,0.15)] dark:[text-shadow:1px_1px_0_rgba(0,0,0,0.5)]">
          Daily <span className="text-cyan-500 dark:text-cyan-400">Codeforces</span> Problems
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Practice competitive programming with curated daily challenges across
          all difficulty levels.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">{today}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {problems.map((entry) => {
          const config = TIERS[entry.tier];
          const problem = "problem" in entry ? entry.problem : null;
          const id = "id" in entry ? entry.id : null;
          const headerGradient = TIER_HEADER[entry.tier] || "from-gray-500 to-gray-700 border-gray-800";

          if (!problem || !id) {
            return (
              <div
                key={entry.tier}
                className="rounded-sm border border-cyan-200 dark:border-cyan-900 bg-white dark:bg-gray-900 shadow-sm overflow-hidden opacity-60"
              >
                <div className={`bg-gradient-to-b ${headerGradient} border-b px-4 py-2 text-white text-sm font-bold`}>
                  {config.label} ({config.min}–{config.max})
                </div>
                <p className="p-6 text-gray-400 dark:text-gray-600">No problem assigned today</p>
              </div>
            );
          }

          return (
            <Link
              key={entry.tier}
              href={`/problem/${id}`}
              className="group rounded-sm border border-cyan-200 dark:border-cyan-900 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className={`flex items-center justify-between bg-gradient-to-b ${headerGradient} border-b px-4 py-2`}>
                <span className="text-white text-sm font-bold tracking-wide">
                  {config.label}
                </span>
                <span
                  className={`text-sm font-mono font-bold px-2 py-0.5 rounded-sm bg-black/20 text-white`}
                >
                  {problem.rating}
                </span>
              </div>

              <div className="p-6">
                <h2 className="text-lg font-semibold mb-2 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                  {problem.name}
                </h2>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {problem.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-sm bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                  {problem.tags.length > 4 && (
                    <span className="text-xs px-2 py-0.5 rounded-sm bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                      +{problem.tags.length - 4}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <a
                    href={problem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Codeforces
                  </a>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
