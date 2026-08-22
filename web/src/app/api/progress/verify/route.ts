import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkUserSolve } from "@/lib/codeforces";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dailyProblemId } = await req.json();
  if (!dailyProblemId) {
    return NextResponse.json({ error: "dailyProblemId required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.cfHandle) {
    return NextResponse.json({ error: "No Codeforces handle linked" }, { status: 400 });
  }

  const existing = await prisma.userProgress.findUnique({
    where: { userId_dailyProblemId: { userId, dailyProblemId } },
  });
  if (existing) {
    return NextResponse.json({ message: "Already solved", verified: existing.verified });
  }

  const daily = await prisma.dailyProblem.findUnique({
    where: { id: dailyProblemId },
    include: { problem: true },
  });
  if (!daily) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const solved = await checkUserSolve(
    user.cfHandle,
    daily.problem.cfContestId,
    daily.problem.cfIndex
  );

  if (!solved) {
    return NextResponse.json({ error: "No verified submission found on Codeforces" }, { status: 400 });
  }

  const progress = await prisma.userProgress.create({
    data: { userId, dailyProblemId, verified: true },
  });

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

  await prisma.user.update({
    where: { id: userId },
    data: {
      totalSolved: user.totalSolved + 1,
      currentStreak: newStreak,
      longestStreak: Math.max(user.longestStreak, newStreak),
      lastSolvedDate: now,
    },
  });

  return NextResponse.json({ message: "Verified and marked as solved", verified: true, progress });
}
