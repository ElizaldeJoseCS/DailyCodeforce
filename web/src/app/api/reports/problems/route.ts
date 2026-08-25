import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const problems = await prisma.dailyProblem.findMany({
    select: {
      id: true,
      tier: true,
      date: true,
      problem: {
        select: { id: true, name: true },
      },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json({
    problems: problems.map((p) => ({
      id: p.id,
      problemName: p.problem.name,
      problemId: p.problem.id,
      tier: p.tier,
      date: p.date.toISOString().split("T")[0],
    })),
  });
}
