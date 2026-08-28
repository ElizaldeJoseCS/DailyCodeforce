import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { extractCppCode } from "../src/lib/editorial.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const JUDGE_URL = process.env.JUDGE_URL || "http://judge:8080";

async function validateSolution(
  sourceCode: string,
  testCases: { input: string; output: string }[]
): Promise<{ passed: boolean; details: string }> {
  try {
    const res = await fetch(`${JUDGE_URL}/judge/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCode, testCases }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return { passed: false, details: `Judge HTTP ${res.status}` };
    }

    const result = await res.json();

    if (result.verdict === "Compilation Error") {
      return { passed: false, details: `Compilation Error:\n${result.compileOutput || "Unknown"}` };
    }

    if (result.passed === result.total) {
      return { passed: true, details: "All tests passed" };
    }

    const failedTests = (result.results || [])
      .filter((r: { verdict: string }) => r.verdict !== "Accepted")
      .slice(0, 3) // Show first 3 failures
      .map((r: { test: number; verdict: string; input?: string; expected?: string; actual?: string }) => {
        return `Test ${r.test} (${r.verdict}):\nInput: ${(r.input || "?").slice(0, 200)}\nExpected: ${(r.expected || "?").slice(0, 200)}\nGot: ${(r.actual || "?").slice(0, 200)}`;
      });

    return {
      passed: false,
      details: `${result.passed}/${result.total} tests passed.\n\n${failedTests.join("\n\n")}`,
    };
  } catch (err) {
    return { passed: false, details: `Judge error: ${err}` };
  }
}

async function testAll() {
  const problems = await prisma.dailyProblem.findMany({
    where: { editorial: { not: null } },
    include: { problem: true },
    orderBy: { date: "desc" },
  });

  console.log(`Testing ${problems.length} problems with editorials...\n`);

  const failing: { id: string; name: string; rating: number; details: string }[] = [];
  const passing: string[] = [];

  for (const dp of problems) {
    const p = dp.problem;
    const editorial = dp.editorial!;
    const cppCode = extractCppCode(editorial);

    if (!cppCode) {
      failing.push({ id: dp.id, name: p.name, rating: p.rating, details: "No C++ code block found in editorial" });
      console.log(`❌ ${p.name} (${p.rating}) — no C++ code found`);
      continue;
    }

    const testCases = (p.testCases as { input: string; output: string }[] | null) || [];
    if (testCases.length === 0) {
      failing.push({ id: dp.id, name: p.name, rating: p.rating, details: "No test cases available" });
      console.log(`❌ ${p.name} (${p.rating}) — no test cases`);
      continue;
    }

    const result = await validateSolution(cppCode, testCases);

    if (result.passed) {
      passing.push(p.name);
      console.log(`✅ ${p.name} (${p.rating}) — ${testCases.length} tests passed`);
    } else {
      failing.push({ id: dp.id, name: p.name, rating: p.rating, details: result.details });
      console.log(`❌ ${p.name} (${p.rating}) — ${result.details.split("\n")[0]}`);
    }

    // Small delay to not overwhelm the judge
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTS: ${passing.length} passing, ${failing.length} failing out of ${problems.length}`);
  console.log(`${"=".repeat(60)}\n`);

  if (failing.length > 0) {
    console.log("FAILING PROBLEMS:");
    for (const f of failing) {
      console.log(`\n  ${f.name} (rating: ${f.rating}, id: ${f.id})`);
      console.log(`  ${f.details.split("\n").slice(0, 3).join("\n  ")}`);
    }

    // Save failing IDs to a file for regeneration
    const ids = failing.map(f => f.id);
    const outPath = resolve(__dirname, "../failing-ids.json");
    const { writeFileSync } = await import("fs");
    writeFileSync(outPath, JSON.stringify(ids, null, 2));
    console.log(`\nSaved ${ids.length} failing IDs to failing-ids.json`);
  }
}

testAll()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
