import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { scrapeProblemStatement, ProblemStatement } from "@/lib/codeforces";
import ProblemPageClient from "@/components/ProblemPageClient";

export const dynamic = "force-dynamic";

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
