import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { generateValidatedEditorial } from "../src/lib/editorial.js";
import { scrapeProblemStatement } from "../src/lib/codeforces.js";

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

async function regenerate() {
  const idsPath = resolve(__dirname, "../failing-ids.json");
  if (!existsSync(idsPath)) {
    console.log("No failing-ids.json found. Run test-editorials.ts first.");
    return;
  }

  const failingIds: string[] = JSON.parse(readFileSync(idsPath, "utf-8"));
  console.log(`Regenerating ${failingIds.length} failing editorials...\n`);

  let success = 0;
  let failed = 0;

  for (const id of failingIds) {
    const dp = await prisma.dailyProblem.findUnique({
      where: { id },
      include: { problem: true },
    });

    if (!dp) {
      console.log(`❌ Daily problem ${id} not found, skipping`);
      failed++;
      continue;
    }

    const p = dp.problem;
    try {
      console.log(`Regenerating "${p.name}" (rating: ${p.rating})...`);

      const statement = await scrapeProblemStatement(p.cfContestId, p.cfIndex);
      console.log(`  statement: ${statement ? "found" : "null"}`);
      const testCases = (p.testCases as { input: string; output: string }[] | null) || undefined;
      console.log(`  testCases: ${testCases?.length || 0}`);

      const { editorial, validated } = await generateValidatedEditorial(
        p.name,
        p.tags,
        p.rating,
        p.cfContestId,
        p.cfIndex,
        statement,
        testCases
      );

      console.log(`  editorial length: ${editorial.length}, hasCpp: ${editorial.includes("cpp")}, validated: ${validated}`);

      if (!editorial || editorial.length < 100) {
        console.log(`⚠️ ${p.name}: editorial too short (${editorial.length} chars), skipping write`);
        failed++;
        continue;
      }

      await prisma.dailyProblem.update({
        where: { id: dp.id },
        data: { editorial },
      });

      console.log(`${validated ? "✅" : "⚠️ "} ${p.name} regenerated${validated ? "" : " (still unvalidated — did not pass the judge)"}`);
      success++;

      // Delay between problems to respect rate limits
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`❌ ${p.name}: ${err}`);
      failed++;
    }
  }

  console.log(`\nDone! ${success} regenerated, ${failed} failed.`);

  // Clean up
  writeFileSync(idsPath, "[]");
}

regenerate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
