import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyCFHandle } from "@/lib/codeforces";

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

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.cfHandle) {
    return NextResponse.json({ error: "Codeforces handle already linked" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { cfHandle } });
  if (existing) {
    return NextResponse.json({ error: "This Codeforces handle is already linked to another account" }, { status: 409 });
  }

  const cfCheck = await verifyCFHandle(cfHandle);
  if (!cfCheck.valid) {
    return NextResponse.json({ error: "Invalid Codeforces handle" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { cfHandle, avatarUrl: user.avatarUrl || cfCheck.avatar },
  });

  return NextResponse.json({ message: "Codeforces handle linked" });
}
