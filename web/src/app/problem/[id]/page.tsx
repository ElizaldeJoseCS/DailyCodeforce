import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, ArrowLeft, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import { TIERS, type Tier } from "@/lib/tiers";

export const dynamic = "force-dynamic";
import { tierColor, ratingColor } from "@/lib/utils";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const daily = await prisma.dailyProblem.findUnique({
    where: { id },
    include: { problem: true },
  });

  if (!daily) notFound();

  const tier = daily.tier as Tier;
  const config = TIERS[tier];

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
              {config.label}
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

        {daily.visualUrl && (
          <div className="p-8 border-b border-gray-800">
            <h2 className="text-lg font-semibold mb-4">
              Algorithm Visualization
            </h2>
            <img
              src={daily.visualUrl}
              alt={`Visualization for ${daily.problem.name}`}
              className="w-full rounded-lg border border-gray-800"
            />
          </div>
        )}

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
                {daily.date.toISOString().split("T")[0]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
