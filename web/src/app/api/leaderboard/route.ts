import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const progress = await prisma.userProgress.groupBy({
    by: ["userId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 50,
  });

  const userIds = progress.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });

  const leaderboard = progress.map((p, i) => ({
    rank: i + 1,
    user: users.find((u) => u.id === p.userId),
    solved: p._count.id,
  }));

  return NextResponse.json(leaderboard);
}
