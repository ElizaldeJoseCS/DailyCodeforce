import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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
  for (const [key, val] of rateLimitMap) {
    const recent = val.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, recent);
  }
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

    const id = randomUUID();
    const srcPath = join(tmpdir(), `sub_${id}.cpp`);
    const tcPath = join(tmpdir(), `tc_${id}.json`);

    writeFileSync(srcPath, sourceCode);
    writeFileSync(tcPath, JSON.stringify(testCases));

    try {
      const judgePath = join(process.cwd(), "judge", "judge.py");
      const { stdout } = await execFileAsync("python3", [judgePath, srcPath, tcPath], {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });

      const result = JSON.parse(stdout.trim());
      return NextResponse.json(result);
    } catch (e: unknown) {
      const err = e as { stderr?: string; status?: number };
      if (err.status === 137 || err.stderr?.includes("Killed")) {
        return NextResponse.json({ error: "Judging timed out or used too much memory" }, { status: 400 });
      }
      return NextResponse.json({ error: "Judging failed" }, { status: 500 });
    } finally {
      try { unlinkSync(srcPath); } catch {}
      try { unlinkSync(tcPath); } catch {}
    }
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
