import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim()];
    })
);

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
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
  const problems = await prisma.problem.findMany({
    where: { testCases: null },
    select: { id: true, cfContestId: true, cfIndex: true, name: true },
  });

  console.log(`Found ${problems.length} problems without test cases`);

  for (const p of problems) {
    try {
      const testCases = await scrapeTestCases(p.cfContestId, p.cfIndex);
      if (testCases.length > 0) {
        await prisma.problem.update({
          where: { id: p.id },
          data: { testCases: JSON.parse(JSON.stringify(testCases)) },
        });
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
