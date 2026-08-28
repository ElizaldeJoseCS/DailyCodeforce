import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateValidatedEditorial } from "../src/lib/editorial.js";
import { scrapeProblemStatement } from "../src/lib/codeforces.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env"), "utf-8");
for (const line of env.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eqIdx = t.indexOf("=");
  if (eqIdx === -1) continue;
  const k = t.slice(0, eqIdx).trim();
  let v = t.slice(eqIdx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const DELAY_MS = 60000;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const ids = await prisma.$queryRaw<{ id: string }[]>`SELECT dp.id
    FROM daily_problems dp
    WHERE dp."editorial" IS NULL OR length(dp."editorial") < 100
    ORDER BY dp.date ASC`;

  const realMissing = [];
  for (const row of ids) {
    const dp = await prisma.dailyProblem.findUnique({
      where: { id: row.id },
      include: { problem: true },
    });
    if (dp) realMissing.push(dp);
  }

  if (realMissing.length === 0) {
    console.log("No problems missing editorials.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${realMissing.length} problems missing editorials:\n`);
  for (const dp of realMissing) {
    console.log(`  ${dp.problem.name} (${dp.problem.rating})`);
  }
  console.log();

  let success = 0;
  let failed = 0;

  for (let idx = 0; idx < realMissing.length; idx++) {
    const dp = realMissing[idx];
    const p = dp.problem;
    try {
      console.log(`[${idx + 1}/${realMissing.length}] "${p.name}" (${p.rating})...`);

      const statement = await scrapeProblemStatement(p.cfContestId, p.cfIndex);
      console.log(`  Statement: ${statement ? "found" : "null"}`);
      const testCases = (p.testCases as { input: string; output: string }[] | null) || undefined;
      console.log(`  Test cases: ${testCases?.length || 0}`);

      const { editorial, validated } = await generateValidatedEditorial(
        p.name,
        p.tags,
        p.rating,
        p.cfContestId,
        p.cfIndex,
        statement,
        testCases
      );

      const cpp = editorial.includes("```cpp") || editorial.includes("```c++");
      console.log(`  Editorial: ${editorial.length} chars, cpp=${cpp}, validated=${validated}`);

      if (!editorial || editorial.length < 100) {
        console.log(`  ⚠️ Too short (${editorial?.length || 0} chars), skipping`);
        failed++;
        continue;
      }

      await prisma.dailyProblem.update({
        where: { id: dp.id },
        data: { editorial },
      });

      console.log(`  ${validated ? "✅" : "⚠️ "} Saved ${dp.id}${validated ? "" : " (unvalidated — did not pass the judge)"}`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${p.name}: ${(err as Error).message || err}`);
      failed++;
    }

    if (idx < realMissing.length - 1) {
      console.log(`  Sleeping ${DELAY_MS / 1000}s to respect rate limits...`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone! ${success} generated, ${failed} failed.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});