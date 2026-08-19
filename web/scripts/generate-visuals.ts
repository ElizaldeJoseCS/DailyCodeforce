import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateProblemVisual(
  problemName: string,
  tags: string[],
  rating: number
): Promise<{ url: string; prompt: string }> {
  const tagStr = tags.join(", ");
  const prompt = `Clean minimal technical diagram illustrating algorithm concepts: ${tagStr}. Problem: "${problemName}" (difficulty ${rating}). Show abstract data structures and flow, professional educational style, dark navy background, no text or letters, geometric shapes, glowing accent colors cyan and magenta.`;

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size: "1024x1024",
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error("No image data returned from OpenAI");

  if (imageData.url) {
    return { url: imageData.url, prompt };
  }

  if (imageData.b64_json) {
    const { writeFileSync, mkdirSync } = await import("fs");
    const { resolve: res, dirname: dirn } = await import("path");
    const { fileURLToPath } = await import("url");

    const outDir = res(dirn(fileURLToPath(import.meta.url)), "../public/visuals");
    mkdirSync(outDir, { recursive: true });

    const filename = `${problemName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    const filePath = res(outDir, filename);
    writeFileSync(filePath, Buffer.from(imageData.b64_json, "base64"));

    return { url: `/visuals/${filename}`, prompt };
  }

  throw new Error("No image data in response");
}

async function generateVisuals() {
  const missing = await prisma.dailyProblem.findMany({
    where: { visualUrl: null },
    include: { problem: true },
    orderBy: { date: "desc" },
    take: 10,
  });

  if (missing.length === 0) {
    console.log("No problems need visuals");
    return;
  }

  console.log(`Generating visuals for ${missing.length} problems...`);

  for (const dp of missing) {
    try {
      console.log(`Generating for "${dp.problem.name}"...`);
      const { url, prompt } = await generateProblemVisual(
        dp.problem.name,
        dp.problem.tags,
        dp.problem.rating
      );

      await prisma.dailyProblem.update({
        where: { id: dp.id },
        data: { visualUrl: url, visualPrompt: prompt },
      });

      console.log(`✅ ${dp.problem.name}`);
    } catch (err) {
      console.error(`❌ ${dp.problem.name}:`, err);
    }
  }

  console.log("Done!");
}

generateVisuals()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
