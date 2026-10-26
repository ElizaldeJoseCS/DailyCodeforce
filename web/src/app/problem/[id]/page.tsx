import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { scrapeProblemStatement, ProblemStatement } from "@/lib/codeforces";
import ProblemPageClient from "@/components/ProblemPageClient";
import { pageMetadata, editorialSnippet } from "@/lib/site";

export const dynamic = "force-dynamic";

// Deduped per request, so generateMetadata and the page share one query.
const getDailyProblem = cache((id: string) =>
  prisma.dailyProblem.findUnique({
    where: { id },
    include: { problem: true },
  })
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const daily = await getDailyProblem(id);
  if (!daily) return { title: "Problem not found" };

  const { cfContestId, cfIndex, name, rating, tags } = daily.problem;
  const code = `${cfContestId}${cfIndex}`;
  const fallback = `Codeforces ${code} ${name} (rated ${rating}${tags.length ? `; ${tags.slice(0, 3).join(", ")}` : ""}): problem statement, ${daily.editorial ? "step-by-step editorial, and C++ solution" : "and an online C++ judge"}.`;

  return pageMetadata({
    title: daily.editorial
      ? `Codeforces ${code} – ${name}: Editorial & C++ Solution`
      : `Codeforces ${code} – ${name}`,
    description: (daily.editorial && editorialSnippet(daily.editorial)) || fallback,
    path: `/problem/${daily.id}`,
    type: "article",
  });
}

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const daily = await getDailyProblem(id);

  if (!daily) notFound();

  let isSolved = false;
  let isVerified = false;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;

  if (userId) {
    const progress = await prisma.userProgress.findUnique({
      where: { userId_dailyProblemId: { userId, dailyProblemId: daily.id } },
    });
    if (progress) {
      isSolved = true;
      isVerified = progress.verified;
    }
    // Not solved yet? ProblemPageClient silently re-checks against the real
    // Codeforces submissions in the background after mount — doing that CF
    // API call here would block every page load on an external request.
  }

  // The statement is scraped once (by fetch-problems.ts, when the problem is
  // picked) and cached on Problem.statement. Only fall back to a live scrape
  // for older rows that predate the cache, and persist it so this is a
  // one-time cost per problem rather than one Codeforces fetch per page view.
  let statement = daily.problem.statement as unknown as ProblemStatement | null;
  if (!statement) {
    statement = await scrapeProblemStatement(
      daily.problem.cfContestId,
      daily.problem.cfIndex
    );
    if (statement) {
      await prisma.problem.update({
        where: { id: daily.problem.id },
        data: { statement: statement as unknown as Prisma.InputJsonValue },
      });
    }
  }

  return (
    <ProblemPageClient
      daily={JSON.parse(JSON.stringify({ ...daily, statement }))}
      isSolved={isSolved}
      isVerified={isVerified}
    />
  );
}
