import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function scrapeTestCases(contestId: number, index: string) {
  const { load } = await import("cheerio");
  const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "DailyCodeforceBot/1.0" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = load(html);
  const examples: { input: string; output: string }[] = [];
  $("div.sample-test").each((_, el) => {
    const inputs = $(el).find("div.input pre");
    const outputs = $(el).find("div.output pre");
    const count = Math.max(inputs.length, outputs.length);
    for (let i = 0; i < count; i++) {
      const input = $(inputs[i]).text().trim();
      const output = $(outputs[i]).text().trim();
      if (input || output) examples.push({ input, output });
    }
  });
  return examples;
}

export async function GET() {
  const problems = await prisma.$queryRawUnsafe<
    { id: string; cfContestId: number; cfIndex: string; name: string }[]
  >('SELECT id, "cfContestId", "cfIndex", name FROM problems WHERE "testCases" IS NULL');

  const results: { name: string; count: number; status: string }[] = [];

  for (const p of problems) {
    try {
      const testCases = await scrapeTestCases(p.cfContestId, p.cfIndex);
      if (testCases.length > 0) {
        await prisma.$executeRawUnsafe(
          'UPDATE problems SET "testCases" = $1 WHERE id = $2',
          JSON.stringify(testCases),
          p.id
        );
        results.push({ name: p.name, count: testCases.length, status: "saved" });
      } else {
        results.push({ name: p.name, count: 0, status: "no test cases found" });
      }
    } catch (e) {
      results.push({ name: p.name, count: 0, status: `error: ${e}` });
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return NextResponse.json({ total: problems.length, results });
}
