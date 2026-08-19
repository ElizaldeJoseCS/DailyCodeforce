import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TIER_ORDER } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const problems = await prisma.dailyProblem.findMany({
    where: { date: today },
    include: { problem: true },
  });

  const result = TIER_ORDER.map((tier) => {
    const found = problems.find((p) => p.tier === tier);
    return { tier, problem: found?.problem ?? null, dailyProblem: found ?? null };
  });

  return NextResponse.json(result);
}
