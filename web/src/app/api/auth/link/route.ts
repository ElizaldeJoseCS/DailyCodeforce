import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const row = await prisma.$queryRawUnsafe<{ discordId: string; expiresAt: Date }[]>(
    `SELECT "discordId", "expiresAt" FROM discord_link_codes WHERE code = $1`,
    code.toUpperCase()
  );

  if (!row || row.length === 0) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  const { discordId, expiresAt } = row[0];
  if (new Date(expiresAt) < new Date()) {
    await prisma.$executeRawUnsafe(`DELETE FROM discord_link_codes WHERE code = $1`, code.toUpperCase());
    return NextResponse.json({ error: "Code has expired" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { discordId } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "This Discord account is already linked to another user" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (user?.discordId) {
    return NextResponse.json({ error: "Your account already has a Discord linked" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { discordId } });
  await prisma.$executeRawUnsafe(`DELETE FROM discord_link_codes WHERE code = $1`, code.toUpperCase());

  return NextResponse.json({ success: true });
}
