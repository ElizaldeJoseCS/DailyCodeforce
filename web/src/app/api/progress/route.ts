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

  return NextResponse.json({ message: "Marked as solved", progress });
}
