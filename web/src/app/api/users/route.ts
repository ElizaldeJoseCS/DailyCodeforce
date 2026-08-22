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

  const data: Record<string, unknown> = {};

  if ("displayName" in body) data.displayName = body.displayName || null;
  if ("bio" in body) data.bio = body.bio || null;
  if ("avatarUrl" in body) data.avatarUrl = body.avatarUrl || null;
  if ("bannerUrl" in body) data.bannerUrl = body.bannerUrl || null;
  if ("backgroundColor" in body) data.backgroundColor = body.backgroundColor || null;
  if ("accentColor" in body) data.accentColor = body.accentColor || null;
  if ("avatarFrame" in body) data.avatarFrame = body.avatarFrame || null;
  if ("socialLinks" in body) data.socialLinks = body.socialLinks || {};
  if ("profileLayout" in body) data.profileLayout = body.profileLayout || {};

  try {
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
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
