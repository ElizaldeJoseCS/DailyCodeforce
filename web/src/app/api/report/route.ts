import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;

  const { dailyProblemId, message } = await req.json();
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  await prisma.editorialReport.create({
    data: {
      dailyProblemId: dailyProblemId || null,
      userId: userId || null,
      message: message.trim(),
    },
  });

  return NextResponse.json({ ok: true });
}
