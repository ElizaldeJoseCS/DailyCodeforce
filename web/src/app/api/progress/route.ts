import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { userId, dailyProblemId } = await req.json();

  if (!userId || !dailyProblemId) {
    return NextResponse.json(
      { error: "userId and dailyProblemId required" },
      { status: 400 }
    );
  }

  const existing = await prisma.userProgress.findUnique({
    where: { userId_dailyProblemId: { userId, dailyProblemId } },
  });

  if (existing) {
    return NextResponse.json({ message: "Already solved", progress: existing });
  }

  const progress = await prisma.userProgress.create({
    data: { userId, dailyProblemId },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
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
  }

  return NextResponse.json({ message: "Marked as solved", progress });
}
