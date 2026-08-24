import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "df-";
  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cfHandle } = await req.json();
  if (!cfHandle) {
    return NextResponse.json({ error: "Codeforces handle required" }, { status: 400 });
  }

  // Check if handle is already linked to another account
  const existing = await prisma.user.findUnique({ where: { cfHandle } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "This Codeforces handle is already linked to another account" }, { status: 409 });
  }

  // Verify the handle exists on Codeforces
  const cfRes = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(cfHandle)}`);
  if (!cfRes.ok) {
    return NextResponse.json({ error: "Could not reach Codeforces API" }, { status: 502 });
  }
  const cfData = await cfRes.json();
  if (cfData.status !== "OK" || !cfData.result?.length) {
    return NextResponse.json({ error: "Invalid Codeforces handle" }, { status: 400 });
  }

  const token = generateToken();

  // Delete any existing pending verification for this user
  await prisma.$executeRaw`DELETE FROM cf_verifications WHERE "userId" = ${userId}`;

  // Insert new verification token (expires in 15 minutes)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.$executeRaw`
    INSERT INTO cf_verifications ("discordId", "handle", token, "expiresAt", "userId")
    VALUES (${`web-${userId}`}, ${cfHandle.toLowerCase()}, ${token}, ${expiresAt.toISOString()}, ${userId})
  `;

  return NextResponse.json({
    message: "Verification token created",
    token,
    cfSettingsUrl: "https://codeforces.com/settings/profile",
  });
}
