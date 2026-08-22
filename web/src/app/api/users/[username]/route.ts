import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const { username } = params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      backgroundColor: true,
      accentColor: true,
      discordAvatar: true,
      currentStreak: true,
      longestStreak: true,
      totalSolved: true,
      createdAt: true,
      progress: {
        include: {
          dailyProblem: {
            include: { problem: true },
          },
        },
        orderBy: { solvedAt: "desc" },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rank = await prisma.userProgress.groupBy({
    by: ["userId"],
    _count: { id: true },
    where: {
      user: { totalSolved: { gt: user.totalSolved } },
    },
  });

  return NextResponse.json({ ...user, rank: rank.length + 1 });
}
