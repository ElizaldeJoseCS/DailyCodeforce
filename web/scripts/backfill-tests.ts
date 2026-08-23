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

function extractPreText($: any, el: any): string {
  const lines: string[] = [];
  let current = "";
  el.contents().each((_, child) => {
    if (child.type === "text") {
      const t = (child as cheerio.Text).data || "";
      current += t;
    } else if (child.type === "tag") {
      const tag = (child as cheerio.Element).tagName;
      if (tag === "br") {
        const trimmed = current.trim();
        if (trimmed) lines.push(trimmed);
        current = "";
      } else {
        if (current.trim()) {
          lines.push(current.trim());
          current = "";
        }
        lines.push($(child).text().trim());
      }
    }
  });
  const last = current.trim();
  if (last) lines.push(last);
  if (lines.length === 0) return el.text().trim();
  return lines.filter(l => l).join("\n");
}

async function scrapeTestCases(contestId: number, index: string) {
  const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  const res = await fetch(url, { headers: { "User-Agent": "DailyCodeforceBot/1.0" } });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const examples: { input: string; output: string }[] = [];
  $("div.sample-test").each((_, el) => {
    const inputs = $(el).find("div.input pre");
    const outputs = $(el).find("div.output pre");
    const count = Math.max(inputs.length, outputs.length);
    for (let i = 0; i < count; i++) {
      const input = extractPreText($, $(inputs[i]));
      const output = extractPreText($, $(outputs[i]));
      if (input || output) examples.push({ input, output });
    }
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
