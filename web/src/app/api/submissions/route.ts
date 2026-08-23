import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const { problemId, sourceCode } = await req.json();

    if (!problemId || !sourceCode) {
      return NextResponse.json({ error: "problemId and sourceCode required" }, { status: 400 });
    }

    const problem = await prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    const testCases = problem.testCases as { input: string; output: string }[] | null;
    if (!testCases || testCases.length === 0) {
      return NextResponse.json({ error: "No test cases available for this problem" }, { status: 400 });
    }

    const id = Date.now().toString(36);
    const srcPath = join(tmpdir(), `sub_${id}.cpp`);
    const tcPath = join(tmpdir(), `tc_${id}.json`);
    const judgePath = join(process.cwd(), "judge", "judge.py");

    writeFileSync(srcPath, sourceCode);
    writeFileSync(tcPath, JSON.stringify(testCases));

    try {
      const output = execSync(`python3 ${judgePath} ${srcPath} ${tcPath}`, {
        timeout: 30000,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      });

      const result = JSON.parse(output.trim());
      return NextResponse.json(result);
    } catch (e: unknown) {
      const err = e as { stderr?: string; status?: number };
      if (err.status === 137 || err.stderr?.includes("Killed")) {
        return NextResponse.json({ error: "Judging timed out or used too much memory" }, { status: 400 });
      }
      return NextResponse.json({ error: "Judging failed: " + (err.stderr || String(e)) }, { status: 500 });
    } finally {
      try { unlinkSync(srcPath); } catch {}
      try { unlinkSync(tcPath); } catch {}
    }
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
