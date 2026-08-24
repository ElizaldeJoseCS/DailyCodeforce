#!/usr/bin/env node
// Quick script to backfill missing test cases
// Run inside web container: node scripts/backfill-testcases.mjs

const JUDGE_URL = process.env.JUDGE_URL || "http://judge:8080";

async function scrapeTestCases(contestId, index) {
  const { load } = await import("cheerio");
  const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "DailyCodeforceBot/1.0" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = load(html);
  const examples = [];
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

async function main() {
  const { PrismaClient } = await import("@/generated/prisma/client.js");
  const prisma = new PrismaClient();

  const problems = await prisma.$queryRawUnsafe(
    'SELECT id, "cfContestId", "cfIndex", name FROM problems WHERE "testCases" IS NULL'
  );

  console.log(`Found ${problems.length} problems without test cases`);

  for (const p of problems) {
    console.log(`Scraping ${p.name} (${p.cfContestId}${p.cfIndex})...`);
    const testCases = await scrapeTestCases(p.cfContestId, p.cfIndex);
    if (testCases.length > 0) {
      await prisma.$executeRawUnsafe(
        'UPDATE problems SET "testCases" = $1 WHERE id = $2',
        JSON.stringify(testCases),
        p.id
      );
      console.log(`  -> ${testCases.length} test cases saved`);
    } else {
      console.log(`  -> No test cases found`);
    }
    // Be nice to Codeforces
    await new Promise((r) => setTimeout(r, 1500));
  }

  await prisma.$disconnect();
  console.log("Done!");
}

main().catch(console.error);
