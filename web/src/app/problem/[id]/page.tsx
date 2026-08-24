import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { checkUserSolve, scrapeProblemStatement } from "@/lib/codeforces";
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const progress = await prisma.userProgress.findUnique({
      where: { userId_dailyProblemId: { userId, dailyProblemId: daily.id } },
    });

    if (progress) {
      isSolved = true;
      isVerified = progress.verified;
    } else if (user?.cfHandle) {
      const cfSolved = await checkUserSolve(
        user.cfHandle,
        daily.problem.cfContestId,
        daily.problem.cfIndex
      );

      if (cfSolved) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let newStreak = 1;
        if (user.lastSolvedDate) {
          const last = new Date(user.lastSolvedDate);
          const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
          if (lastDay.getTime() === today.getTime()) {
            newStreak = user.currentStreak;
          } else if (lastDay.getTime() === yesterday.getTime()) {
            newStreak = user.currentStreak + 1;
          }
        }

        await prisma.userProgress.create({
          data: { userId, dailyProblemId: daily.id, verified: true },
        });
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalSolved: user.totalSolved + 1,
            currentStreak: newStreak,
            longestStreak: Math.max(user.longestStreak, newStreak),
            lastSolvedDate: now,
          },
        });

        isSolved = true;
        isVerified = true;
      }
    }
  }

  const statement = await scrapeProblemStatement(
    daily.problem.cfContestId,
    daily.problem.cfIndex
  );

  return (
    <ProblemPageClient
      daily={JSON.parse(JSON.stringify({ ...daily, statement }))}
      isSolved={isSolved}
      isVerified={isVerified}
    />
  );
}
