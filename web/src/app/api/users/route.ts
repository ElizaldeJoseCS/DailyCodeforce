import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, string> | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const allowed = ["displayName", "bio", "avatarUrl", "bannerUrl", "backgroundColor", "accentColor"];
  const data: Record<string, string | null> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key] || null;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      backgroundColor: true,
      accentColor: true,
    },
  });

  return NextResponse.json(user);
}
