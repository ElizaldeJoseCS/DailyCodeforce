import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get pending verification
  const rows = await prisma.$queryRaw<{ handle: string; token: string; expiresAt: Date }[]>`
    SELECT handle, token, "expiresAt"
    FROM cf_verifications
    WHERE "userId" = ${userId}
    ORDER BY "expiresAt" DESC
    LIMIT 1
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "No pending verification. Start by entering your handle." }, { status: 400 });
  }

  const { handle, token, expiresAt } = rows[0];

  if (new Date() > new Date(expiresAt)) {
    await prisma.$executeRaw`DELETE FROM cf_verifications WHERE "userId" = ${userId}`;
    return NextResponse.json({ error: "Verification token expired. Please try again." }, { status: 400 });
  }

  // Fetch CF profile to check firstName
  const cfRes = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
  if (!cfRes.ok) {
    return NextResponse.json({ error: "Could not reach Codeforces API. Try again in a minute." }, { status: 502 });
  }
  const cfData = await cfRes.json();
  if (cfData.status !== "OK" || !cfData.result?.length) {
    return NextResponse.json({ error: "Failed to fetch your Codeforces profile." }, { status: 500 });
  }

  const cfUser = cfData.result[0];
  const firstName = (cfUser.firstName || "").trim();

  if (firstName !== token) {
    return NextResponse.json({
      error: "Token not found in your Codeforces first name. Make sure you saved the changes and wait a minute for CF to update.",
    }, { status: 400 });
  }

  // Check if handle is already linked to another user
  const otherUser = await prisma.user.findFirst({ where: { cfHandle: handle, NOT: { id: userId } } });
  if (otherUser) {
    return NextResponse.json({ error: "This handle is already linked to another account." }, { status: 409 });
  }

  // Link the handle
  await prisma.user.update({
    where: { id: userId },
    data: { cfHandle: handle, avatarUrl: cfUser.avatar || undefined },
  });

  // Clean up verification
  await prisma.$executeRaw`DELETE FROM cf_verifications WHERE "userId" = ${userId}`;

  return NextResponse.json({
    message: "Verified!",
    handle: cfUser.handle,
    rating: cfUser.maxRating,
    rank: cfUser.rank,
  });
}
