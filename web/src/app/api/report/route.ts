import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_WINDOW = 10 * 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (rateLimitMap.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;

  if (!checkRateLimit(userId || getClientIp(req))) {
    return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
  }

  const { dailyProblemId, message } = await req.json();
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 });
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
