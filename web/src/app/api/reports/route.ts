import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Record<string, string> | undefined)?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const reports = await prisma.editorialReport.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      dailyProblem: {
        select: {
          id: true,
          tier: true,
          date: true,
          problem: {
            select: { id: true, name: true, rating: true, url: true, cfContestId: true, cfIndex: true },
          },
        },
      },
    },
  });

  const userIdSet = new Set<string>();
  for (const r of reports) {
    if (r.userId) userIdSet.add(r.userId);
  }
  const userIds = Array.from(userIdSet);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, displayName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, { username: u.username, displayName: u.displayName }]));

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      userId: r.userId,
      user: r.userId ? userMap.get(r.userId) || null : null,
      dailyProblem: r.dailyProblem ? {
        id: r.dailyProblem.id,
        tier: r.dailyProblem.tier,
        date: r.dailyProblem.date.toISOString().split("T")[0],
        problem: r.dailyProblem.problem,
      } : null,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Record<string, string> | undefined)?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await prisma.editorialReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
