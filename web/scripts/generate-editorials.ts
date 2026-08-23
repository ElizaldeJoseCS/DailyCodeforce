import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
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

async function generateEditorials() {
  const todayOnly = process.argv.includes("--today");
  const doClear = process.argv.includes("--clear");

  if (doClear) {
    await prisma.dailyProblem.updateMany({
      data: { editorial: null },
    });
    console.log("Cleared all editorials");
  }

  const where: { editorial: null; date?: Date } = { editorial: null };
  if (todayOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.date = today;
  }

  const missing = await prisma.dailyProblem.findMany({
    where,
    include: { problem: true },
    orderBy: { date: "desc" },
    ...(todayOnly ? {} : { take: 10 }),
  });

  if (missing.length === 0) {
    console.log("No problems need editorials");
    return;
  }

  console.log(`Generating editorials for ${missing.length} problems...`);

  for (const dp of missing) {
    const p = dp.problem;
    try {
      console.log(`Generating for "${p.name}"...`);
      const statement = await scrapeProblemStatement(
        p.cfContestId,
        p.cfIndex
      );

      const testCases = (p.testCases as { input: string; output: string }[] | null) || undefined;

      const editorial = await generateValidatedEditorial(
        p.name,
        p.tags,
        p.rating,
        p.cfContestId,
        p.cfIndex,
        statement,
        testCases
      );

      await prisma.dailyProblem.update({
        where: { id: dp.id },
        data: { editorial },
      });

      console.log(`✅ ${p.name}${testCases ? " (validated)" : " (no test cases)"}`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`❌ ${p.name}:`, err);
    }
  }

  console.log("Done!");
}

generateEditorials()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
