import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { TIERS, TIER_ORDER } from "@/lib/tiers";
import { tierColor, ratingColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getArchive() {
  const problems = await prisma.dailyProblem.findMany({
    include: { problem: true },
    orderBy: { date: "desc" },
    take: 60,
  });

  const grouped: Record<string, typeof problems> = {};
  for (const p of problems) {
    const key = p.date.toISOString().split("T")[0];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  return grouped;
}

export default async function ArchivePage() {
  const grouped = await getArchive();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to today
      </Link>

      <h1 className="text-3xl font-bold mb-8 [text-shadow:1px_1px_0_rgba(0,0,0,0.15)] dark:[text-shadow:1px_1px_0_rgba(0,0,0,0.5)]">
        Problem <span className="text-cyan-500 dark:text-cyan-400">Archive</span>
      </h1>

      <div className="space-y-8">
        {Object.entries(grouped).map(([date, problems]) => (
          <div key={date}>
            <h2 className="text-sm font-mono text-gray-500 mb-3 pb-1 border-b border-dashed border-cyan-200 dark:border-cyan-900">{date}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TIER_ORDER.map((tier) => {
                const dp = problems.find((p) => p.tier === tier);
                const config = TIERS[tier];

                if (!dp) {
                  return (
                    <div
                      key={tier}
                      className="rounded-sm border border-cyan-200/40 dark:border-cyan-900/40 bg-gray-50 dark:bg-gray-900/30 p-4 opacity-30"
                    >
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${tierColor(tier)}`}
                      >
                        {config.label}
                      </span>
                      <p className="text-gray-400 dark:text-gray-700 text-sm mt-2">
                        No problem
                      </p>
                    </div>
                  );
                }

                return (
                  <Link
                    key={tier}
                    href={`/problem/${dp.id}`}
                    className="group xp-panel p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${tierColor(tier)}`}
                      >
                        {config.label}
                      </span>
                      <span
                        className={`text-sm font-mono font-bold ${ratingColor(dp.problem.rating)}`}
                      >
                        {dp.problem.rating}
                      </span>
                    </div>
                    <h3 className="font-medium group-hover:text-cyan-400 transition-colors">
                      {dp.problem.name}
                    </h3>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(grouped).length === 0 && (
          <p className="text-gray-500 text-center py-20">
            No problems in the archive yet. Run the fetch script to populate.
          </p>
        )}
      </div>
    </div>
  );
}
