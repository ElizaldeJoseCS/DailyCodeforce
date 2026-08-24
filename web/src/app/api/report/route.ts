import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;

  const { dailyProblemId, message } = await req.json();
  if (!dailyProblemId) {
    return NextResponse.json({ error: "dailyProblemId required" }, { status: 400 });
  }

  const existing = await prisma.editorialReport.findFirst({
    where: {
      dailyProblemId,
      userId: userId || null,
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Already reported" }, { status: 409 });
  }

  await prisma.editorialReport.create({
    data: {
      dailyProblemId,
      userId: userId || null,
      message: message || null,
    },
  });

  return NextResponse.json({ ok: true });
}
