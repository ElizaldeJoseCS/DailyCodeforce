import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";

  if (q.length < 2) {
    return NextResponse.json({ users: [], problems: [] });
  }

  const [users, problems] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
        discordAvatar: true,
        totalSolved: true,
        currentStreak: true,
      },
      take: 10,
    }),
    prisma.problem.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { tags: { hasSome: [q] } },
        ],
      },
      include: {
        dailyProblems: {
          select: { id: true, tier: true, date: true },
          orderBy: { date: "desc" },
          take: 1,
        },
      },
      take: 10,
    }),
  ]);

  return NextResponse.json({ users, problems });
}
