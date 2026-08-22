import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
  }

  const rows = await prisma.$queryRawUnsafe<{ id: string; username: string; cfHandle: string; passwordHash: string; avatarUrl: string | null; expiresAt: Date }[]>(
    `SELECT id, username, "cfHandle", "passwordHash", "avatarUrl", "expiresAt"
     FROM pending_registrations
     WHERE email = $1 AND code = $2`,
    email, code.trim()
  );

  if (!rows || rows.length === 0) {
    // Check if email is already verified (user exists)
    const existing = await prisma.user.findUnique({ where: { email }, select: { emailVerified: true } });
    if (existing?.emailVerified) {
      return NextResponse.json({ message: "Email already verified" });
    }
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  const pending = rows[0];

  if (new Date(pending.expiresAt) < new Date()) {
    await prisma.$executeRawUnsafe(`DELETE FROM pending_registrations WHERE id = $1`, pending.id);
    return NextResponse.json({ error: "Code has expired. Please sign up again." }, { status: 400 });
  }

  // Check if username or cfHandle got taken in the meantime
  const conflict = await prisma.user.findFirst({
    where: { OR: [{ username: pending.username }, { cfHandle: pending.cfHandle }] },
    select: { username: true, cfHandle: true },
  });
  if (conflict) {
    const field = conflict.username === pending.username ? "Username" : "Codeforces handle";
    return NextResponse.json({ error: `${field} was taken while you were verifying. Please sign up again.`, conflict: true }, { status: 409 });
  }

  // Create the user
  await prisma.user.create({
    data: {
      email,
      username: pending.username,
      passwordHash: pending.passwordHash,
      cfHandle: pending.cfHandle,
      avatarUrl: pending.avatarUrl,
      emailVerified: true,
    },
  });

  // Clean up
  await prisma.$executeRawUnsafe(`DELETE FROM pending_registrations WHERE id = $1`, pending.id);

  return NextResponse.json({ message: "Email verified successfully" });
}
