import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const JUDGE_URL = process.env.JUDGE_URL || "http://judge:8080";

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return true;
}

setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  rateLimitMap.forEach((val, key) => {
    const recent = val.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) keysToDelete.push(key);
    else rateLimitMap.set(key, recent);
  });
  keysToDelete.forEach((k) => rateLimitMap.delete(k));
}, 60_000);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as Record<string, string> | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(userId)) {
      return NextResponse.json({ error: "Rate limit exceeded. Max 10 submissions per minute." }, { status: 429 });
    }

    const { problemId, sourceCode } = await req.json();

    if (!problemId || !sourceCode) {
      return NextResponse.json({ error: "problemId and sourceCode required" }, { status: 400 });
    }

    if (typeof sourceCode !== "string" || sourceCode.length > 50_000) {
      return NextResponse.json({ error: "Source code too large (max 50KB)" }, { status: 400 });
    }

    if (!sourceCode.includes("main")) {
      return NextResponse.json({ error: "Invalid C++ source code" }, { status: 400 });
    }

    const problem = await prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    const testCases = problem.testCases as { input: string; output: string }[] | null;
    if (!testCases || testCases.length === 0) {
      return NextResponse.json({ error: "No test cases available for this problem" }, { status: 400 });
    }

    const judgeRes = await fetch(`${JUDGE_URL}/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCode, testCases }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!judgeRes.ok) {
      const err = await judgeRes.json().catch(() => ({ error: "Judge service error" }));
      return NextResponse.json({ error: err.error || "Judge service error" }, { status: 500 });
    }

    const result = await judgeRes.json();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
