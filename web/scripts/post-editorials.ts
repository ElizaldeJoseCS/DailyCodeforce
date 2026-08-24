import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
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

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID!;

const TIER_EMOJI: Record<string, string> = {
  beginner: "🟢",
  intermediate: "🔵",
  advanced: "🟠",
  expert: "🔴",
};

const TIER_COLOR: Record<string, number> = {
  beginner: 0x10b981,
  intermediate: 0x3b82f6,
  advanced: 0xf97316,
  expert: 0xef4444,
};

interface Embed {
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  url?: string;
}

async function createForumThread(name: string, embeds: Embed[]): Promise<string | null> {
  const body = {
    name,
    auto_archive_duration: 10080,
    message: {
      embeds,
    },
  };

  const res = await fetch(
    `https://discord.com/api/v10/channels/${CHANNEL_ID}/threads`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`Discord API error ${res.status}:`, err);
    return null;
  }

  const data = await res.json();
  return data.id;
}

async function postEditorials() {
  if (!DISCORD_TOKEN || !CHANNEL_ID) {
    console.log("Missing DISCORD_BOT_TOKEN or NOTIFICATION_CHANNEL_ID, skipping");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const problems = await prisma.dailyProblem.findMany({
    where: { date: today, editorial: { not: null } },
    include: { problem: true },
    orderBy: { tier: "asc" },
  });

  if (problems.length === 0) {
    console.log("No editorials to post for today");
    return;
  }

  console.log(`Posting ${problems.length} editorials to Discord...`);

  for (const dp of problems) {
    const p = dp.problem;
    const editorial = dp.editorial as string;
    const emoji = TIER_EMOJI[dp.tier] || "⚪";
    const color = TIER_COLOR[dp.tier] || 0x6b7280;

    // Split editorial into chunks (Discord embed description limit is 4096)
    const chunks: string[] = [];
    const lines = editorial.split("\n");
    let current = "";
    for (const line of lines) {
      if ((current + "\n" + line).length > 3900) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? current + "\n" + line : line;
      }
    }
    if (current) chunks.push(current);

    const embeds: Embed[] = [];

    // First embed: header with problem info
    embeds.push({
      title: `${emoji} ${p.name} (Rating: ${p.rating})`,
      description: chunks[0] || "No editorial content",
      color,
      fields: [
        { name: "Tags", value: (p.tags as string[]).join(", ") || "N/A", inline: true },
        { name: "🔗 Solve", value: `[Codeforces →](${p.url})`, inline: true },
      ],
      url: p.url,
    });

    // Additional embeds for long editorials
    for (let i = 1; i < chunks.length; i++) {
      embeds.push({
        title: `${emoji} ${p.name} — continued`,
        description: chunks[i],
        color,
      });
    }

    const threadName = `${emoji} ${dp.tier.charAt(0).toUpperCase() + dp.tier.slice(1)} — ${p.name} (Rating: ${p.rating})`;
    const threadId = await createForumThread(threadName, embeds);

    if (threadId) {
      console.log(`✅ Posted ${p.name} (thread ${threadId})`);
    } else {
      console.error(`❌ Failed to post ${p.name}`);
    }

    // Rate limit: 1 request per second
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log("Done posting editorials!");
}

postEditorials()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
