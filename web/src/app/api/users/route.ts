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

  const stringFields = ["displayName", "bio", "avatarUrl", "bannerUrl", "backgroundColor", "accentColor", "avatarFrame"];
  const data: Record<string, string | null> = {};
  for (const key of stringFields) {
    if (key in body) data[key] = body[key] || null;
  }

  if ("socialLinks" in body) data.socialLinks = JSON.stringify(body.socialLinks || {});
  if ("profileLayout" in body) data.profileLayout = JSON.stringify(body.profileLayout || {});

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
      socialLinks: true,
      profileLayout: true,
      avatarFrame: true,
    },
  });

  return NextResponse.json(user);
}
