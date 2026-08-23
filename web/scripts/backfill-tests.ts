import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const dbUrl = process.env.DATABASE_URL || (() => {
  const envVars = Object.fromEntries(
    readFileSync(envPath, "utf-8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const [k, ...v] = l.split("=");
        return [k.trim(), v.join("=").trim()];
      })
  );
  return envVars.DATABASE_URL;
})();

const adapter = new PrismaPg({ connectionString: dbUrl! });
const prisma = new PrismaClient({ adapter });

async function scrapeTestCases(contestId: number, index: string) {
  const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  const res = await fetch(url, { headers: { "User-Agent": "DailyCodeforceBot/1.0" } });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const examples: { input: string; output: string }[] = [];
  $("div.sample-tests").each((_, el) => {
    const input = $(el).find("div.input pre").text().trim();
    const output = $(el).find("div.output pre").text().trim();
    if (input || output) examples.push({ input, output });
  });
  return examples;
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ id: string; cfContestId: number; cfIndex: string; name: string }[]>(
    `SELECT id, "cfContestId", "cfIndex", name FROM problems WHERE "testCases" IS NULL`
  );

  console.log(`Found ${rows.length} problems without test cases`);

  for (const p of rows) {
    try {
      const testCases = await scrapeTestCases(p.cfContestId, p.cfIndex);
      if (testCases.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE problems SET "testCases" = $1 WHERE id = $2`,
          JSON.stringify(testCases),
          p.id
        );
        console.log(`✅ ${p.name} (${p.cfContestId}${p.cfIndex}): ${testCases.length} tests`);
      } else {
        console.log(`⚠️ ${p.name}: no test cases found`);
      }
    } catch (e: unknown) {
      console.error(`❌ ${p.name}: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  await prisma.$disconnect();
}

main();
